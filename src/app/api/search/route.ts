import { NextRequest, NextResponse } from 'next/server';

const EXA_MCP_URL = 'https://mcp.exa.ai/mcp';

interface ExaResult {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
}

async function searchExa(query: string, numResults: number = 20): Promise<ExaResult[]> {
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
        arguments: { query, numResults, livecrawl: 'preferred' },
      },
    }),
  });

  if (!response.ok) throw new Error(`Exa error: ${response.status}`);

  const text = await response.text();
  const dataMatch = text.match(/data: ({.*})/);
  if (!dataMatch) return [];

  const data = JSON.parse(dataMatch[1]);
  if (data.error) throw new Error(data.error.message);

  return parseExaText(data.result?.content?.[0]?.text || '');
}

function parseExaText(text: string): ExaResult[] {
  const results: ExaResult[] = [];
  const blocks = text.split(/(?=Title:)/);
  
  for (const block of blocks) {
    if (!block.trim() || block.length < 20) continue;
    
    const titleMatch = block.match(/Title:\s*(.+?)(?:\n|Author:)/);
    const urlMatch = block.match(/URL:\s*(.+?)(?:\n|$)/);
    const textMatch = block.match(/Text:\s*([\s\S]+?)(?=Title:|$)/);
    
    if (titleMatch && urlMatch) {
      results.push({
        title: titleMatch[1].trim(),
        url: urlMatch[1].trim(),
        text: textMatch ? textMatch[1].trim().slice(0, 600) : '',
      });
    }
  }
  return results;
}

function extractPay(text: string): { display: string; numeric: number } | null {
  // Weekly pay
  const weeklyMatch = text.match(/\$(\d{1,2},?\d{3})\s*(?:to|-)\s*\$?(\d{1,2},?\d{3})\s*(?:\/?\s*week|weekly)/i);
  if (weeklyMatch) {
    const low = parseFloat(weeklyMatch[1].replace(',', ''));
    const high = parseFloat(weeklyMatch[2].replace(',', ''));
    return { display: `$${weeklyMatch[1]}-$${weeklyMatch[2]}/wk`, numeric: (low + high) / 2 / 40 };
  }
  
  // Hourly pay
  const hourlyMatch = text.match(/\$(\d+(?:\.\d{2})?)\s*(?:to|-)\s*\$?(\d+(?:\.\d{2})?)\s*(?:\/?\s*(?:hr|hour))?/i)
    || text.match(/\$(\d+(?:\.\d{2})?)\s*(?:\/?\s*(?:hr|hour)|per hour)/i);
  
  if (hourlyMatch) {
    if (hourlyMatch[2]) {
      return { display: `$${hourlyMatch[1]}-$${hourlyMatch[2]}/hr`, numeric: (parseFloat(hourlyMatch[1]) + parseFloat(hourlyMatch[2])) / 2 };
    }
    return { display: `$${hourlyMatch[1]}/hr`, numeric: parseFloat(hourlyMatch[1]) };
  }
  return null;
}

function extractFacility(text: string): string {
  const combined = text.toLowerCase();
  const facilities = [
    [/kaiser/i, 'Kaiser Permanente'],
    [/sutter/i, 'Sutter Health'],
    [/ucsf/i, 'UCSF Medical'],
    [/stanford/i, 'Stanford Health'],
    [/cedars/i, 'Cedars-Sinai'],
    [/ucla/i, 'UCLA Health'],
    [/providence/i, 'Providence'],
    [/dignity/i, 'Dignity Health'],
    [/hca/i, 'HCA Healthcare'],
    [/ascension/i, 'Ascension'],
    [/memorial/i, 'Memorial Health'],
    [/methodist/i, 'Methodist'],
    [/baptist/i, 'Baptist Health'],
    [/mayo/i, 'Mayo Clinic'],
    [/cleveland clinic/i, 'Cleveland Clinic'],
    [/john muir/i, 'John Muir'],
    [/sharp/i, 'Sharp Healthcare'],
    [/scripps/i, 'Scripps Health'],
    [/amn/i, 'AMN Healthcare'],
    [/incredible health/i, 'Incredible Health'],
    [/vivian/i, 'Vivian Health'],
    [/nomad/i, 'Nomad Health'],
    [/aya/i, 'Aya Healthcare'],
  ] as const;

  for (const [pattern, name] of facilities) {
    if (pattern.test(combined)) return name;
  }
  return 'Healthcare';
}

function extractJobType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('travel')) return 'Travel';
  if (lower.includes('per diem') || lower.includes('prn')) return 'Per Diem';
  if (lower.includes('contract')) return 'Contract';
  if (lower.includes('part-time') || lower.includes('part time')) return 'Part-time';
  return 'Full-time';
}

function extractUnit(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('icu') || lower.includes('intensive care') || lower.includes('critical care')) return 'ICU';
  if (lower.includes('nicu') || lower.includes('neonatal')) return 'NICU';
  if (lower.includes('picu') || lower.includes('pediatric intensive')) return 'PICU';
  if (lower.includes('pcu') || lower.includes('stepdown') || lower.includes('step-down') || lower.includes('progressive')) return 'PCU/Stepdown';
  if (lower.includes('telemetry') || lower.includes('tele ')) return 'Telemetry';
  if (lower.includes('emergency') || lower.includes(' er ') || lower.includes(' ed ')) return 'Emergency';
  if (lower.includes('med-surg') || lower.includes('med/surg') || lower.includes('medical surgical')) return 'Med-Surg';
  if (lower.includes('cardiac') || lower.includes('ccu') || lower.includes('cath')) return 'Cardiac';
  if (lower.includes('or ') || lower.includes('operating room') || lower.includes('surgical')) return 'OR';
  if (lower.includes('pacu') || lower.includes('recovery')) return 'PACU';
  if (lower.includes('labor') || lower.includes('delivery') || lower.includes('l&d')) return 'L&D';
  if (lower.includes('oncology')) return 'Oncology';
  if (lower.includes('psych') || lower.includes('behavioral')) return 'Psych';
  return 'General';
}

function extractLocation(text: string, defaultLoc: string): string {
  // Common city patterns
  const cityPatterns = [
    /(San Francisco|Los Angeles|San Diego|Sacramento|San Jose|Oakland|Fresno|Long Beach|Bakersfield|Anaheim|Santa Ana|Riverside|Stockton|Irvine|Fremont|Glendale|Huntington Beach|Santa Clarita|Garden Grove|Oceanside|Rancho Cucamonga|Santa Rosa|Ontario|Elk Grove|Corona|Lancaster|Palmdale|Pomona|Salinas|Escondido|Pasadena|Torrance|Sunnyvale|Hayward|Orange|Fullerton|Thousand Oaks|Visalia|Roseville|Concord|Santa Clara|Simi Valley|Victorville|Berkeley|El Monte|Downey|Costa Mesa|Inglewood|Carlsbad|San Buenaventura|Vallejo|Fairfield|West Covina|Murrieta|Richmond|Norwalk|Antioch|Temecula|Burbank|Daly City|El Cajon|Rialto|Clovis|Compton),?\s*(CA|California)?/i,
    /(New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose|Austin|Jacksonville|Fort Worth|Columbus|Charlotte|Indianapolis|Seattle|Denver|Washington|Boston|El Paso|Nashville|Detroit|Oklahoma City|Portland|Las Vegas|Memphis|Louisville|Baltimore|Milwaukee|Albuquerque|Tucson|Fresno|Mesa|Sacramento|Atlanta|Kansas City|Colorado Springs|Omaha|Raleigh|Miami|Cleveland|Tulsa|Oakland|Minneapolis|Wichita|Arlington|New Orleans|Bakersfield|Tampa|Honolulu|Aurora|Anaheim|Santa Ana|St\. Louis|Riverside|Corpus Christi|Lexington|Pittsburgh|Anchorage|Stockton|Cincinnati|St\. Paul|Toledo|Greensboro|Newark|Plano|Henderson|Lincoln|Buffalo|Jersey City|Chula Vista|Fort Wayne|Orlando|St\. Petersburg|Chandler|Laredo|Norfolk|Durham|Madison|Lubbock|Irvine|Winston-Salem|Glendale|Garland|Hialeah|Reno|Chesapeake|Gilbert|Baton Rouge|Irving|Scottsdale|North Las Vegas|Fremont|Boise|Richmond|San Bernardino)/i,
  ];
  
  for (const pattern of cityPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  // State abbreviations
  const stateMatch = text.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
  if (stateMatch) return stateMatch[1];
  
  return defaultLoc || 'USA';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, location } = body;

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Build search - add nursing context if not present
    const hasNursingTerms = /nurse|nursing|\brn\b|lpn|cna|healthcare/i.test(query);
    const searchQuery = hasNursingTerms 
      ? `${query} ${location || ''} jobs hiring`.trim()
      : `${query} nurse RN ${location || ''} jobs hiring`.trim();
    
    console.log('Exa query:', searchQuery);

    const results = await searchExa(searchQuery, 25);
    console.log('Exa results:', results.length);

    const jobs = results
      .map((result) => {
        const combined = `${result.title} ${result.text}`;
        const pay = extractPay(combined);
        
        return {
          title: result.title
            .replace(/\s*\|.*$/, '')
            .replace(/\s*-\s*LinkedIn.*$/i, '')
            .replace(/\s*jobs?\s+in\s+.*$/i, '')
            .replace(/\s*hiring.*$/i, '')
            .trim()
            .slice(0, 100),
          facility: extractFacility(combined),
          location: extractLocation(combined, location),
          pay: pay?.display || '',
          payNumeric: pay?.numeric || 0,
          type: extractJobType(combined),
          unit: extractUnit(combined),
          url: result.url,
          snippet: result.text.replace(/\n+/g, ' ').slice(0, 200),
        };
      })
      .filter((job) => {
        const combined = `${job.title} ${job.snippet} ${job.url}`.toLowerCase();
        const isNursing = /nurse|nursing|\brn\b|lpn|healthcare|medical|hospital|clinical/i.test(combined);
        const looksLikeJob = /job|hiring|apply|career|position|staff|travel|opportunity/i.test(combined);
        const isNotJunk = !/news|article|school|degree|program|salary guide|killed|lawsuit|protest|blog|forum/i.test(combined);
        return isNursing && looksLikeJob && isNotJunk;
      })
      .sort((a, b) => b.payNumeric - a.payNumeric);

    return NextResponse.json({
      jobs,
      query: searchQuery,
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
