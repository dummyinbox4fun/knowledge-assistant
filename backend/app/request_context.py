"""Per-request tracing context.

Holds the current request's ID in a contextvars.ContextVar so it can be
attached to every log line emitted while handling that request — anywhere
in the call stack (ingestion, retrieval, generation, etc.) — without
threading a request_id parameter through every function signature.

contextvars is safe for FastAPI's async/concurrent request handling: each
request gets its own isolated value, unlike a plain global variable.
"""
from contextvars import ContextVar

request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdLogFilter:
    """Injects the current request's ID into every log record.

    Attached to the log handler (not a Logger) so it applies to records
    from every module's logger as they propagate up to the root handler —
    a Logger-level filter would only see records it originates itself.
    """

    def filter(self, record):
        record.request_id = request_id_ctx_var.get()
        return True