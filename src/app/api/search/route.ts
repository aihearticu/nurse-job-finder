import { NextRequest, NextResponse } from 'next/server';

// Exa MCP endpoint (free, no API key needed)
const EXA_MCP_URL = 'https://mcp.exa.ai/mcp';

interface ExaResult {
  title: string;
  url: string;
  text?: string;
  publishedDate?: string;
}

async function searchExa(query: string, numResults: number = 15): Promise<ExaResult[]> {
  // Call Exa MCP via JSON-RPC
  const response = await fetch(EXA_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
    console.error('Exa MCP error:', response.status);
    return [];
  }

  const data = await response.json();
  
  // Parse the MCP response
  if (data.result?.content?.[0]?.text) {
    return parseExaText(data.result.content[0].text);
  }
  
  return [];
}

function parseExaText(text: string): ExaResult[] {
  const results: ExaResult[] = [];
  
  // Split by "Title:" markers
  const blocks = text.split(/(?=Title:)/);
  
  for (const block of blocks) {
    if (!block.trim()) continue;
    
    const titleMatch = block.match(/Title:\s*(.+?)(?:\n|Author:)/);
    const urlMatch = block.match(/URL:\s*(.+?)(?:\n|$)/);
    const dateMatch = block.match(/Published Date:\s*(.+?)(?:\n|$)/);
    const textMatch = block.match(/Text:\s*([\s\S]+?)(?=Title:|$)/);
    
    if (titleMatch && urlMatch) {
      results.push({
        title: titleMatch[1].trim(),
        url: urlMatch[1].trim(),
        text: textMatch ? textMatch[1].trim() : '',
        publishedDate: dateMatch ? dateMatch[1].trim() : undefined,
      });
    }
  }
  
  return results;
}

function extractPay(text: string): { display: string; numeric: number } | null {
  const patterns = [
    /\$(\d+(?:\.\d{2})?)\s*[-–to]+\s*\$?(\d+(?:\.\d{2})?)\s*(?:\/\s*(?:hr|hour)|per hour|hourly)?/i,
    /\$(\d+(?:\.\d{2})?)\s*(?:\/\s*(?:hr|hour)|per hour|hourly)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        const low = parseFloat(match[1]);
        const high = parseFloat(match[2]);
        return {
          display: `$${match[1]} - $${match[2]}/hr`,
          numeric: (low + high) / 2,
        };
      } else {
        return {
          display: `$${match[1]}/hr`,
          numeric: parseFloat(match[1]),
        };
      }
    }
  }
  return null;
}

function extractFacility(title: string, text: string): string {
  const facilities = [
    { pattern: /kaiser/i, name: 'Kaiser Permanente' },
    { pattern: /sutter/i, name: 'Sutter Health' },
    { pattern: /ucsf/i, name: 'UCSF Medical Center' },
    { pattern: /stanford/i, name: 'Stanford Health Care' },
    { pattern: /sf general|zuckerberg/i, name: 'SF General' },
    { pattern: /dignity/i, name: 'Dignity Health' },
    { pattern: /john muir/i, name: 'John Muir Health' },
    { pattern: /sharp/i, name: 'Sharp Healthcare' },
    { pattern: /vivian/i, name: 'Vivian Health' },
    { pattern: /amn/i, name: 'AMN Healthcare' },
  ];

  const combined = `${title} ${text}`;
  for (const f of facilities) {
    if (f.pattern.test(combined)) {
      return f.name;
    }
  }
  return 'Healthcare Facility';
}

function extractJobType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('per diem') || lower.includes('prn')) return 'Per Diem';
  if (lower.includes('travel')) return 'Travel';
  if (lower.includes('contract')) return 'Contract';
  if (lower.includes('part-time')) return 'Part-time';
  return 'Full-time';
}

function extractUnit(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('icu') || lower.includes('intensive care') || lower.includes('critical care')) return 'ICU';
  if (lower.includes('pcu') || lower.includes('stepdown') || lower.includes('step-down') || lower.includes('progressive')) return 'PCU/Stepdown';
  if (lower.includes('telemetry') || lower.includes('tele')) return 'Telemetry';
  if (lower.includes('emergency') || lower.includes(' er ') || lower.includes(' ed ')) return 'Emergency';
  if (lower.includes('med-surg') || lower.includes('med/surg') || lower.includes('medical surgical')) return 'Med-Surg';
  if (lower.includes('nicu') || lower.includes('neonatal')) return 'NICU';
  if (lower.includes('cardiac') || lower.includes('cath')) return 'Cardiac';
  return 'General';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hospitals, units, jobTypes, location } = body;

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    // Build search query
    const hospitalNames = hospitals?.filter((h: string) => h !== 'any').slice(0, 2) || [];
    const unitNames = units?.slice(0, 2) || ['ICU', 'RN'];
    const typeTerms = jobTypes?.includes('per-diem') ? 'per diem PRN' : '';
    
    const query = `${unitNames.join(' ')} RN nurse jobs ${location} ${hospitalNames.join(' ')} ${typeTerms} hiring 2025 2026`.trim();
    
    console.log('Search query:', query);

    // Search with Exa
    const results = await searchExa(query, 20);
    console.log('Exa results:', results.length);

    // Transform to job listings
    const jobs = results
      .map((result) => {
        const combined = `${result.title} ${result.text || ''}`;
        const pay = extractPay(combined);
        
        return {
          title: result.title.replace(/\s*\|.*$/, '').replace(/\s*at\s+\w+\s*$/, '').trim(),
          facility: extractFacility(result.title, result.text || ''),
          location: location,
          pay: pay?.display || '',
          payNumeric: pay?.numeric || 0,
          type: extractJobType(combined),
          unit: extractUnit(combined),
          url: result.url,
          snippet: (result.text || '').slice(0, 200),
          postedDate: result.publishedDate,
        };
      })
      // Filter to nursing jobs only
      .filter((job) => {
        const combined = `${job.title} ${job.snippet}`.toLowerCase();
        const isNursing = /nurse|nursing|\brn\b|registered|icu|pcu|telemetry|critical care/i.test(combined);
        const isNotArticle = !/news|article|school|program|salary guide|highest paid/i.test(combined);
        return isNursing && isNotArticle;
      })
      // Sort by pay (highest first)
      .sort((a, b) => b.payNumeric - a.payNumeric);

    return NextResponse.json({
      jobs,
      query,
      total: jobs.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
