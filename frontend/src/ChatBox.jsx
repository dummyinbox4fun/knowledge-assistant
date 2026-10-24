import { useEffect, useRef, useState } from "react";
import { BACKEND_URL, authHeaders } from "./apiConfig";
import { ArrowUpIcon, PlusIcon } from "./icons";

const REQUEST_TIMEOUT_MS = 90000;

const SUGGESTIONS = [
  { label: "Summarize a document", prompt: "Summarize my notes in three points" },
  { label: "Key points", prompt: "What are the key points in my notes?" },
  { label: "Find a definition", prompt: "Define the main terms used in my notes" },
  { label: "Compare two notes", prompt: "Compare the main ideas across my documents" },
];

function ChatBox({ emptyState = null, onAttach }) {
  const [questionText, setQuestionText] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  // Keep the newest message in view (optional call: jsdom has no scrollIntoView)
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [answer, loading, error]);

  function pickSuggestion(prompt) {
    setQuestionText(prompt);
    inputRef.current?.focus();
  }

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${BACKEND_URL}/generation/answer`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ query: questionText, top_k: 5 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Request failed (${response.status})`);
      }

      const data = await response.json();
      setAnswer(data.answer);
      setSources(data.sources);
    } catch (err) {
      if (err.name === "AbortError") {
        setError("The server is taking too long to respond. Please try again.");
      } else {
        setError(err.message || "Something went wrong");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  const showEmpty = !askedQuestion && !error;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-8" aria-live="polite">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 py-4 md:short:py-2">
          {/* my-auto centers the welcome content but never clips it when the window is very short */}
          {showEmpty && <div className="my-auto">{emptyState}</div>}

          {askedQuestion && (
            <div className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white">
                {askedQuestion}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3">
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
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
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
      </div>

      <div className="shrink-0 px-3 pb-3 sm:px-8 md:pb-7 md:short:pb-3">
        <div className="mx-auto w-full max-w-3xl rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(60,60,120,0.08)] md:short:p-2.5">
          <div className="flex justify-between gap-3 px-1 pb-2 text-xs text-slate-500">
            <span>Answers are grounded in your uploaded documents</span>
            <span className="hidden shrink-0 sm:inline">Powered by Gemini</span>
          </div>

          <form
            onSubmit={handleAsk}
            className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-indigo-200"
          >
            {onAttach && (
              <button
                type="button"
                onClick={onAttach}
                aria-label="Attach a document"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-transparent p-0 text-slate-600 hover:bg-slate-200"
              >
                <PlusIcon />
              </button>
            )}
            <input
              id="question-input"
              ref={inputRef}
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Example: Summarize my notes in three points"
              aria-label="Your question"
              className="min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-[15px] focus:border-transparent focus:ring-0"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? "Thinking..." : "Ask"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-900 p-0 text-white hover:bg-slate-700"
            >
              {loading ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              ) : (
                <ArrowUpIcon />
              )}
            </button>
          </form>

          <div className="flex gap-2 overflow-x-auto pt-3 sm:flex-wrap sm:overflow-visible md:short:pt-2">
            {SUGGESTIONS.map(({ label, prompt }) => (
              <button
                key={label}
                type="button"
                onClick={() => pickSuggestion(prompt)}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-200 md:short:py-1.5"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;