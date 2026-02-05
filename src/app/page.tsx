'use client';

import { useState } from 'react';

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
}

export default function Home() {
  const [query, setQuery] = useState('ICU RN');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [searchedQuery, setSearchedQuery] = useState('');

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
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setJobs([]);
    setSelectedJobs(new Set());

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), location: location.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setJobs(data.jobs || []);
      setSearchedQuery(data.query || query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') searchJobs();
  };

  const getUnitBadge = (unit: string) => {
    const colors: Record<string, string> = {
      'ICU': 'bg-red-500',
      'PCU/Stepdown': 'bg-orange-500',
      'Telemetry': 'bg-pink-500',
      'Emergency': 'bg-yellow-500',
      'Med-Surg': 'bg-blue-500',
      'Cardiac': 'bg-purple-500',
      'NICU': 'bg-green-500',
    };
    return colors[unit] || 'bg-gray-500';
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-white">
            NurseJobFinder
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered nursing job search
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="bg-slate-900 rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-2">What are you looking for?</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="ICU RN, Travel Nurse, Per Diem Tele..."
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:w-64">
              <label className="block text-xs text-slate-400 mb-2">Location (optional)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="San Francisco, Los Angeles..."
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:self-end">
              <button
                onClick={searchJobs}
                disabled={loading || !query.trim()}
                className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
          
          {/* Quick filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            {['ICU RN', 'Travel Nurse', 'Per Diem', 'PCU Stepdown', 'Telemetry', 'ER Nurse', 'NICU', 'Kaiser', 'Sutter'].map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  query === term 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {jobs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-slate-400">Found </span>
                <span className="text-white font-medium">{jobs.length} jobs</span>
                {searchedQuery && (
                  <span className="text-slate-500 text-sm ml-2">for "{searchedQuery}"</span>
                )}
              </div>
              {selectedJobs.size > 0 && (
                <button className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                  Apply to {selectedJobs.size} selected
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {jobs.map((job, i) => (
                <div
                  key={i}
                  className={`bg-slate-900 rounded-lg p-4 border transition-colors ${
                    selectedJobs.has(job.url) 
                      ? 'border-blue-500 bg-slate-900/80' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.url)}
                      onChange={() => toggleJobSelection(job.url)}
                      className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-white truncate">
                            {job.title}
                          </h3>
                          <p className="text-slate-400 text-sm">
                            {job.facility} · {job.location}
                          </p>
                        </div>
                        {job.pay && (
                          <span className="text-green-400 font-medium whitespace-nowrap">
                            {job.pay}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full text-white ${getUnitBadge(job.unit)}`}>
                          {job.unit}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                          {job.type}
                        </span>
                      </div>
                      
                      {job.snippet && (
                        <p className="text-slate-500 text-sm mt-2 line-clamp-2">
                          {job.snippet}
                        </p>
                      )}
                    </div>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                      View →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🏥</div>
            <p className="text-slate-400">Search for nursing jobs anywhere</p>
            <p className="text-slate-500 text-sm mt-1">Try "ICU RN Los Angeles" or "Travel Nurse Texas"</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
          Powered by <a href="https://exa.ai" className="text-blue-400 hover:underline">Exa AI</a> · 
          Built by <a href="https://mentius.ai" className="text-blue-400 hover:underline">Mentius</a>
        </div>
      </footer>
    </main>
  );
}
