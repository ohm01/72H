from fastapi import FastAPI

import logging

from . import auth, maps, settings

app = FastAPI(title="72h API", docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(maps.router)
app.include_router(auth.router)

if not settings.AUTH_SECRET:
    raise RuntimeError("AUTH_SECRET is not set (see .env.example)")
if settings.EMAIL_PROVIDER == "log":
    logging.getLogger(__name__).warning("EMAIL_PROVIDER=log: login codes are only printed, not emailed")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
