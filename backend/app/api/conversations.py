import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app import conversations as store
from app.auth import AuthUser, require_auth
from app.embedding.embedder import embed_text
from app.generation.generator import generate_answer
from app.vectorstore.store import query as vectorstore_query

logger = logging.getLogger("app.conversations")
router = APIRouter(prefix="/conversations", tags=["conversations"])

NOT_FOUND = "Chat not found"


class CreateConversationRequest(BaseModel):
    title: str | None = Field(default=None, max_length=120)


class RenameConversationRequest(BaseModel):
    title: str = Field(max_length=120)


class AskRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)


def _clean_title(title: str) -> str:
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    return title


@router.get("")
def list_chats(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Depends(require_auth),
):
    return {"conversations": store.list_conversations(user.id, limit, offset)}


@router.post("", status_code=201)
def create_chat(
    request: CreateConversationRequest | None = None,
    user: AuthUser = Depends(require_auth),
):
    title = store.DEFAULT_TITLE
    if request is not None and request.title is not None:
        title = _clean_title(request.title)
    chat = store.create_conversation(user.id, title)
    logger.info("Created chat %s", chat["id"])
    return chat


@router.get("/{conversation_id}")
def get_chat(conversation_id: uuid.UUID, user: AuthUser = Depends(require_auth)):
    chat = store.get_conversation(user.id, str(conversation_id))
    if chat is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return chat


@router.patch("/{conversation_id}")
def rename_chat(
    conversation_id: uuid.UUID,
    request: RenameConversationRequest,
    user: AuthUser = Depends(require_auth),
):
    chat = store.rename_conversation(
        user.id, str(conversation_id), _clean_title(request.title)
    )
    if chat is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return chat


@router.delete("/{conversation_id}")
def delete_chat(conversation_id: uuid.UUID, user: AuthUser = Depends(require_auth)):
    if not store.delete_conversation(user.id, str(conversation_id)):
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    logger.info("Deleted chat %s", conversation_id)
    return {"deleted": str(conversation_id)}


@router.post("/{conversation_id}/ask")
def ask_in_chat(
    conversation_id: uuid.UUID,
    request: AskRequest,
    user: AuthUser = Depends(require_auth),
):
    """Answer a question and save both it and the answer in this chat.

    Same retrieval and generation as /generation/answer. Memory of earlier
    messages comes later (V4.3). If answering fails nothing is saved, so the
    chat never holds a question without an answer.
    """
    chat_id = str(conversation_id)
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if not store.conversation_exists(user.id, chat_id):
        raise HTTPException(status_code=404, detail=NOT_FOUND)

    query_embedding = embed_text(request.query)
    chunks = vectorstore_query(query_embedding, user.id, top_k=request.top_k)

    try:
        answer_text = generate_answer(request.query, chunks)
    except RuntimeError as e:
        logger.error("Generation failed in chat %s: %s", chat_id, str(e))
        raise HTTPException(status_code=502, detail=str(e)) from e

    sources = [
        {
            "filename": chunk["filename"],
            "position": chunk["position"],
            "distance": chunk["distance"],
        }
        for chunk in chunks
    ]

    user_message = store.add_message(user.id, chat_id, "user", request.query)
    assistant_message = store.add_message(
        user.id, chat_id, "assistant", answer_text, sources=sources
    )
    if user_message is None or assistant_message is None:
        # The chat was deleted while the answer was being generated.
        raise HTTPException(status_code=404, detail=NOT_FOUND)

    logger.info("Answered in chat %s using %d chunks", chat_id, len(chunks))
    return {
        "answer": answer_text,
        "sources": sources,
        "user_message": user_message,
        "assistant_message": assistant_message,
    }
