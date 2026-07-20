import os
import tempfile
from typing import Annotated, Any, Dict, List, Literal, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from groq import Groq
from pydantic import BaseModel

from app.db import (
    create_dictation,
    delete_dictation,
    list_dictations,
    load_settings,
    load_analytics_summary,
    save_settings,
    toggle_dictation_favorite,
)


router = APIRouter(prefix="/api/v1")

DEFAULT_GROQ_TEXT_MODEL = "openai/gpt-oss-120b"
DEPRECATED_GROQ_MODEL_REPLACEMENTS = {
    "llama-3.1-70b-versatile": DEFAULT_GROQ_TEXT_MODEL,
    "llama-3.3-70b-versatile": DEFAULT_GROQ_TEXT_MODEL,
    "mixtral-8x7b-32768": DEFAULT_GROQ_TEXT_MODEL,
    "gemma2-9b-it": "openai/gpt-oss-20b",
}


class DictationResponse(BaseModel):
    text: str
    raw_text: str
    provider: str
    transcription_model: str
    formatting_model: str


class DictationItem(BaseModel):
    id: str
    text: str
    durationSeconds: int
    wordsCount: int
    appName: str
    timestamp: str
    isFavorite: bool


class AnalyticsSummaryPayload(BaseModel):
    updatedAt: str
    totals: Dict[str, float | int]
    summary: Dict[str, float | int]
    formulaNotes: List[str]


class DictationCreate(BaseModel):
    id: Optional[str] = None
    text: str
    durationSeconds: int = 1
    wordsCount: Optional[int] = None
    appName: str = "System"
    timestamp: Optional[str] = None
    isFavorite: bool = False


@router.get("/analytics", response_model=AnalyticsSummaryPayload)
async def get_analytics() -> AnalyticsSummaryPayload:
    return AnalyticsSummaryPayload(**load_analytics_summary())


class DictationFavoriteUpdate(BaseModel):
    isFavorite: Optional[bool] = None


class SettingsPayload(BaseModel):
    launchAtStartup: bool = True
    minimizeToTray: bool = True
    notifications: bool = True
    language: str = "English"
    aiProvider: Literal["Groq"] = "Groq"
    apiKey: str = ""
    model: str = DEFAULT_GROQ_TEXT_MODEL
    temperature: float = 0.2
    version: str = "1.0.0"


def _get_groq_client(api_key: Optional[str]) -> Groq:
    key = (api_key or "").strip()
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Groq API key is required. Save your Groq key in Settings > AI Provider > API Key.",
        )
    return Groq(api_key=key)


def _normalize_groq_text_model(model: Optional[str]) -> str:
    if not model:
        return DEFAULT_GROQ_TEXT_MODEL
    return DEPRECATED_GROQ_MODEL_REPLACEMENTS.get(model, model)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/settings", response_model=SettingsPayload)
async def get_settings() -> SettingsPayload:
    return SettingsPayload(**load_settings())


@router.put("/settings", response_model=SettingsPayload)
async def update_settings(payload: SettingsPayload) -> SettingsPayload:
    return SettingsPayload(**save_settings(payload.model_dump()))


@router.get("/history", response_model=list[DictationItem])
async def get_history() -> list[DictationItem]:
    return [DictationItem(**item) for item in list_dictations()]


@router.post("/history", response_model=DictationItem)
async def create_history_item(payload: DictationCreate) -> DictationItem:
    return DictationItem(**create_dictation(payload.model_dump()))


@router.patch("/history/{dictation_id}/favorite", response_model=DictationItem)
async def update_history_favorite(
    dictation_id: str,
    payload: DictationFavoriteUpdate,
) -> DictationItem:
    try:
        item = toggle_dictation_favorite(dictation_id, payload.isFavorite)
    except LookupError as error:
        raise HTTPException(status_code=404, detail="Dictation not found.") from error
    return DictationItem(**item)


@router.delete("/history/{dictation_id}")
async def remove_history_item(dictation_id: str) -> dict[str, str]:
    delete_dictation(dictation_id)
    return {"status": "deleted"}


@router.post("/dictation/transcribe", response_model=DictationResponse)
async def transcribe_dictation(
    audio: Annotated[UploadFile, File()],
    provider: Annotated[str, Form()] = "Groq",
    model: Annotated[str, Form()] = DEFAULT_GROQ_TEXT_MODEL,
    language: Annotated[str, Form()] = "English",
    temperature: Annotated[float, Form()] = 0.2,
    api_key: Annotated[Optional[str], Form()] = None,
) -> DictationResponse:
    if provider != "Groq":
        raise HTTPException(status_code=400, detail="Only Groq is supported by the backend right now.")

    client = _get_groq_client(api_key)
    text_model = _normalize_groq_text_model(model)
    suffix = f".{(audio.filename or 'dictation.webm').rsplit('.', 1)[-1]}" if "." in (audio.filename or "") else ".webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
        temp_audio.write(await audio.read())
        temp_audio_path = temp_audio.name

    try:
        try:
            with open(temp_audio_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3-turbo",
                    response_format="text",
                )
        except Exception as error:
            message = str(error)
            status = getattr(error, "status_code", None) or 502
            if "invalid_api_key" in message or "Invalid API Key" in message or status == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Groq rejected the API key saved in Settings. Please verify it and try again.",
                ) from error
            raise HTTPException(status_code=502, detail=f"Groq transcription failed: {message}") from error

        raw_text = str(transcription).strip()
        if not raw_text:
            raise HTTPException(status_code=422, detail="No speech was detected in the uploaded audio.")

        try:
            completion = client.chat.completions.create(
                model=text_model,
                temperature=temperature,
                messages=[
                    {
                        "role": "system",
                        "content": (
                        "You are an expert real-time voice dictation post-processor.\n\n"
                        "Your ONLY job is to convert raw speech recognition output into clean, natural text while preserving the speaker's original meaning, intent, tone, and wording.\n\n"

                        "Rules:\n"

                        "1. Preserve meaning exactly.\n"
                        "- Never summarize.\n"
                        "- Never rewrite for style.\n"
                        "- Never change the user's intent.\n\n"

                        "2. Remove speech disfluencies.\n"
                        "- Remove filler words that do not add meaning such as 'um', 'uh', 'hmm', 'you know', 'like', 'actually', 'basically', 'literally', repeated words, and false starts.\n"
                        "- Keep them only if they are clearly intentional.\n\n"

                        "3. Fix grammar naturally.\n"
                        "- Correct capitalization.\n"
                        "- Correct punctuation.\n"
                        "- Correct spacing.\n"
                        "- Fix obvious speech recognition mistakes.\n"
                        "- Remove duplicated words caused by transcription.\n"
                        "- Keep sentences natural and readable.\n\n"

                        "4. Preserve technical terms.\n"
                        "- Never change recognizable programming languages, frameworks, databases, libraries, APIs, company names, product names, file names, URLs, email addresses, version numbers, or code identifiers.\n"
                        "- Examples: FastAPI, MongoDB, PostgreSQL, React, Next.js, Node.js, TypeScript, Python, Docker, Kubernetes, OpenAI, GitHub, VS Code.\n\n"

                        "5. Preserve formatting intent.\n"
                        "- If the speaker dictates a list, format it as a list.\n"
                        "- If the speaker dictates paragraphs, preserve paragraph structure.\n"
                        "- Apply spoken punctuation naturally when appropriate.\n\n"

                        "6. Never hallucinate.\n"
                        "- Never invent words.\n"
                        "- Never complete unfinished thoughts.\n"
                        "- Never answer questions.\n"
                        "- Never explain anything.\n\n"

                        "7. Preserve language.\n"
                        "- Keep the output in the same language as the input.\n"
                        "- Preserve mixed-language dictation naturally (e.g. English + Hindi, English + Gujarati, Hinglish).\n\n"

                        "8. Preserve names.\n"
                        "- Keep names of people, companies, products, and custom words whenever recognizable.\n"
                        "- Never replace uncommon names with dictionary words.\n\n"

                        "9. Output only the cleaned dictation.\n"
                        "- Do not return markdown.\n"
                        "- Do not use code blocks.\n"
                        "- Do not wrap the text in quotes.\n"
                        "- Do not add notes, explanations, comments, JSON, XML, or any extra text.\n\n"

                        "Return ONLY the final cleaned dictation."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                        f"Language Preference: {language}\n\n"
                        f"Raw Dictation:\n{raw_text}\n\n"
                        "Return ONLY the cleaned dictation."
                        ),
                    },
                ],
            )
        except Exception as error:
            message = str(error)
            status = getattr(error, "status_code", None) or 502
            if "invalid_api_key" in message or "Invalid API Key" in message or status == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Groq rejected the API key saved in Settings. Please verify it and try again.",
                ) from error
            raise HTTPException(status_code=502, detail=f"Groq formatting failed: {message}") from error
        formatted_text = (completion.choices[0].message.content or raw_text).strip()

        return DictationResponse(
            text=formatted_text,
            raw_text=raw_text,
            provider="Groq",
            transcription_model="whisper-large-v3-turbo",
            formatting_model=text_model,
        )
    finally:
        try:
            os.unlink(temp_audio_path)
        except OSError:
            pass
