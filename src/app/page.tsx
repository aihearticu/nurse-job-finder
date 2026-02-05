'use client';

import { useState, useRef } from 'react';

interface Job {
  title: string;
  facility: string;
  location: string;
  pay: string;
  payNumeric: number;
  type: string;
  unit: string;
  url: string;
  snippet: string;
  postedDate?: string;
}

const HOSPITALS = [
  { value: 'kaiser', label: 'Kaiser Permanente', color: 'blue' },
  { value: 'sutter', label: 'Sutter Health', color: 'green' },
  { value: 'ucsf', label: 'UCSF Medical', color: 'yellow' },
  { value: 'sfgeneral', label: 'SF General', color: 'red' },
  { value: 'stanford', label: 'Stanford', color: 'purple' },
  { value: 'dignity', label: 'Dignity Health', color: 'pink' },
  { value: 'sharp', label: 'Sharp Healthcare', color: 'indigo' },
  { value: 'any', label: 'All Hospitals', color: 'gray' },
];

const UNITS = [
  { value: 'icu', label: 'ICU', emoji: '🏥' },
  { value: 'pcu', label: 'PCU/Stepdown', emoji: '📊' },
  { value: 'tele', label: 'Telemetry', emoji: '💓' },
  { value: 'er', label: 'Emergency', emoji: '🚨' },
  { value: 'medsurg', label: 'Med-Surg', emoji: '💊' },
  { value: 'cardiac', label: 'Cardiac', emoji: '❤️' },
];

const JOB_TYPES = [
  { value: 'staff', label: 'Staff/Full-time' },
  { value: 'per-diem', label: 'Per Diem/PRN' },
  { value: 'travel', label: 'Travel' },
  { value: 'contract', label: 'Contract' },
];

const LOCATIONS = [
  'San Francisco, CA',
  'San Francisco Bay Area',
  'Oakland, CA',
  'San Jose, CA',
  'Los Angeles, CA',
  'San Diego, CA',
  'Sacramento, CA',
];

export default function Home() {
  const [hospitals, setHospitals] = useState<string[]>(['kaiser', 'sutter', 'ucsf']);
  const [units, setUnits] = useState<string[]>(['icu', 'pcu', 'tele']);
  const [jobTypes, setJobTypes] = useState<string[]>(['staff', 'per-diem']);
  const [location, setLocation] = useState('San Francisco Bay Area');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  const toggleSelection = (value: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const toggleJobSelection = (url: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedJobs(newSelected);
  };

  const searchJobs = async () => {
    setLoading(true);
    setError('');
    setJobs([]);
    setSelectedJobs(new Set());

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitals, units, jobTypes, location }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const getUnitColor = (unit: string) => {
    const colors: Record<string, string> = {
      'ICU': 'bg-red-100 text-red-800',
      'PCU/Stepdown': 'bg-orange-100 text-orange-800',
      'Telemetry': 'bg-pink-100 text-pink-800',
      'Emergency': 'bg-yellow-100 text-yellow-800',
      'Med-Surg': 'bg-blue-100 text-blue-800',
      'Cardiac': 'bg-purple-100 text-purple-800',
      'NICU': 'bg-green-100 text-green-800',
    };
    return colors[unit] || 'bg-gray-100 text-gray-800';
  };

  const getFacilityColor = (facility: string) => {
    const colors: Record<string, string> = {
      'Kaiser Permanente': 'text-blue-600',
      'Sutter Health': 'text-green-600',
      'UCSF Medical Center': 'text-yellow-600',
      'Stanford Health Care': 'text-purple-600',
      'SF General': 'text-red-600',
      'Sharp Healthcare': 'text-indigo-600',
    };
    return colors[facility] || 'text-gray-600';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            🏥 NurseJobFinder
          </h1>
          <p className="text-gray-600 text-lg">
            Find your next nursing opportunity • Powered by AI
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-white/20">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📍 Location
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Hospitals */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🏥 Target Hospitals
                </label>
                <div className="flex flex-wrap gap-2">
                  {HOSPITALS.map((h) => (
                    <button
                      key={h.value}
                      onClick={() => toggleSelection(h.value, hospitals, setHospitals)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        hospitals.includes(h.value)
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Units */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🩺 Unit / Specialty
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNITS.map((u) => (
                    <button
                      key={u.value}
                      onClick={() => toggleSelection(u.value, units, setUnits)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        units.includes(u.value)
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {u.emoji} {u.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job Types */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💼 Job Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => toggleSelection(t.value, jobTypes, setJobTypes)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        jobTypes.includes(t.value)
                          ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={searchJobs}
            disabled={loading || units.length === 0}
            className="w-full mt-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching with AI...
              </span>
            ) : (
              '🔍 Search Jobs'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6">
            ❌ {error}
          </div>
        )}

        {/* Results */}
        {jobs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Found {jobs.length} Jobs
              </h2>
              {selectedJobs.size > 0 && (
                <button className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                  🤖 Auto-Apply to {selectedJobs.size} Selected
                </button>
              )}
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job, i) => (
                <div
                  key={i}
                  className={`bg-white rounded-xl shadow-md p-5 hover:shadow-xl transition-all duration-200 border-2 ${
                    selectedJobs.has(job.url) ? 'border-blue-500 bg-blue-50/50' : 'border-transparent'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight">
                        {job.title}
                      </h3>
                      <p className={`font-medium mt-1 ${getFacilityColor(job.facility)}`}>
                        {job.facility}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.url)}
                      onChange={() => toggleJobSelection(job.url)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUnitColor(job.unit)}`}>
                      {job.unit}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {job.type}
                    </span>
                    {job.pay && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                        💰 {job.pay}
                      </span>
                    )}
                  </div>

                  {/* Snippet */}
                  {job.snippet && (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                      {job.snippet}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Job →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && jobs.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🩺</div>
            <p className="text-gray-500 text-lg">Select your preferences and search for jobs</p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-gray-400 text-sm mt-16 py-6 border-t border-gray-200">
          Built with ❤️ for nurses by{' '}
          <a href="https://mentius.ai" className="text-blue-500 hover:underline">
            Mentius
          </a>
          {' '}•{' '}
          <a href="https://twitter.com/AIHeartICU" className="text-blue-500 hover:underline">
            @AIHeartICU
          </a>
        </footer>
      </div>
    </main>
  );
}
