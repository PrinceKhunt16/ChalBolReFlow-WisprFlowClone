import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse, Response

from app.api.v1.router import router as api_router
from app.db import init_db


app = FastAPI(title="ChalBolReFlow API", version="0.1.0")

LOCAL_ORIGIN_RE = re.compile(r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$")


def _is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    return origin == "null" or bool(LOCAL_ORIGIN_RE.match(origin))


def _add_cors_headers(response: Response, origin: str | None) -> Response:
    if _is_allowed_origin(origin):
        if response.headers.get("Access-Control-Allow-Origin"):
            return response
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Vary"] = "Origin"
    return response


@app.on_event("startup")
async def startup_event() -> None:
    init_db()


@app.middleware("http")
async def cors_error_safety_net(request: Request, call_next):
    origin = request.headers.get("origin")

    if request.method == "OPTIONS":
        return _add_cors_headers(Response(status_code=204), origin)

    try:
        response = await call_next(request)
    except Exception as error:
        response = JSONResponse(
            status_code=500,
            content={"detail": f"Internal backend error: {error}"},
        )

    return _add_cors_headers(response, origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["null"],
    allow_origin_regex=LOCAL_ORIGIN_RE.pattern,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
