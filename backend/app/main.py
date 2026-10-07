import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .routers import attendance, auth, google, students, subscription

logger = logging.getLogger("vagai")
settings = get_settings()

app = FastAPI(
    title="Vagai Silambam SaaS API",
    version="1.0.0",
    description="Multi-tenant API for Silambam academy management.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": str(exc.detail), "code": "HTTP_ERROR"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "Some of the submitted values are not valid",
            "code": "VALIDATION_ERROR",
            "fields": [{"field": ".".join(str(p) for p in e["loc"][1:]), "error": e["msg"]} for e in exc.errors()],
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    # Log the detail, return none of it: stack traces must not reach customers.
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Something went wrong", "code": "INTERNAL_ERROR"},
    )


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "env": settings.app_env}


app.include_router(auth.router)
app.include_router(students.router)
app.include_router(subscription.router)
app.include_router(google.router)
app.include_router(attendance.router)
