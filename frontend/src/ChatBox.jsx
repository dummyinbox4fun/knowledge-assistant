import { useEffect, useRef, useState } from "react";
import { BACKEND_URL, authHeaders } from "./apiConfig";

function ChatBox() {
  const [questionText, setQuestionText] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  // Keep the newest message in view (optional call: jsdom has no scrollIntoView)
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [answer, loading, error]);

  async function handleAsk(e) {
    e.preventDefault();

    if (!questionText.trim()) {
      setError("Please enter a question");
      setAskedQuestion("");
      setAnswer(null);
      setSources([]);
      return;
    }

    setAskedQuestion(questionText);
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      const response = await fetch(`${BACKEND_URL}/generation/answer`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
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
    <div className="flex flex-col">
      <h2>Ask your notes</h2>

      <div className="min-h-64 space-y-4 py-2" aria-live="polite">
        {!askedQuestion && !error && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 text-center text-sm text-slate-500">
            Ask a question and the answer will appear here, grounded in your
            uploaded documents.
          </div>
        )}

        {askedQuestion && (
          <div className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white">
              {askedQuestion}
            </p>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="sr-only">Generating answer</span>
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {answer && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="mb-1 mt-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Answer
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>

              {sources.length > 0 && (
                <>
                  <h4 className="mb-2 mt-4">Sources</h4>
                  <ul className="flex flex-wrap gap-2">
                    {sources.map((source, index) => (
                      <li
                        key={`${source.filename}-${source.position}-${index}`}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                      >
                        {source.filename} (chunk {source.position}, distance{" "}
                        {source.distance.toFixed(3)})
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleAsk}
        className="mt-2 flex gap-2 border-t border-slate-200 pt-4"
      >
        <input
          type="text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Ask a question about your notes..."
          aria-label="Your question"
        />
        <button type="submit" disabled={loading} className="shrink-0">
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}

export default ChatBox;