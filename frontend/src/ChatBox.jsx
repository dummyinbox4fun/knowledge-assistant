import { useEffect, useRef, useState } from "react";
import {
  askInConversation,
  createConversation,
  deleteConversation,
  getConversation,
  titleFromQuestion,
} from "./conversationsApi";
import { ArrowUpIcon, PlusIcon } from "./icons";
import Markdown from "./Markdown";

const REQUEST_TIMEOUT_MS = 90000;
// How close to the bottom (in px) still counts as "reading the latest message".
const NEAR_BOTTOM_PX = 120;

const SUGGESTIONS = [
  { label: "Summarize a document", prompt: "Summarize my notes in three points" },
  { label: "Key points", prompt: "What are the key points in my notes?" },
  { label: "Find a definition", prompt: "Define the main terms used in my notes" },
  { label: "Compare two notes", prompt: "Compare the main ideas across my documents" },
];

// Add messages the thread does not already hold (a chat reloaded from the server
// can already contain the answer that is just arriving).
function mergeMessages(current, incoming) {
  const known = new Set(current.map((m) => m.id));
  return [...current, ...incoming.filter((m) => !known.has(m.id))];
}

function UserBubble({ children }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white">
        {children}
      </p>
    </div>
  );
}

function AssistantBubble({ message }) {
  const sources = Array.isArray(message.sources) ? message.sources : [];
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm leading-relaxed">
          <Markdown>{message.content}</Markdown>
        </div>

        {sources.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-xs font-semibold text-slate-500">Sources</p>
            <ul aria-label="Sources" className="flex flex-wrap gap-2">
              {sources.map((source, index) => (
                <li
                  key={`${source.filename}-${source.position}-${index}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                >
                  {source.filename} (chunk {source.position}, distance{" "}
                  {Number(source.distance).toFixed(3)})
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function ChatBox({
  conversationId = null,
  emptyState = null,
  onAttach,
  onConversationSaved,
  onNewChat,
}) {
  const [questionText, setQuestionText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadState, setLoadState] = useState("idle"); // idle | loading | ready | notfound | error
  const [pending, setPending] = useState(null); // { chatId, text } while an answer is awaited
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  // The chat on screen right now, readable from inside async code that outlives a render.
  const activeIdRef = useRef(conversationId);
  // A chat this component just created and filled in itself: when the address
  // changes to it, there is nothing to load.
  const createdIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = conversationId;
  }, [conversationId]);

  // Show the chat named by the address: empty for a new chat, loaded from the server otherwise.
  useEffect(() => {
    if (conversationId !== null && conversationId === createdIdRef.current) return undefined;
    createdIdRef.current = null;
    setError(null);

    if (!conversationId) {
      setMessages([]);
      setLoadState("idle");
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    setMessages([]);
    setLoadState("loading");
    getConversation(conversationId, { signal: controller.signal })
      .then((chat) => {
        if (cancelled) return;
        setMessages(chat.messages || []);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState(err.status === 404 || err.status === 422 ? "notfound" : "error");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [conversationId, reloadToken]);

  // Opening a different chat starts at the latest message.
  useEffect(() => {
    stickToBottomRef.current = true;
  }, [conversationId]);

  // Keep the newest message in view, unless the user has scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending, asking, error, loadState]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  function pickSuggestion(prompt) {
    setQuestionText(prompt);
    inputRef.current?.focus();
  }

  async function handleAsk(e) {
    e.preventDefault();
    if (asking) return;

    const text = questionText;
    if (!text.trim()) {
      setError("Please enter a question");
      return;
    }

    const startedFor = conversationId;
    stickToBottomRef.current = true;
    setError(null);
    setAsking(true);
    setPending({ chatId: startedFor, text });
    setQuestionText("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let newChat = null;

    try {
      let chatId = startedFor;
      if (!chatId) {
        newChat = await createConversation(titleFromQuestion(text));
        chatId = newChat.id;
      }

      const result = await askInConversation(chatId, text, { signal: controller.signal });
      const stillHere = activeIdRef.current === startedFor;

      if (stillHere) {
        setMessages((current) =>
          mergeMessages(current, [result.user_message, result.assistant_message])
        );
        if (newChat) createdIdRef.current = newChat.id;
      }

      const activeAt = result.assistant_message.created_at;
      if (newChat) {
        onConversationSaved?.({ ...newChat, updated_at: activeAt }, { open: stillHere });
      } else {
        onConversationSaved?.({ id: chatId, updated_at: activeAt }, { open: false });
      }
    } catch (err) {
      // The server saves nothing when answering fails, so don't leave an empty chat behind.
      if (newChat) deleteConversation(newChat.id).catch(() => {});

      if (activeIdRef.current === startedFor) {
        // Give the question back so the user can simply try again.
        setQuestionText((current) => current || text);
        setError(
          err.name === "AbortError"
            ? "The server is taking too long to respond. Please try again."
            : err.message || "Something went wrong"
        );
      }
    } finally {
      clearTimeout(timeoutId);
      setAsking(false);
      setPending(null);
    }
  }

  const waitingHere = pending !== null && pending.chatId === conversationId;
  const showEmpty = !conversationId && messages.length === 0 && !waitingHere && !error;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-8"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 py-4 md:short:py-2">
          {/* my-auto centers the welcome content but never clips it when the window is very short */}
          {showEmpty && <div className="my-auto">{emptyState}</div>}

          {loadState === "loading" && (
            <p role="status" className="py-8 text-center text-sm text-slate-500">
              Loading conversation...
            </p>
          )}

          {loadState === "notfound" && (
            <div className="my-auto rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-medium">This chat could not be found.</p>
              <p className="mt-1 text-sm text-slate-600">It may have been deleted.</p>
              {onNewChat && (
                <button type="button" onClick={onNewChat} className="mt-4">
                  Start a new chat
                </button>
              )}
            </div>
          )}

          {loadState === "error" && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <p>Could not load this chat.</p>
              <button
                type="button"
                onClick={() => setReloadToken((t) => t + 1)}
                className="mt-2 border border-red-200 bg-white text-red-700 hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          )}

          {messages.map((message) =>
            message.role === "user" ? (
              <UserBubble key={message.id}>{message.content}</UserBubble>
            ) : (
              <AssistantBubble key={message.id} message={message} />
            )
          )}

          {waitingHere && <UserBubble>{pending.text}</UserBubble>}

          {waitingHere && (
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
              disabled={asking}
              aria-label={asking ? "Thinking..." : "Ask"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-900 p-0 text-white hover:bg-slate-700"
            >
              {asking ? (
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
