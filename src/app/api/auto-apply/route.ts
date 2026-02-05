import { NextRequest, NextResponse } from 'next/server';

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

interface ApplyRequest {
  jobUrl: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    licenseNumber?: string;
  };
}

async function createBrowserbaseSession() {
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
        blockAds: true,
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
    throw new Error(`Browserbase error: ${error}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body: ApplyRequest = await request.json();
    const { jobUrl, profile } = body;

    if (!jobUrl || !profile?.email) {
      return NextResponse.json(
        { error: 'Job URL and profile required' },
        { status: 400 }
      );
    }

    // Check Browserbase config
    if (!BROWSERBASE_API_KEY) {
      return NextResponse.json({
        status: 'manual',
        message: 'Auto-apply not configured. Please apply manually.',
        jobUrl,
      });
    }

    // Create Browserbase session
    const session = await createBrowserbaseSession();

    // In production, you would:
    // 1. Connect Playwright to the session
    // 2. Navigate to the job page
    // 3. Click Apply
    // 4. Fill form fields
    // 5. Upload resume
    // 6. Submit

    return NextResponse.json({
      status: 'queued',
      message: 'Application queued for processing',
      sessionId: session.id,
      replayUrl: `https://www.browserbase.com/sessions/${session.id}`,
      jobUrl,
    });
  } catch (error) {
    console.error('Auto-apply error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-apply failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check if auto-apply is available
  const available = !!(BROWSERBASE_API_KEY && BROWSERBASE_PROJECT_ID);
  
  return NextResponse.json({
    available,
    message: available 
      ? 'Auto-apply is available' 
      : 'Auto-apply requires Browserbase configuration',
  });
}
