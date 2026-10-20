"""
Transactional email delivery via Resend (PRD Bab 7 Gatekeeper HITL).

Two transports are supported because they fail differently in practice:
  - `resend_api`  : HTTPS POST to api.resend.com. Preferred on hosts whose egress
                    firewall blocks outbound SMTP.
  - `resend_smtp` : SMTP relay to smtp.resend.com:465. Useful when the API key is
                    restricted to SMTP or when an existing relay is mandated.

Hard rules enforced here:
  - Nothing is sent unless `EMAIL_PROVIDER` and the matching credential are set.
    Callers get `sent=False, reason="EMAIL_NOT_CONFIGURED"` rather than an
    exception, so a missing mail credential never breaks a recruitment flow.
  - Retries are bounded and only applied to transient failures (network errors,
    429, 5xx). A 4xx validation error is not retried.
  - PII is never written to logs. Log lines carry the template name and recipient
    domain only.
"""
from __future__ import annotations

import asyncio
import logging
import re
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _domain_of(address: str) -> str:
    """Extracts the domain for safe logging (never logs the local part)."""
    return address.split("@")[-1] if "@" in address else "invalid"


def _is_valid_address(address: str) -> bool:
    return bool(address and _EMAIL_RE.match(address.strip()))


class EmailService:
    """Provider-agnostic transactional sender with bounded retries."""

    @property
    def provider(self) -> str:
        return (settings.EMAIL_PROVIDER or "").strip().lower()

    @property
    def configured(self) -> bool:
        provider = self.provider
        if provider == "resend_api":
            return bool(settings.RESEND_API_KEY)
        if provider == "resend_smtp":
            return bool(settings.RESEND_API_KEY)
        return False

    def status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider or "disabled",
            "configured": self.configured,
            "from": settings.EMAIL_FROM if self.configured else None,
        }

    # -- transport: Resend HTTP API ----------------------------------------

    async def _send_via_api(
        self, to: List[str], subject: str, html: str, text_body: Optional[str]
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "from": settings.EMAIL_FROM,
            "to": to,
            "subject": subject,
            "html": html,
        }
        if text_body:
            payload["text"] = text_body
        if settings.EMAIL_REPLY_TO:
            payload["reply_to"] = settings.EMAIL_REPLY_TO

        async with httpx.AsyncClient(timeout=settings.EMAIL_TIMEOUT, trust_env=False) as client:
            res = await client.post(
                RESEND_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )

        if res.status_code in (200, 201, 202):
            body = {}
            try:
                body = res.json()
            except Exception:
                pass
            return {
                "sent": True,
                "provider": "resend_api",
                "message_id": body.get("id"),
                "status_code": res.status_code,
            }
        return {
            "sent": False,
            "provider": "resend_api",
            "status_code": res.status_code,
            "reason": f"RESEND_API_ERROR: {res.text[:300]}",
            "retryable": res.status_code in RETRYABLE_STATUS,
        }

    # -- transport: Resend SMTP relay --------------------------------------

    def _send_via_smtp_sync(
        self, to: List[str], subject: str, html: str, text_body: Optional[str]
    ) -> Dict[str, Any]:
        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM
        message["To"] = ", ".join(to)
        message["Subject"] = subject
        if settings.EMAIL_REPLY_TO:
            message["Reply-To"] = settings.EMAIL_REPLY_TO
        message.set_content(text_body or "This message requires an HTML-capable client.")
        message.add_alternative(html, subtype="html")

        context = ssl.create_default_context()
        try:
            with smtplib.SMTP_SSL(
                settings.RESEND_SMTP_HOST,
                settings.RESEND_SMTP_PORT,
                timeout=settings.EMAIL_TIMEOUT,
                context=context,
            ) as smtp:
                smtp.login(settings.RESEND_SMTP_USER, settings.RESEND_API_KEY)
                smtp.send_message(message)
        except (smtplib.SMTPException, OSError) as exc:
            # SMTP auth/permission errors are permanent; connection errors are not.
            permanent = isinstance(exc, smtplib.SMTPAuthenticationError)
            return {
                "sent": False,
                "provider": "resend_smtp",
                "reason": f"RESEND_SMTP_ERROR: {type(exc).__name__}",
                "retryable": not permanent,
            }
        return {"sent": True, "provider": "resend_smtp"}

    async def _send_via_smtp(
        self, to: List[str], subject: str, html: str, text_body: Optional[str]
    ) -> Dict[str, Any]:
        # smtplib is blocking; keep it off the event loop.
        return await asyncio.to_thread(self._send_via_smtp_sync, to, subject, html, text_body)

    # -- public entrypoint --------------------------------------------------

    async def send(
        self,
        to: List[str] | str,
        subject: str,
        html: str,
        text_body: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sends one transactional email.

        Returns a dict with `sent` plus diagnostic fields. Never raises for a
        configuration or delivery problem — recruitment flows must not be blocked
        by a mail outage.
        """
        recipients = [to] if isinstance(to, str) else list(to)
        recipients = [r.strip() for r in recipients if r and r.strip()]

        if not recipients:
            return {"sent": False, "reason": "NO_RECIPIENTS"}
        invalid = [r for r in recipients if not _is_valid_address(r)]
        if invalid:
            return {"sent": False, "reason": "INVALID_RECIPIENT_ADDRESS"}

        if not self.configured:
            logger.info("Email suppressed (provider not configured): subject=%r", subject)
            return {"sent": False, "reason": "EMAIL_NOT_CONFIGURED", "provider": self.provider or "disabled"}

        attempts = max(1, settings.EMAIL_MAX_RETRIES + 1)
        last: Dict[str, Any] = {"sent": False, "reason": "NOT_ATTEMPTED"}

        for attempt in range(attempts):
            try:
                if self.provider == "resend_api":
                    result = await self._send_via_api(recipients, subject, html, text_body)
                elif self.provider == "resend_smtp":
                    result = await self._send_via_smtp(recipients, subject, html, text_body)
                else:
                    return {"sent": False, "reason": f"UNKNOWN_EMAIL_PROVIDER: {self.provider}"}
            except (httpx.HTTPError, OSError) as exc:
                result = {
                    "sent": False,
                    "reason": f"EMAIL_TRANSPORT_ERROR: {type(exc).__name__}",
                    "retryable": True,
                }

            last = result
            if result.get("sent"):
                logger.info(
                    "Email sent via %s: subject=%r recipients=%d domain=%s",
                    result.get("provider"), subject, len(recipients), _domain_of(recipients[0]),
                )
                return result

            if not result.get("retryable") or attempt == attempts - 1:
                break
            # Exponential backoff: 0.5s, 1s, 2s...
            await asyncio.sleep(0.5 * (2 ** attempt))

        logger.warning(
            "Email delivery failed after %d attempt(s): subject=%r reason=%s",
            attempts, subject, last.get("reason"),
        )
        return last


email_service = EmailService()
