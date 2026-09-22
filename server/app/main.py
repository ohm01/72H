from fastapi import FastAPI

from . import maps

app = FastAPI(title="72h API", docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(maps.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
