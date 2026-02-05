import { NextRequest, NextResponse } from 'next/server';

// Curated job sources - reliable direct links
const JOB_SOURCES = {
  kaiser: [
    { title: 'Staff Nurse II ICU', facility: 'Kaiser Permanente', location: 'San Francisco', pay: '$85-101/hr', type: 'Part-time', unit: 'ICU', url: 'https://www.kaiserpermanentejobs.org/job/san-francisco/staff-nurse-ii-icu/641/82192568976' },
    { title: 'ICU RN Rapid Response Per Diem', facility: 'Kaiser Permanente', location: 'Los Angeles', pay: '', type: 'Per Diem', unit: 'ICU', url: 'https://www.kaiserpermanentejobs.org/job/los-angeles/specialty-unit-icu-rn-rapid-response-perdiem-night/641/90577396656' },
    { title: 'Float ICU/Tele 32hr Day', facility: 'Kaiser Permanente', location: 'South San Francisco', pay: '', type: 'Part-time', unit: 'ICU', url: 'https://www.kaiserpermanentejobs.org/job/south-san-francisco/staff-nurse-ii-float-icu-tele-32-hours-wk-day-shift/641/81516416816' },
    { title: 'ICU 24hr Day Shift', facility: 'Kaiser Permanente', location: 'Oakland', pay: '', type: 'Part-time', unit: 'ICU', url: 'https://www.kaiserpermanentejobs.org/job/oakland/staff-nurse-ii-icu-24-hour-day-oakland/641/79886381040' },
    { title: 'ICU Night 32hr', facility: 'Kaiser Permanente', location: 'San Leandro', pay: '', type: 'Part-time', unit: 'ICU', url: 'https://www.kaiserpermanentejobs.org/job/san-leandro/staff-nurse-ii-san-leandro-icu-night-32/641/86001203792' },
    { title: 'Tele High Acuity Night', facility: 'Kaiser Permanente', location: 'South San Francisco', pay: '', type: 'Part-time', unit: 'Telemetry', url: 'https://www.kaiserpermanentejobs.org/job/south-san-francisco/staff-nurse-ii-telemetry-high-acuity-24-hour-wk-night-shift/641/82517882576' },
    { title: 'ICU Per Diem Nights', facility: 'Kaiser Permanente', location: 'Baldwin Park', pay: '', type: 'Per Diem', unit: 'ICU', url: 'https://www.kaiserpermanentejobs.org/job/baldwin-park/specialty-unit-staff-rn-hospital-icu-per-diem-nights/641/78534163936' },
    { title: 'Med/Surg Tele Per Diem', facility: 'Kaiser Permanente', location: 'San Diego', pay: '', type: 'Per Diem', unit: 'Telemetry', url: 'https://www.kaiserpermanentejobs.org/job/san-diego/staff-rn-med-surg-telemetry-per-diem-nights-san-diego/641/85715462448' },
    { title: 'Float ICU/Med-Surg/Tele', facility: 'Kaiser Permanente', location: 'Vacaville', pay: '', type: 'Full-time', unit: 'ICU', url: 'https://www.kaiserpermanentejobs.org/job/vacaville/staff-nurse-ii-float-icu-med-surg-tele-float/641/86190259776' },
  ],
  sutter: [
    { title: 'Staff Nurse II, ICU', facility: 'Sutter Health', location: 'Antioch', pay: '', type: 'Full-time', unit: 'ICU', url: 'https://jobs.sutterhealth.org/us/en/job/R-118869/Staff-Nurse-II-ICU' },
    { title: 'Registered Nurse, ICU', facility: 'Sutter Health', location: 'Bay Area', pay: '', type: 'Full-time', unit: 'ICU', url: 'https://jobs.sutterhealth.org/us/en/job/R-121889/Registered-Nurse-ICU' },
    { title: 'Staff Nurse II, ICU', facility: 'Sutter Health', location: 'Bay Area', pay: '', type: 'Full-time', unit: 'ICU', url: 'https://jobs.sutterhealth.org/us/en/job/R-120932/Staff-Nurse-II-ICU' },
    { title: 'Staff Nurse II, ICU', facility: 'Sutter Health', location: 'Bay Area', pay: '', type: 'Full-time', unit: 'ICU', url: 'https://jobs.sutterhealth.org/us/en/job/R-120931/Staff-Nurse-II-ICU' },
    { title: 'Registered Nurse II, ICU', facility: 'Sutter Health', location: 'Bay Area', pay: '', type: 'Full-time', unit: 'ICU', url: 'https://jobs.sutterhealth.org/us/en/job/R-113213/Registered-Nurse-II-ICU' },
    { title: 'Staff Nurse II, ICU', facility: 'Sutter Health', location: 'Bay Area', pay: '', type: 'Full-time', unit: 'ICU', url: 'https://jobs.sutterhealth.org/us/en/job/R-118864/Staff-Nurse-II-ICU' },
    { title: 'Staff Nurse II, Medical Telemetry', facility: 'Sutter Health', location: 'Bay Area', pay: '', type: 'Full-time', unit: 'Telemetry', url: 'https://jobs.sutterhealth.org/us/en/job/R-118152/Staff-Nurse-II-Medical-Telemetry' },
    { title: 'Telemetry PCU5', facility: 'Sutter Health', location: 'Oakland', pay: '', type: 'Full-time', unit: 'PCU/Stepdown', url: 'https://www.linkedin.com/jobs/view/staff-nurse-ii-telemetry-pcu5-at-sutter-health-4273782244' },
  ],
  ucsf: [
    { title: 'Registered Nurse, Per Diem', facility: 'UCSF Medical Center', location: 'San Francisco', pay: '', type: 'Per Diem', unit: 'General', url: 'https://www.linkedin.com/jobs/view/registered-nurse-per-diem-at-ucsf-health-4250399569' },
  ],
  other: [
    { title: 'Travel Tele RN', facility: 'AMN Healthcare', location: 'San Francisco', pay: '$2200-3500/wk', type: 'Travel', unit: 'Telemetry', url: 'https://www.amnhealthcare.com/careers/nursing/apply/travel-telemetry-rn-nursing-jobs-in-san-francisco-ca-for-rn/' },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hospitals = ['kaiser', 'sutter', 'ucsf'], units = ['icu'], jobTypes = ['staff', 'per-diem'], location = 'San Francisco' } = body;

    // Collect jobs from selected sources
    let allJobs: any[] = [];
    
    for (const hospital of hospitals) {
      const jobs = JOB_SOURCES[hospital as keyof typeof JOB_SOURCES] || [];
      allJobs = [...allJobs, ...jobs];
    }
    
    // Always include "other" sources
    allJobs = [...allJobs, ...JOB_SOURCES.other];

    // Filter by unit
    const unitMap: Record<string, string> = {
      icu: 'ICU',
      pcu: 'PCU/Stepdown',
      tele: 'Telemetry',
      er: 'Emergency',
      medsurg: 'Med-Surg',
    };
    
    const selectedUnits = units.map((u: string) => unitMap[u] || u);
    
    let filteredJobs = allJobs.filter(job => 
      selectedUnits.some(unit => job.unit.toLowerCase().includes(unit.toLowerCase()))
    );

    // Filter by job type
    const typeMap: Record<string, string[]> = {
      'staff': ['Full-time', 'Part-time'],
      'per-diem': ['Per Diem'],
      'travel': ['Travel'],
      'contract': ['Contract'],
    };
    
    const selectedTypes = jobTypes.flatMap((t: string) => typeMap[t] || [t]);
    
    filteredJobs = filteredJobs.filter(job =>
      selectedTypes.some(type => job.type.toLowerCase().includes(type.toLowerCase()))
    );

    // Add snippet and payNumeric
    const jobs = filteredJobs.map(job => ({
      ...job,
      snippet: `${job.type} position at ${job.facility}`,
      payNumeric: job.pay ? parseFloat(job.pay.replace(/[^0-9.]/g, '')) : 0,
    }));

    // Sort by pay
    jobs.sort((a, b) => b.payNumeric - a.payNumeric);

    return NextResponse.json({
      jobs,
      total: jobs.length,
      note: 'Showing curated job listings. Use CLI agent for live search.',
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
