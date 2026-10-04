import { useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function ChatBox() {
  const [questionText, setQuestionText] = useState("");
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAsk(e) {
    e.preventDefault();

    if (!questionText.trim()) {
      setError("Please enter a question");
      setAnswer(null);
      setSources([]);
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      const response = await fetch(`${BACKEND_URL}/generation/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: questionText, top_k: 5 }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Request failed (${response.status})`);
      }

      const data = await response.json();
      setAnswer(data.answer);
      setSources(data.sources);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Ask your notes</h2>
      <form onSubmit={handleAsk}>
        <input
          type="text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Ask a question about your notes..."
        />
        <button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {answer && (
        <div>
          <h3>Answer</h3>
          <p>{answer}</p>

          {sources.length > 0 && (
            <>
              <h4>Sources</h4>
              <ul>
                {sources.map((source, index) => (
                  <li key={`${source.filename}-${source.position}-${index}`}>
                    {source.filename} (chunk {source.position}, distance{" "}
                    {source.distance.toFixed(3)})
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatBox;
