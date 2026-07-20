# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for ChalBolReFlow backend.

Produces a single-file executable that bundles uvicorn + FastAPI + all
dependencies.  The Electron shell spawns this binary at runtime.

Build:  pyinstaller --noconfirm --clean chalbolreflow-backend.spec
"""

import sys
from pathlib import Path

block_cipher = None

# ── paths ───────────────────────────────────────────────────────────────
BACKEND_DIR = Path(SPECPATH)  # noqa: F821  (SPECPATH injected by PyInstaller)
APP_DIR = BACKEND_DIR / "app"

# ── analysis ────────────────────────────────────────────────────────────
a = Analysis(
    [str(APP_DIR / "serve.py")],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=[],
    hiddenimports=[
        # ── FastAPI / Starlette core ──
        "fastapi",
        "fastapi.middleware",
        "fastapi.middleware.cors",
        "fastapi.responses",
        "fastapi.routing",
        "starlette",
        "starlette.middleware",
        "starlette.middleware.cors",
        "starlette.responses",
        "starlette.routing",
        "starlette.status",
        # ── Uvicorn ──
        "uvicorn",
        "uvicorn.config",
        "uvicorn.main",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "uvicorn.logging",
        # ── App modules ──
        "app",
        "app.main",
        "app.serve",
        "app.db",
        "app.api",
        "app.api.v1",
        "app.api.v1.router",
        # ── Pydantic ──
        "pydantic",
        "pydantic.fields",
        "pydantic._internal",
        "pydantic._internal._generate_schema",
        # ── Other deps ──
        "groq",
        "multipart",
        "python_multipart",
        "dotenv",
        "httptools",
        "h11",
        "wsproto",
        "websockets",
        "anyio",
        "anyio._backends",
        "anyio._backends._asyncio",
        "sniffio",
        "httpx",
        "httpcore",
        "idna",
        "certifi",
        "sqlite3",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "test",
        "unittest",
        "xmlrpc",
        "pydoc",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# ── bundle ──────────────────────────────────────────────────────────────
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="chalbolreflow-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,           # backend is a CLI process, not a GUI
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
