import { NextRequest, NextResponse } from 'next/server';

// Exa MCP endpoint (free hosted, no API key needed)
const EXA_MCP_URL = 'https://mcp.exa.ai/mcp';

interface ExaResult {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
}

async function searchExa(query: string, numResults: number = 15): Promise<ExaResult[]> {
  const response = await fetch(EXA_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'web_search_exa',
        arguments: {
          query,
          numResults,
          livecrawl: 'preferred',
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa MCP error: ${response.status}`);
  }

  // Parse SSE response
  const text = await response.text();
  
  // Extract JSON from SSE format (data: {...})
  const dataMatch = text.match(/data: ({.*})/);
  if (!dataMatch) {
    console.error('No data in Exa response:', text.slice(0, 200));
    return [];
  }

  const data = JSON.parse(dataMatch[1]);
  
  if (data.error) {
    throw new Error(data.error.message);
  }

  // Parse the text content from Exa
  const content = data.result?.content?.[0]?.text || '';
  return parseExaText(content);
}

function parseExaText(text: string): ExaResult[] {
  const results: ExaResult[] = [];
  
  // Split by "Title:" markers
  const blocks = text.split(/(?=Title:)/);
  
  for (const block of blocks) {
    if (!block.trim() || block.length < 20) continue;
    
    const titleMatch = block.match(/Title:\s*(.+?)(?:\n|Author:)/);
    const urlMatch = block.match(/URL:\s*(.+?)(?:\n|$)/);
    const dateMatch = block.match(/Published Date:\s*(.+?)(?:\n|$)/);
    const textMatch = block.match(/Text:\s*([\s\S]+?)(?=Title:|$)/);
    
    if (titleMatch && urlMatch) {
      results.push({
        title: titleMatch[1].trim(),
        url: urlMatch[1].trim(),
        text: textMatch ? textMatch[1].trim().slice(0, 500) : '',
        publishedDate: dateMatch ? dateMatch[1].trim() : undefined,
      });
    }
  }
  
  return results;
}

function extractPay(text: string): { display: string; numeric: number } | null {
  // Weekly pay patterns (travel nursing)
  const weeklyMatch = text.match(/\$(\d{1,2},?\d{3})\s*(?:to|-)\s*\$?(\d{1,2},?\d{3})\s*(?:\/?\s*week|weekly)/i);
  if (weeklyMatch) {
    const low = parseFloat(weeklyMatch[1].replace(',', ''));
    const high = parseFloat(weeklyMatch[2].replace(',', ''));
    return { display: `$${weeklyMatch[1]}-$${weeklyMatch[2]}/wk`, numeric: (low + high) / 2 / 40 }; // Convert to hourly
  }

  // Hourly patterns
  const hourlyPatterns = [
    /\$(\d+(?:\.\d{2})?)\s*(?:to|-)\s*\$?(\d+(?:\.\d{2})?)\s*(?:\/?\s*(?:hr|hour)|per hour|hourly)?/i,
    /\$(\d+(?:\.\d{2})?)\s*(?:\/?\s*(?:hr|hour)|per hour|hourly)/i,
  ];

  for (const pattern of hourlyPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        const low = parseFloat(match[1]);
        const high = parseFloat(match[2]);
        return { display: `$${match[1]}-$${match[2]}/hr`, numeric: (low + high) / 2 };
      }
      return { display: `$${match[1]}/hr`, numeric: parseFloat(match[1]) };
    }
  }
  return null;
}

function extractFacility(title: string, text: string): string {
  const combined = `${title} ${text}`.toLowerCase();
  const facilities = [
    { pattern: /kaiser/i, name: 'Kaiser Permanente' },
    { pattern: /sutter/i, name: 'Sutter Health' },
    { pattern: /ucsf/i, name: 'UCSF Medical Center' },
    { pattern: /stanford/i, name: 'Stanford Health Care' },
    { pattern: /sf general|zuckerberg/i, name: 'SF General' },
    { pattern: /dignity/i, name: 'Dignity Health' },
    { pattern: /john muir/i, name: 'John Muir Health' },
    { pattern: /sharp/i, name: 'Sharp Healthcare' },
    { pattern: /incredible health/i, name: 'Incredible Health' },
    { pattern: /vivian/i, name: 'Vivian Health' },
    { pattern: /amn/i, name: 'AMN Healthcare' },
    { pattern: /lead health/i, name: 'Lead Health' },
  ];

  for (const f of facilities) {
    if (f.pattern.test(combined)) return f.name;
  }
  return 'Healthcare Facility';
}

function extractJobType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('travel')) return 'Travel';
  if (lower.includes('per diem') || lower.includes('prn')) return 'Per Diem';
  if (lower.includes('contract')) return 'Contract';
  if (lower.includes('part-time')) return 'Part-time';
  return 'Full-time';
}

function extractUnit(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('icu') || lower.includes('intensive care') || lower.includes('critical care')) return 'ICU';
  if (lower.includes('pcu') || lower.includes('stepdown') || lower.includes('progressive')) return 'PCU/Stepdown';
  if (lower.includes('telemetry') || lower.includes('tele')) return 'Telemetry';
  if (lower.includes('emergency') || lower.includes(' er ') || lower.includes(' ed ')) return 'Emergency';
  if (lower.includes('med-surg') || lower.includes('med/surg')) return 'Med-Surg';
  if (lower.includes('nicu') || lower.includes('neonatal')) return 'NICU';
  if (lower.includes('cardiac') || lower.includes('cath')) return 'Cardiac';
  return 'General';
}

function extractLocation(text: string): string {
  // Try to extract city, state from text
  const locMatch = text.match(/(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*(CA|California)/i);
  if (locMatch) return `${locMatch[1]}, CA`;
  
  const cityMatch = text.match(/(San Francisco|Oakland|San Jose|Palo Alto|Berkeley|Vallejo|Antioch|Castro Valley|San Leandro|Pleasanton)/i);
  if (cityMatch) return `${cityMatch[1]}, CA`;
  
  return 'Bay Area, CA';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hospitals = [], units = ['icu'], jobTypes = [], location = 'San Francisco' } = body;

    // Build search query
    const unitNames = units.map((u: string) => {
      const map: Record<string, string> = { 
        icu: 'ICU intensive care', 
        pcu: 'PCU stepdown progressive care', 
        tele: 'telemetry', 
        er: 'emergency ER', 
        medsurg: 'med-surg',
        cardiac: 'cardiac CCU',
      };
      return map[u] || u;
    });
    
    const hospitalNames = hospitals.filter((h: string) => h !== 'any').slice(0, 2);
    const typeTerms = jobTypes.includes('per-diem') ? 'per diem PRN' : '';
    const travelTerms = jobTypes.includes('travel') ? 'travel' : '';
    
    const query = `${unitNames[0] || 'ICU'} RN nurse jobs ${location} ${hospitalNames.join(' ')} ${typeTerms} ${travelTerms} hiring 2025 2026`.trim().replace(/\s+/g, ' ');
    
    console.log('Exa search query:', query);

    // Search with Exa MCP
    const results = await searchExa(query, 20);
    console.log('Exa results:', results.length);

    // Transform to job listings
    const jobs = results
      .map((result) => {
        const combined = `${result.title} ${result.text}`;
        const pay = extractPay(combined);
        
        return {
          title: result.title
            .replace(/\s*\|.*$/, '')
            .replace(/\s*-\s*LinkedIn.*$/i, '')
            .replace(/\s+jobs?\s+in\s+.*/i, '')
            .trim()
            .slice(0, 80),
          facility: extractFacility(result.title, result.text),
          location: extractLocation(combined),
          pay: pay?.display || '',
          payNumeric: pay?.numeric || 0,
          type: extractJobType(combined),
          unit: extractUnit(combined),
          url: result.url,
          snippet: result.text.slice(0, 200).replace(/\n/g, ' '),
          postedDate: result.publishedDate,
        };
      })
      // Filter to actual nursing jobs
      .filter((job) => {
        const combined = `${job.title} ${job.snippet} ${job.url}`.toLowerCase();
        const isNursing = /nurse|nursing|\brn\b|registered|icu|pcu|telemetry|critical care/i.test(combined);
        const looksLikeJob = /job|hiring|apply|career|position|staff|travel/i.test(combined);
        const isNotArticle = !/news|article|school|program|salary guide|highest paid|killed|lawsuit/i.test(combined);
        return isNursing && looksLikeJob && isNotArticle;
      })
      // Sort by pay (highest first)
      .sort((a, b) => b.payNumeric - a.payNumeric);

    return NextResponse.json({
      jobs,
      query,
      total: jobs.length,
      source: 'exa-mcp',
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed', source: 'exa-mcp' },
      { status: 500 }
    );
  }
}
