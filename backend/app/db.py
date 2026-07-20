import json
import os
import sqlite3
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


def _resolve_data_dir() -> Path:
    """Resolve the data directory for the SQLite database.

    Priority:
    1. CBR_DATA_DIR environment variable (set by Electron in production)
    2. Platform user-data directory (frozen/PyInstaller builds)
    3. <workspace>/data (development)
    """
    env_dir = os.getenv("CBR_DATA_DIR")
    if env_dir:
        return Path(env_dir)

    if getattr(sys, "frozen", False):
        # Frozen binary — use a writable user-data location
        import platform
        if platform.system() == "Darwin":
            base = Path.home() / "Library" / "Application Support" / "ChalBolReFlow"
        elif platform.system() == "Windows":
            base = Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming")) / "ChalBolReFlow"
        else:
            base = Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "ChalBolReFlow"
        return base / "data"

    # Development mode — use <workspace>/data
    root = Path(__file__).resolve().parents[2]
    return root / "data"


DATA_DIR = _resolve_data_dir()
DB_PATH = DATA_DIR / "chalbolreflow.sqlite3"

DEFAULT_SETTINGS: dict[str, Any] = {
    "launchAtStartup": True,
    "minimizeToTray": True,
    "notifications": True,
    "language": "English",
    "aiProvider": "Groq",
    "apiKey": "",
    "model": "openai/gpt-oss-120b",
    "temperature": 0.2,
    "version": "1.0.0",
}

_LOCK = threading.Lock()


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def _build_analytics_summary(dictations: list[dict[str, Any]]) -> dict[str, Any]:
    total_dictations = len(dictations)
    total_words = sum(int(item["wordsCount"]) for item in dictations)
    total_voice_seconds = sum(max(int(item["durationSeconds"]), 1) for item in dictations)
    total_voice_minutes = total_voice_seconds / 60 if total_voice_seconds else 0
    speaking_wpm = round((total_words / total_voice_seconds) * 60, 1) if total_voice_seconds else 0.0
    typing_baseline_wpm = 40
    estimated_typing_seconds = (total_words / typing_baseline_wpm) * 60 if total_words else 0
    estimated_seconds_saved = max(estimated_typing_seconds - total_voice_seconds, 0)
    estimated_minutes_saved = round(estimated_seconds_saved / 60, 1)
    average_words_per_dictation = round(total_words / total_dictations, 1) if total_dictations else 0.0
    average_voice_seconds = round(total_voice_seconds / total_dictations, 1) if total_dictations else 0.0
    favorite_count = sum(1 for item in dictations if item["isFavorite"])
    favorite_rate = round((favorite_count / total_dictations) * 100, 1) if total_dictations else 0.0
    fastest_wpm = (
        round(
            max((int(item["wordsCount"]) / max(int(item["durationSeconds"]), 1)) * 60 for item in dictations),
            1,
        )
        if dictations
        else 0.0
    )

    return {
        "updatedAt": datetime.now().astimezone().isoformat(),
        "totals": {
            "dictations": total_dictations,
            "words": total_words,
            "voiceSeconds": total_voice_seconds,
            "voiceMinutes": round(total_voice_minutes, 1),
            "favorites": favorite_count,
        },
        "summary": {
            "estimatedSecondsSaved": round(estimated_seconds_saved, 1),
            "estimatedMinutesSaved": estimated_minutes_saved,
            "speakingWordsPerMinute": speaking_wpm,
            "averageWordsPerDictation": average_words_per_dictation,
            "averageVoiceSeconds": average_voice_seconds,
            "favoriteRate": favorite_rate,
            "fastestSpeakingWpm": fastest_wpm,
            "typingBaselineWpm": typing_baseline_wpm,
        },
        "formulaNotes": [
            "Estimated typing time saved compares your total dictated words against a 40 WPM manual typing baseline.",
            "Speaking WPM is computed as total words divided by recorded dictation seconds, scaled to one minute.",
            "Favorite rate shows how often saved dictations are marked important.",
        ],
    }


def recompute_analytics_summary() -> dict[str, Any]:
    _ensure_initialized()
    analytics = _build_analytics_summary(list_dictations())

    with _LOCK, _connect() as connection:
        connection.execute(
            "UPDATE analytics_summary SET payload = ?, updated_at = ? WHERE id = 1",
            (json.dumps(analytics), analytics["updatedAt"]),
        )
        connection.commit()

    return analytics


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with _LOCK, _connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS dictations (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                words_count INTEGER NOT NULL,
                app_name TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS analytics_summary (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT OR IGNORE INTO settings (id, payload) VALUES (1, ?)",
            (json.dumps(DEFAULT_SETTINGS),),
        )
        connection.execute(
            "INSERT OR IGNORE INTO analytics_summary (id, payload, updated_at) VALUES (1, ?, ?)",
            (json.dumps(_build_analytics_summary([])), datetime.now().astimezone().isoformat()),
        )
        connection.commit()


def _ensure_initialized() -> None:
    if not DB_PATH.exists():
        init_db()


def _normalize_settings(payload: dict[str, Any]) -> dict[str, Any]:
    merged = {**DEFAULT_SETTINGS, **payload}
    merged["aiProvider"] = "Groq"
    merged["model"] = merged.get("model") or DEFAULT_SETTINGS["model"]
    merged["temperature"] = float(merged.get("temperature", DEFAULT_SETTINGS["temperature"]))
    merged["apiKey"] = str(merged.get("apiKey", ""))
    merged["language"] = str(merged.get("language", DEFAULT_SETTINGS["language"]))
    merged["version"] = str(merged.get("version", DEFAULT_SETTINGS["version"]))
    merged["launchAtStartup"] = bool(merged.get("launchAtStartup", True))
    merged["minimizeToTray"] = bool(merged.get("minimizeToTray", True))
    merged["notifications"] = bool(merged.get("notifications", True))
    return merged


def load_settings() -> dict[str, Any]:
    _ensure_initialized()

    with _LOCK, _connect() as connection:
        row = connection.execute("SELECT payload FROM settings WHERE id = 1").fetchone()
        if row is None:
            return DEFAULT_SETTINGS.copy()
        return _normalize_settings(json.loads(row["payload"]))


def save_settings(payload: dict[str, Any]) -> dict[str, Any]:
    _ensure_initialized()
    merged = _normalize_settings({**load_settings(), **payload})

    with _LOCK, _connect() as connection:
        connection.execute(
            "UPDATE settings SET payload = ? WHERE id = 1",
            (json.dumps(merged),),
        )
        connection.commit()

    return merged


def _row_to_dictation(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "text": row["text"],
        "durationSeconds": row["duration_seconds"],
        "wordsCount": row["words_count"],
        "appName": row["app_name"],
        "timestamp": row["timestamp"],
        "isFavorite": bool(row["is_favorite"]),
    }


def list_dictations() -> list[dict[str, Any]]:
    _ensure_initialized()

    with _LOCK, _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, text, duration_seconds, words_count, app_name, timestamp, is_favorite
            FROM dictations
            ORDER BY datetime(created_at) DESC, created_at DESC, id DESC
            """
        ).fetchall()

    return [_row_to_dictation(row) for row in rows]


def load_analytics_summary() -> dict[str, Any]:
    _ensure_initialized()

    with _LOCK, _connect() as connection:
        row = connection.execute(
            "SELECT payload, updated_at FROM analytics_summary WHERE id = 1"
        ).fetchone()
        if row is None:
            return _build_analytics_summary(list_dictations())

        payload = json.loads(row["payload"])
        payload["updatedAt"] = row["updated_at"]
        return payload


def create_dictation(payload: dict[str, Any]) -> dict[str, Any]:
    _ensure_initialized()

    text = str(payload.get("text", "")).strip()
    if not text:
        raise ValueError("text is required")

    now_local = datetime.now().astimezone()
    created_at = str(payload.get("created_at") or now_local.isoformat())
    timestamp = str(payload.get("timestamp") or now_local.strftime("%I:%M %p").lstrip("0"))
    record = {
        "id": str(payload.get("id") or uuid.uuid4()),
        "text": text,
        "duration_seconds": int(payload.get("durationSeconds", payload.get("duration_seconds", 1))),
        "words_count": int(payload.get("wordsCount", len(text.split()))),
        "app_name": str(payload.get("appName", payload.get("app_name", "System"))),
        "timestamp": timestamp,
        "is_favorite": int(bool(payload.get("isFavorite", payload.get("is_favorite", False)))),
        "created_at": created_at,
    }

    with _LOCK, _connect() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO dictations
              (id, text, duration_seconds, words_count, app_name, timestamp, is_favorite, created_at)
            VALUES
              (:id, :text, :duration_seconds, :words_count, :app_name, :timestamp, :is_favorite, :created_at)
            """,
            record,
        )
        connection.commit()

    recompute_analytics_summary()

    return {
        "id": record["id"],
        "text": record["text"],
        "durationSeconds": record["duration_seconds"],
        "wordsCount": record["words_count"],
        "appName": record["app_name"],
        "timestamp": record["timestamp"],
        "isFavorite": bool(record["is_favorite"]),
    }


def toggle_dictation_favorite(dictation_id: str, is_favorite: bool | None = None) -> dict[str, Any]:
    _ensure_initialized()

    with _LOCK, _connect() as connection:
        row = connection.execute(
            """
            SELECT id, text, duration_seconds, words_count, app_name, timestamp, is_favorite
            FROM dictations
            WHERE id = ?
            """,
            (dictation_id,),
        ).fetchone()
        if row is None:
            raise LookupError("dictation not found")

        next_is_favorite = int(not bool(row["is_favorite"])) if is_favorite is None else int(bool(is_favorite))
        connection.execute(
            "UPDATE dictations SET is_favorite = ? WHERE id = ?",
            (next_is_favorite, dictation_id),
        )
        connection.commit()

    recompute_analytics_summary()

    return {
        "id": row["id"],
        "text": row["text"],
        "durationSeconds": row["duration_seconds"],
        "wordsCount": row["words_count"],
        "appName": row["app_name"],
        "timestamp": row["timestamp"],
        "isFavorite": bool(next_is_favorite),
    }


def delete_dictation(dictation_id: str) -> None:
    _ensure_initialized()

    with _LOCK, _connect() as connection:
        connection.execute("DELETE FROM dictations WHERE id = ?", (dictation_id,))
        connection.commit()

    recompute_analytics_summary()