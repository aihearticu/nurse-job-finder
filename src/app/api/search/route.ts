import { NextRequest, NextResponse } from 'next/server';

// Hospital name mappings for search
const HOSPITAL_NAMES: Record<string, string> = {
  kaiser: 'Kaiser Permanente',
  sutter: 'Sutter Health',
  ucsf: 'UCSF Medical Center',
  sfgeneral: 'Zuckerberg San Francisco General Hospital',
  sfcounty: 'San Francisco Department of Public Health',
  stanford: 'Stanford Health Care',
  dignity: 'Dignity Health',
  johnmuir: 'John Muir Health',
  any: '',
};

// Unit name mappings
const UNIT_NAMES: Record<string, string[]> = {
  icu: ['ICU', 'intensive care', 'critical care'],
  pcu: ['PCU', 'stepdown', 'progressive care'],
  dou: ['DOU', 'observation'],
  tele: ['telemetry', 'tele'],
  er: ['emergency', 'ER', 'ED'],
  medsurg: ['med-surg', 'medical surgical'],
};

// Job type mappings
const JOB_TYPE_NAMES: Record<string, string[]> = {
  staff: ['staff nurse', 'full-time'],
  'per-diem': ['per diem', 'PRN'],
  travel: ['travel nurse', 'travel nursing'],
  contract: ['contract'],
  any: [],
};

interface BraveResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveResponse {
  web?: {
    results: BraveResult[];
  };
}

async function searchBrave(query: string, count: number = 15): Promise<BraveResult[]> {
  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
  
  if (!BRAVE_API_KEY) {
    throw new Error('BRAVE_API_KEY not configured');
  }

  const params = new URLSearchParams({
    q: query,
    count: count.toString(),
    freshness: 'pm', // Past month
    country: 'US',
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': BRAVE_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brave API error: ${response.status} - ${error}`);
  }

  const data: BraveResponse = await response.json();
  return data.web?.results || [];
}

function buildSearchQuery(
  hospitals: string[],
  units: string[],
  jobTypes: string[],
  location: string
): string {
  // Keep it simple for better Brave results
  const parts: string[] = [];

  // Core: location + nursing jobs
  parts.push(`${location} nursing jobs RN`);

  // Add ONE hospital if specific (not "any")
  const hospitalNames = hospitals
    .filter((h) => h !== 'any')
    .map((h) => HOSPITAL_NAMES[h])
    .filter(Boolean);
  
  if (hospitalNames.length === 1) {
    parts.push(hospitalNames[0]);
  }

  // Add ONE unit type
  const unitTerms = units.map((u) => UNIT_NAMES[u]?.[0]).filter(Boolean);
  if (unitTerms.length > 0) {
    parts.push(unitTerms[0]); // Just first one to keep query simple
  }

  // Job types - add if specific
  if (jobTypes.includes('per-diem') && !jobTypes.includes('staff')) {
    parts.push('per diem');
  }
  if (jobTypes.includes('travel')) {
    parts.push('travel');
  }

  return parts.join(' ');
}

function extractPay(text: string): string | null {
  const patterns = [
    /\$[\d,]+(?:\.\d{2})?\s*[-–]\s*\$[\d,]+(?:\.\d{2})?\s*(?:\/hr|\/hour|per hour|hourly)?/i,
    /\$[\d,]+(?:\.\d{2})?\s*(?:\/hr|\/hour|per hour|hourly)/i,
    /\$[\d,]+(?:\.\d{2})?\s*[-–]\s*\$[\d,]+(?:\.\d{2})?\s*(?:\/wk|\/week|per week|weekly)/i,
    /\$[\d,]+\s*[-–]\s*\$[\d,]+\s*(?:per|a)\s*(?:hour|week|year)/i,
    /\$[\d,]+\+?\s*(?:\/hr|\/hour|per hour)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return null;
}

function extractFacility(title: string, text: string): string {
  const hospitals = [
    'Kaiser Permanente',
    'Kaiser',
    'Sutter Health',
    'Sutter',
    'UCSF',
    'Zuckerberg San Francisco General',
    'SF General',
    'SFGH',
    'San Francisco General',
    'SF Department of Public Health',
    'SF DPH',
    'SFDPH',
    'Stanford Health',
    'Stanford',
    'Dignity Health',
    'John Muir',
    'Alta Bates',
    'El Camino',
    'Good Samaritan',
    'Regional Medical',
    'AMN Healthcare',
    'Incredible Health',
    'Aya Healthcare',
    'Cross Country',
    'Laguna Honda',
  ];

  const combined = `${title} ${text}`;
  for (const hospital of hospitals) {
    if (combined.toLowerCase().includes(hospital.toLowerCase())) {
      return hospital;
    }
  }

  // Try to extract from URL patterns
  if (combined.includes('indeed')) return 'Indeed';
  if (combined.includes('linkedin')) return 'LinkedIn';
  if (combined.includes('glassdoor')) return 'Glassdoor';
  if (combined.includes('ziprecruiter')) return 'ZipRecruiter';

  return 'Healthcare Facility';
}

function extractJobType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('travel')) return 'Travel';
  if (lower.includes('per diem') || lower.includes('prn')) return 'Per Diem';
  if (lower.includes('contract') && !lower.includes('travel')) return 'Contract';
  if (lower.includes('full-time') || lower.includes('permanent')) return 'Full-time';
  if (lower.includes('part-time')) return 'Part-time';
  return 'Staff';
}

function extractLocation(text: string, defaultLocation: string): string {
  // Try to find city, CA pattern
  const match = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*(?:CA|California)/i);
  if (match) return match[0];
  return defaultLocation;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hospitals, units, jobTypes, location } = body;

    if (!hospitals?.length || !units?.length || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Build multiple search queries for better coverage
    const queries: string[] = [];
    
    // Create queries for each hospital (or general if "any")
    const hospitalList = hospitals.includes('any') 
      ? ['any'] 
      : hospitals;
    
    // Primary unit to search
    const primaryUnit = units[0];
    
    for (const hospital of hospitalList.slice(0, 3)) {
      const query = buildSearchQuery([hospital], [primaryUnit], jobTypes, location);
      queries.push(query);
    }
    
    // Add one more query for secondary unit if exists
    if (units.length > 1) {
      queries.push(buildSearchQuery(['any'], [units[1]], jobTypes, location));
    }

    console.log('Search queries:', queries);

    // Run searches in parallel
    const allResultsArrays = await Promise.all(
      queries.map(q => searchBrave(q, 10).catch(() => []))
    );
    
    // Flatten and dedupe by URL
    const seenUrls = new Set<string>();
    const results: BraveResult[] = [];
    for (const arr of allResultsArrays) {
      for (const result of arr) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          results.push(result);
        }
      }
    }
    
    console.log('Total Brave results:', results.length);

    // Transform results into job listings
    const jobs = results.map((result) => {
      const text = `${result.title} ${result.description}`;
      return {
        title: result.title.replace(/\s*\|.*$/, '').replace(/\s*-\s*[^-]+$/, '').trim() || 'Nursing Position',
        facility: extractFacility(result.title, result.description),
        location: extractLocation(text, location),
        pay: extractPay(text) || '',
        type: extractJobType(text),
        url: result.url,
        snippet: result.description.slice(0, 250) + (result.description.length > 250 ? '...' : ''),
        age: result.age,
      };
    });

    // Filter to only actual job postings (not news, schools, articles)
    const nursingJobs = jobs.filter((job) => {
      const combined = `${job.title} ${job.snippet} ${job.url}`.toLowerCase();
      
      // Must be nursing related
      const isNursing = (
        combined.includes('nurse') ||
        combined.includes('nursing') ||
        combined.includes('rn ') ||
        combined.includes(' rn') ||
        combined.includes('registered') ||
        combined.includes('icu') ||
        combined.includes('critical care') ||
        combined.includes('stepdown') ||
        combined.includes('pcu') ||
        combined.includes('telemetry')
      );
      
      // Exclude non-job content
      const isNotJob = (
        combined.includes('nursing school') ||
        combined.includes('rn program') ||
        combined.includes('highest paid') ||
        combined.includes('salary guide') ||
        combined.includes('news') ||
        combined.includes('abc7') ||
        combined.includes('rally') ||
        combined.includes('protest') ||
        combined.includes('killed') ||
        combined.includes('murdered') ||
        combined.includes('ice ') ||
        job.url.includes('learn.org') ||
        job.url.includes('indeed.com/career') ||
        job.url.includes('bandana.com') ||
        job.url.includes('abc7news')
      );
      
      // Must look like a job posting
      const looksLikeJob = (
        combined.includes('hiring') ||
        combined.includes('apply') ||
        combined.includes('job') ||
        combined.includes('position') ||
        combined.includes('career') ||
        combined.includes('opportunity') ||
        job.url.includes('jobs.') ||
        job.url.includes('/job/') ||
        job.url.includes('/careers') ||
        job.url.includes('vivian.com') ||
        job.url.includes('indeed.com/viewjob')
      );
      
      return isNursing && !isNotJob && looksLikeJob;
    });

    return NextResponse.json({ 
      jobs: nursingJobs, 
      queries,
      total: nursingJobs.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
