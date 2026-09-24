"""Transactional email (login codes). Provider is chosen in .env; 'log' only prints (development)."""

import logging

import httpx

from . import settings

log = logging.getLogger(__name__)

# Short, calm texts in the app's languages. {code} is the 6-digit login code.
LOGIN_TEXTS = {
    "cs": ("Přihlašovací kód 72h: {code}", "Váš přihlašovací kód do aplikace 72h je {code}.\nPlatí 10 minut. Pokud jste o něj nežádali, e-mail ignorujte."),
    "en": ("72h login code: {code}", "Your 72h login code is {code}.\nIt is valid for 10 minutes. If you did not ask for it, ignore this email."),
    "sk": ("Prihlasovací kód 72h: {code}", "Váš prihlasovací kód do aplikácie 72h je {code}.\nPlatí 10 minút. Ak ste oň nežiadali, e-mail ignorujte."),
    "pl": ("Kod logowania 72h: {code}", "Twój kod logowania do aplikacji 72h to {code}.\nJest ważny przez 10 minut. Jeśli o niego nie prosiłeś, zignoruj tę wiadomość."),
    "fi": ("72h-kirjautumiskoodi: {code}", "72h-sovelluksen kirjautumiskoodisi on {code}.\nSe on voimassa 10 minuuttia. Jos et pyytänyt koodia, voit ohittaa tämän viestin."),
}


def login_message(code: str, lang: str) -> tuple[str, str]:
    subject, body = LOGIN_TEXTS.get(lang, LOGIN_TEXTS["en"])
    return subject.format(code=code), body.format(code=code)


def send(to: str, subject: str, text: str) -> None:
    provider = settings.EMAIL_PROVIDER
    if provider == "log":
        log.warning("EMAIL (not sent, EMAIL_PROVIDER=log) to=%s subject=%r", to, subject)
        return
    if provider == "brevo":
        r = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.EMAIL_API_KEY},
            json={"sender": {"email": settings.EMAIL_FROM, "name": "72h"}, "to": [{"email": to}], "subject": subject, "textContent": text},
            timeout=10,
        )
    elif provider == "resend":
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.EMAIL_API_KEY}"},
            json={"from": f"72h <{settings.EMAIL_FROM}>", "to": [to], "subject": subject, "text": text},
            timeout=10,
        )
    else:
        raise RuntimeError(f"unknown EMAIL_PROVIDER {provider!r}")
    r.raise_for_status()
