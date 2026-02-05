import { NextRequest, NextResponse } from 'next/server';

const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

interface BraveResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

async function searchBrave(query: string, count: number = 20): Promise<BraveResult[]> {
  if (!BRAVE_API_KEY) {
    throw new Error('BRAVE_API_KEY not configured');
  }

  const params = new URLSearchParams({
    q: query,
    count: count.toString(),
    country: 'us',
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': BRAVE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status}`);
  }

  const data = await response.json();
  return data.web?.results || [];
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
        return { display: `$${match[1]} - $${match[2]}/hr`, numeric: (low + high) / 2 };
      }
      return { display: `$${match[1]}/hr`, numeric: parseFloat(match[1]) };
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
    { pattern: /incredible/i, name: 'Incredible Health' },
  ];

  const combined = `${title} ${text}`;
  for (const f of facilities) {
    if (f.pattern.test(combined)) return f.name;
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
  if (lower.includes('pcu') || lower.includes('stepdown') || lower.includes('progressive')) return 'PCU/Stepdown';
  if (lower.includes('telemetry') || lower.includes('tele')) return 'Telemetry';
  if (lower.includes('emergency') || lower.includes(' er ') || lower.includes(' ed ')) return 'Emergency';
  if (lower.includes('med-surg') || lower.includes('med/surg')) return 'Med-Surg';
  if (lower.includes('nicu') || lower.includes('neonatal')) return 'NICU';
  if (lower.includes('cardiac') || lower.includes('cath')) return 'Cardiac';
  return 'General';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hospitals, units, jobTypes, location } = body;

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }

    // Build search query - keep it simple for Brave
    const unitNames = units?.map((u: string) => {
      const map: Record<string, string> = { icu: 'ICU', pcu: 'PCU', tele: 'telemetry', er: 'emergency', medsurg: 'med-surg' };
      return map[u] || u;
    }) || ['ICU'];
    
    const query = `${unitNames[0]} RN nursing jobs ${location} hiring`;
    console.log('Search query:', query);

    const results = await searchBrave(query, 25);
    console.log('Brave results:', results.length);

    const jobs = results
      .map((result) => {
        const combined = `${result.title} ${result.description}`;
        const pay = extractPay(combined);

        return {
          title: result.title.replace(/\s*\|.*$/, '').replace(/\s*-\s*[^-]+$/, '').trim(),
          facility: extractFacility(result.title, result.description),
          location,
          pay: pay?.display || '',
          payNumeric: pay?.numeric || 0,
          type: extractJobType(combined),
          unit: extractUnit(combined),
          url: result.url,
          snippet: result.description.slice(0, 200),
        };
      })
      .filter((job) => {
        const combined = `${job.title} ${job.snippet} ${job.url}`.toLowerCase();
        const isNursing = /nurse|nursing|\brn\b|registered|icu|pcu|telemetry|critical care/i.test(combined);
        const looksLikeJob = /hiring|apply|job|position|career|opportunity|jobs\./i.test(combined);
        const isNotArticle = !/news|school|program|salary guide|highest paid|killed|protest/i.test(combined);
        return isNursing && looksLikeJob && isNotArticle;
      })
      .sort((a, b) => b.payNumeric - a.payNumeric);

    return NextResponse.json({ jobs, query, total: jobs.length });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Search failed' }, { status: 500 });
  }
}
