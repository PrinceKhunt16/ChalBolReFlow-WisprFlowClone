import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import uvicorn

from app.main import app


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 48763


def _candidate_config_paths() -> list[Path]:
    paths: list[Path] = []

    config_path = os.getenv("CBR_CONFIG_PATH")
    if config_path:
        paths.append(Path(config_path))

    if getattr(sys, "frozen", False):
        executable_dir = Path(sys.executable).resolve().parent
        paths.extend(
            [
                executable_dir.parent / "app-config.json",
                executable_dir / "app-config.json",
            ]
        )

    paths.append(Path(__file__).resolve().parents[2] / "app-config.json")
    return paths


def _load_shared_config() -> dict[str, Any]:
    for candidate in _candidate_config_paths():
        if not candidate.exists():
            continue

        try:
            return json.loads(candidate.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

    return {}


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Start the ChalBolReFlow backend")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    config = _load_shared_config()

    host = args.host or os.getenv("CBR_BACKEND_HOST") or str(config.get("backendHost", DEFAULT_HOST))
    port_value = args.port or os.getenv("CBR_BACKEND_PORT") or config.get("backendPort", DEFAULT_PORT)
    port = int(port_value)

    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()