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
  const [userPapers, setUserPapers] = useState(() => {
    const saved = localStorage.getItem("userPapers");
    return saved ? JSON.parse(saved) : [];
  });
  const [form, setForm] = useState({ name: "", title: "", topic: "", link: "" });
  const timer = useRef(null);

  useEffect(() => {
    localStorage.setItem("userPapers", JSON.stringify(userPapers));
  }, [userPapers]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(userPapers);
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
  }, [query, includeArxiv, userPapers]);

  async function performSearch(q) {
    try {
      const [crossref, arxiv] = await Promise.all([
        fetchCrossRef(q),
        includeArxiv ? fetchArXiv(q) : Promise.resolve([]),
      ]);

      const merged = [...userPapers, ...crossref, ...arxiv].filter((r) =>
        r.title.toLowerCase().includes(q.toLowerCase()) ||
        (r.topic && r.topic.toLowerCase().includes(q.toLowerCase()))
      );

      setResults(merged);
    } catch (err) {
      setError("Something went wrong while searching.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.title || !form.topic || !form.link) return;

    setUserPapers((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: form.title,
        authors: [form.name],
        year: new Date().getFullYear(),
        link: form.link,
        topic: form.topic,
        source: "User Submitted",
        pdf: form.link,
      },
    ]);

    setForm({ name: "", title: "", topic: "", link: "" });
  }

  // keep rest of component as-is below
