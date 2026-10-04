import { useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function SearchBox() {
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();

    if (!queryText.trim()) {
      setError("Please enter a search query");
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(`${BACKEND_URL}/retrieval/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText, top_k: 5 }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Search failed (${response.status})`);
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Search your notes</h2>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Ask something about your notes..."
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {results && results.length === 0 && (
        <p>No matching content found. Try uploading some documents first.</p>
      )}

      {results && results.length > 0 && (
        <ul>
          {results.map((result, index) => (
            <li key={`${result.filename}-${result.position}-${index}`}>
              <strong>{result.filename}</strong> (chunk {result.position}, distance{" "}
              {result.distance.toFixed(3)})
              <p>{result.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchBox;
