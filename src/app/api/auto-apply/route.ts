import { NextRequest, NextResponse } from 'next/server';

// Browserbase API for stealth browser automation
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

interface ResumeData {
  name: string;
  email: string;
  phone: string;
  address?: string;
  experience: Array<{
    title: string;
    facility: string;
    dates: string;
    description?: string;
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  certifications: string[];
  skills: string[];
}

// Parse resume text (simplified - in production use a proper parser)
function parseResumeText(text: string): Partial<ResumeData> {
  const data: Partial<ResumeData> = {};
  
  // Extract email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) data.email = emailMatch[0];
  
  // Extract phone
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) data.phone = phoneMatch[0];
  
  // Extract certifications (common nursing certs)
  const certs: string[] = [];
  const certPatterns = ['RN', 'BSN', 'MSN', 'BLS', 'ACLS', 'PALS', 'CCRN', 'CEN', 'TNCC', 'NRP'];
  for (const cert of certPatterns) {
    if (text.toUpperCase().includes(cert)) {
      certs.push(cert);
    }
  }
  if (certs.length > 0) data.certifications = certs;
  
  return data;
}

async function createBrowserbaseSession(): Promise<{ sessionId: string; wsUrl: string }> {
  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    throw new Error('Browserbase not configured');
  }
  
  const response = await fetch('https://www.browserbase.com/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bb-api-key': BROWSERBASE_API_KEY,
    },
    body: JSON.stringify({
      projectId: BROWSERBASE_PROJECT_ID,
      browserSettings: {
        fingerprint: {
          devices: ['desktop'],
          locales: ['en-US'],
          operatingSystems: ['macos'],
        },
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Browserbase session failed: ${error}`);
  }
  
  const session = await response.json();
  return {
    sessionId: session.id,
    wsUrl: session.connectUrl,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const resumeFile = formData.get('resume') as File;
    const jobUrl = formData.get('jobUrl') as string;
    const jobTitle = formData.get('jobTitle') as string;
    const facility = formData.get('facility') as string;
    
    if (!resumeFile || !jobUrl) {
      return NextResponse.json(
        { error: 'Resume and job URL required' },
        { status: 400 }
      );
    }
    
    // Check Browserbase config
    if (!BROWSERBASE_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Auto-apply not configured yet. Browserbase API key needed.',
          status: 'not_configured'
        },
        { status: 503 }
      );
    }
    
    // Read resume content
    const resumeBuffer = await resumeFile.arrayBuffer();
    const resumeText = new TextDecoder().decode(resumeBuffer);
    
    // Parse resume (simplified)
    const resumeData = parseResumeText(resumeText);
    
    console.log('Auto-apply request:', {
      jobUrl,
      jobTitle,
      facility,
      resumeData,
    });
    
    // Create Browserbase session
    const session = await createBrowserbaseSession();
    
    // In a full implementation, we'd:
    // 1. Connect Playwright to the Browserbase session
    // 2. Navigate to jobUrl
    // 3. Find and fill the application form
    // 4. Upload the resume file
    // 5. Submit the application
    
    // For now, return a "queued" status
    return NextResponse.json({
      status: 'queued',
      message: `Application to ${facility} has been queued for auto-apply`,
      sessionId: session.sessionId,
      jobUrl,
      resumeData,
    });
    
  } catch (error) {
    console.error('Auto-apply error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-apply failed' },
      { status: 500 }
    );
  }
}
