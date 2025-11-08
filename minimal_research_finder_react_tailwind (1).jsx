import React, { useState, useEffect, useRef } from "react";

// Minimal Research Finder
// Single-file React component (default export) styled with Tailwind classes.
// Client-side fetches: CrossRef (works JSON) and arXiv (ATOM XML)
// Drop this into a React app (Vite / Create React App). Requires Tailwind CSS for styling.

export default function ResearchFinder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeArxiv, setIncludeArxiv] = useState(true);
  const timer = useRef(null);

  // debounce and search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      performSearch(query.trim());
    }, 450);

    return () => (timer.current ? clearTimeout(timer.current) : null);
  }, [query, includeArxiv]);

  async function performSearch(q) {
    try {
      const [crossref, arxiv] = await Promise.all([
        fetchCrossRef(q),
        includeArxiv ? fetchArXiv(q) : Promise.resolve([]),
      ]);

      // merge and sort by year (desc)
      const merged = [...crossref, ...arxiv].sort((a, b) => (b.year || 0) - (a.year || 0));
      setResults(merged);
    } catch (err) {
      setError("Something went wrong while searching.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // CrossRef JSON API
  async function fetchCrossRef(q) {
    const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(q)}&rows=8`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("CrossRef failed");
    const data = await res.json();
    return (data.message.items || []).map((it) => ({
      id: it.DOI || it.URL || it.id,
      title: (it.title && it.title[0]) || it.shortTitle || "(no title)",
      authors: (it.author || []).map((a) => `${a.given || ""} ${a.family || ""}`.trim()),
      year: it['published-print'] ? it['published-print']['date-parts'][0][0] : it['published-online'] ? it['published-online']['date-parts'][0][0] : it.created ? new Date(it.created['date-time']).getFullYear() : null,
      link: it.URL || (it.DOI ? `https://doi.org/${it.DOI}` : null),
      source: 'CrossRef',
      pdf: null,
    }));
  }

  // arXiv API (ATOM). Keeps it small: 6 results.
  async function fetchArXiv(q) {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=6`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("arXiv failed");
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");
    const entries = Array.from(xml.querySelectorAll('entry'));
    return entries.map((e) => {
      const title = (e.querySelector('title')?.textContent || '').trim();
      const id = e.querySelector('id')?.textContent || '';
      const authors = Array.from(e.querySelectorAll('author > name')).map((n) => n.textContent);
      const rawPublished = e.querySelector('published')?.textContent || '';
      const year = rawPublished ? new Date(rawPublished).getFullYear() : null;
      const pdfLink = Array.from(e.querySelectorAll('link')).find((l) => l.getAttribute('title') === 'pdf')?.getAttribute('href') || (id.replace('/abs/', '/pdf/') + '.pdf');
      return {
        id,
        title,
        authors,
        year,
        link: id,
        source: 'arXiv',
        pdf: pdfLink,
      };
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6">
      <div className="w-full max-w-3xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Research Finder</h1>
          <p className="mt-1 text-sm text-gray-500">Type a topic to find papers and research info (CrossRef + arXiv). Minimal & aesthetic.</p>
        </header>

        <div className="bg-white shadow-sm rounded-xl p-4">
          <div className="flex gap-3 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, e.g. " + 'neural networks, gene editing'"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={includeArxiv} onChange={(e) => setIncludeArxiv(e.target.checked)} />
              arXiv
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">Results: <span className="font-medium text-gray-700">{results.length}</span></div>
            <div className="text-xs text-gray-400">Tip: press enter or keep typing — search debounced.</div>
          </div>

          <div className="mt-4">
            {loading && (
              <div className="py-6 text-center text-sm text-gray-500">Searching...</div>
            )}

            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}

            {!loading && !error && results.length === 0 && query.trim() && (
              <div className="py-6 text-center text-sm text-gray-500">No results — try broader keywords.</div>
            )}

            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.id} className="p-3 rounded-lg border border-gray-100 hover:shadow transition-shadow bg-white">
                  <div className="flex justify-between gap-3">
                    <div>
                      <a href={r.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-gray-900 hover:underline">
                        {r.title}
                      </a>
                      <div className="mt-1 text-xs text-gray-500">{(r.authors || []).slice(0,4).join(', ')}{(r.authors || []).length > 4 ? '…' : ''} • {r.year || 'n.d.'}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-gray-400">{r.source}</div>
                      {r.pdf && (
                        <a className="inline-block mt-2 text-indigo-600 text-xs hover:underline" href={r.pdf} target="_blank" rel="noreferrer">PDF</a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="mt-6 text-xs text-gray-400">Powered by CrossRef &amp; arXiv • Client-side only • Free</footer>
          </div>
        </div>
      </div>
    </div>
  );
}
