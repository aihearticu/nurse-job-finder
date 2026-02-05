'use client';

import { useState, useRef } from 'react';

interface Job {
  title: string;
  facility: string;
  location: string;
  pay: string;
  type: string;
  url: string;
  snippet: string;
}

const HOSPITALS = [
  { value: 'kaiser', label: 'Kaiser Permanente' },
  { value: 'sutter', label: 'Sutter Health' },
  { value: 'ucsf', label: 'UCSF Medical Center' },
  { value: 'sfgeneral', label: 'SF General / Zuckerberg' },
  { value: 'sfcounty', label: 'SF County / DPH' },
  { value: 'stanford', label: 'Stanford Health Care' },
  { value: 'dignity', label: 'Dignity Health' },
  { value: 'johnmuir', label: 'John Muir Health' },
  { value: 'any', label: 'Any Hospital' },
];

const UNITS = [
  { value: 'icu', label: 'ICU / Critical Care' },
  { value: 'pcu', label: 'PCU / Stepdown' },
  { value: 'dou', label: 'DOU / Observation' },
  { value: 'tele', label: 'Telemetry' },
  { value: 'er', label: 'Emergency Room' },
  { value: 'medsurg', label: 'Med-Surg' },
];

const JOB_TYPES = [
  { value: 'staff', label: 'Staff / Full-time' },
  { value: 'per-diem', label: 'Per Diem' },
  { value: 'travel', label: 'Travel Nursing' },
  { value: 'contract', label: 'Contract' },
  { value: 'any', label: 'Any Type' },
];

export default function Home() {
  const [hospitals, setHospitals] = useState<string[]>(['kaiser', 'sutter', 'ucsf']);
  const [units, setUnits] = useState<string[]>(['icu', 'pcu', 'tele']);
  const [jobTypes, setJobTypes] = useState<string[]>(['staff', 'per-diem']);
  const [location, setLocation] = useState('San Francisco, CA');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(false);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSelection = (
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const handleAutoApply = async (job: Job) => {
    if (!resumeFile) {
      setError('Please upload your resume first');
      return;
    }
    
    setApplyingTo(job.url);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('jobUrl', job.url);
      formData.append('jobTitle', job.title);
      formData.append('facility', job.facility);
      
      const res = await fetch('/api/auto-apply', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Auto-apply failed');
      }
      
      alert(`✅ Application submitted to ${job.facility}!\n\nCheck your email for confirmation.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-apply failed');
    } finally {
      setApplyingTo(null);
    }
  };

  const searchJobs = async () => {
    setLoading(true);
    setError('');
    setJobs([]);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitals, units, jobTypes, location }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">
            🏥 NurseJobFinder
          </h1>
          <p className="text-gray-600">
            Find nursing jobs at top hospitals • Auto-apply coming soon
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          {/* Location */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., San Francisco, Bay Area, CA"
            />
          </div>

          {/* Hospitals */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Hospitals
            </label>
            <div className="flex flex-wrap gap-2">
              {HOSPITALS.map((h) => (
                <button
                  key={h.value}
                  onClick={() => toggleSelection(h.value, hospitals, setHospitals)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    hospitals.includes(h.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Units */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit / Specialty
            </label>
            <div className="flex flex-wrap gap-2">
              {UNITS.map((u) => (
                <button
                  key={u.value}
                  onClick={() => toggleSelection(u.value, units, setUnits)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    units.includes(u.value)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Job Types */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Type
            </label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleSelection(t.value, jobTypes, setJobTypes)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    jobTypes.includes(t.value)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resume Upload for Auto-Apply */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                🤖 Auto-Apply (Beta)
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApplyEnabled}
                  onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${autoApplyEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${autoApplyEnabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
                </div>
              </label>
            </div>
            
            {autoApplyEnabled && (
              <div className="space-y-3">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-4 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:border-purple-500 hover:bg-purple-50 transition-colors"
                  >
                    {resumeFile ? (
                      <span>📄 {resumeFile.name}</span>
                    ) : (
                      <span>📤 Upload Resume (PDF)</span>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  When enabled, clicking &quot;Apply&quot; will auto-fill applications using your resume via Browserbase.
                </p>
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            onClick={searchJobs}
            disabled={loading || hospitals.length === 0 || units.length === 0}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Searching...
              </span>
            ) : (
              '🔍 Search Jobs'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {jobs.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Found {jobs.length} Jobs
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.map((job, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {job.title}
                    </h3>
                    {job.pay && (
                      <span className="bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded">
                        {job.pay}
                      </span>
                    )}
                  </div>
                  <p className="text-blue-600 font-medium mb-1">{job.facility}</p>
                  <p className="text-gray-500 text-sm mb-2">
                    📍 {job.location} • {job.type}
                  </p>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {job.snippet}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                      View →
                    </a>
                    {autoApplyEnabled && resumeFile && (
                      <button
                        onClick={() => handleAutoApply(job)}
                        disabled={applyingTo === job.url}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
                      >
                        {applyingTo === job.url ? '⏳ Applying...' : '🤖 Auto Apply'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && jobs.length === 0 && !error && (
          <div className="text-center text-gray-500 py-12">
            <p className="text-6xl mb-4">🩺</p>
            <p>Select your preferences and search for jobs</p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-gray-400 text-sm mt-12 py-4 border-t">
          Built with ❤️ for nurses by{' '}
          <a
            href="https://mentius.ai"
            className="text-blue-500 hover:underline"
          >
            Mentius
          </a>
          {' '}by{' '}
          <a
            href="https://twitter.com/AIHeartICU"
            className="text-blue-500 hover:underline"
          >
            @AIHeartICU
          </a>
        </footer>
      </div>
    </main>
  );
}
