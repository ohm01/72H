import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from . import account, auth, db, family, maps, settings, sync


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Open the pool and apply migrations at startup, so a broken database shows up immediately.
    db.pool()
    yield
    db.reset()


app = FastAPI(title="72h API", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.include_router(maps.router)
app.include_router(auth.router)
app.include_router(family.router)
app.include_router(sync.router)
app.include_router(account.router)

if not settings.AUTH_SECRET:
    raise RuntimeError("AUTH_SECRET is not set (see .env.example)")
if settings.EMAIL_PROVIDER == "log":
    logging.getLogger(__name__).warning("EMAIL_PROVIDER=log: login codes are only printed, not emailed")

# Family invites are https links (any camera opens them). The key sits in the #fragment, which browsers never
# send to the server; this page only hands the fragment to the app.
JOIN_PAGE = """<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>72h</title>
<style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem;line-height:1.5}
a{display:inline-block;padding:.8rem 1.2rem;background:#2b6a4f;color:#fff;border-radius:.5rem;text-decoration:none}</style>
</head><body><h1>72h</h1>
<p>Pozvánka do rodiny v aplikaci 72h. / Family invite for the 72h app.</p>
<p><a id="open" href="app72h://join">Otevřít v aplikaci / Open in the app</a></p>
<p>Nemáte aplikaci? Nainstalujte si ji a odkaz otevřete znovu. / No app yet? Install it and open this link again.</p>
<script>document.getElementById("open").href = "app72h://join" + location.hash;</script>
</body></html>"""


@app.get("/join", response_class=HTMLResponse, include_in_schema=False)
def join_page() -> str:
    return JOIN_PAGE


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
