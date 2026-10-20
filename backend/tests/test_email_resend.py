"""
Resend email service test suite (API + SMTP transports).

No network, no SMTP connection: httpx is stubbed and smtplib is patched. Covers:
  - disabled provider => sent=False, never raises (recruitment flow must survive)
  - recipient validation before any transport call
  - Resend HTTP API success, 4xx (no retry) vs 429/5xx (retried)
  - SMTP relay success and auth-failure classification
  - bounded retries with exponential backoff
  - templates: escaping, plain-text alternative, and status labels
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

import smtplib

from app.core.config import settings
from app.core.email import EmailService
from app.core.email_templates import (
    application_received,
    application_status_update,
    erasure_confirmation,
    hr_new_application_alert,
    interview_scheduled,
)


class FakeResponse:
    def __init__(self, status_code, json_body=None, text=""):
        self.status_code = status_code
        self._json = json_body or {}
        self.text = text or str(json_body)

    def json(self):
        return self._json


class FakeHTTPClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, json=None, headers=None, **kwargs):
        self.calls.append({"url": url, "json": json, "headers": headers})
        return self.responses.pop(0) if self.responses else FakeResponse(500, text="unscripted")


@pytest.fixture
def api_provider():
    original = (settings.EMAIL_PROVIDER, settings.RESEND_API_KEY, settings.EMAIL_MAX_RETRIES)
    settings.EMAIL_PROVIDER = "resend_api"
    settings.RESEND_API_KEY = "re_test_key_123"
    settings.EMAIL_MAX_RETRIES = 2
    try:
        yield
    finally:
        settings.EMAIL_PROVIDER, settings.RESEND_API_KEY, settings.EMAIL_MAX_RETRIES = original


@pytest.fixture
def smtp_provider():
    original = (settings.EMAIL_PROVIDER, settings.RESEND_API_KEY, settings.EMAIL_MAX_RETRIES)
    settings.EMAIL_PROVIDER = "resend_smtp"
    settings.RESEND_API_KEY = "re_test_key_123"
    settings.EMAIL_MAX_RETRIES = 0
    try:
        yield
    finally:
        settings.EMAIL_PROVIDER, settings.RESEND_API_KEY, settings.EMAIL_MAX_RETRIES = original


@pytest.fixture
def disabled_provider():
    original = settings.EMAIL_PROVIDER
    settings.EMAIL_PROVIDER = ""
    try:
        yield
    finally:
        settings.EMAIL_PROVIDER = original


# -- disabled / validation -------------------------------------------------

@pytest.mark.asyncio
async def test_disabled_provider_never_raises(disabled_provider):
    """A missing mail credential must not break the recruitment flow."""
    service = EmailService()
    result = await service.send("budi@example.com", "Test", "<p>hi</p>")
    assert result["sent"] is False
    assert result["reason"] == "EMAIL_NOT_CONFIGURED"
    assert service.configured is False


@pytest.mark.asyncio
async def test_invalid_recipient_rejected_before_send(api_provider):
    service = EmailService()
    client = FakeHTTPClient([])
    with patch("httpx.AsyncClient", return_value=client):
        result = await service.send("not-an-email", "Test", "<p>hi</p>")
    assert result["sent"] is False
    assert result["reason"] == "INVALID_RECIPIENT_ADDRESS"
    assert client.calls == []


@pytest.mark.asyncio
async def test_empty_recipient_list_rejected(api_provider):
    service = EmailService()
    result = await service.send([], "Test", "<p>hi</p>")
    assert result["reason"] == "NO_RECIPIENTS"


# -- Resend HTTP API -------------------------------------------------------

@pytest.mark.asyncio
async def test_api_send_success(api_provider):
    service = EmailService()
    client = FakeHTTPClient([FakeResponse(200, {"id": "msg_123"})])
    with patch("httpx.AsyncClient", return_value=client):
        result = await service.send("budi@example.com", "Subjek", "<p>Halo</p>", "Halo")

    assert result["sent"] is True
    assert result["provider"] == "resend_api"
    assert result["message_id"] == "msg_123"

    sent = client.calls[0]["json"]
    assert sent["to"] == ["budi@example.com"]
    assert sent["subject"] == "Subjek"
    assert sent["html"] == "<p>Halo</p>"
    assert sent["text"] == "Halo"
    assert client.calls[0]["headers"]["Authorization"].startswith("Bearer re_test")


@pytest.mark.asyncio
async def test_api_4xx_is_not_retried(api_provider):
    """A validation error is permanent — retrying would just burn quota."""
    service = EmailService()
    client = FakeHTTPClient([FakeResponse(422, {"message": "invalid from"}, "invalid from")])
    with patch("httpx.AsyncClient", return_value=client):
        result = await service.send("budi@example.com", "Subjek", "<p>x</p>")

    assert result["sent"] is False
    assert len(client.calls) == 1


@pytest.mark.asyncio
async def test_api_429_is_retried_then_succeeds(api_provider):
    service = EmailService()
    client = FakeHTTPClient([
        FakeResponse(429, {"message": "rate limited"}, "rate limited"),
        FakeResponse(200, {"id": "msg_ok"}),
    ])
    with patch("httpx.AsyncClient", return_value=client):
        result = await service.send("budi@example.com", "Subjek", "<p>x</p>")

    assert result["sent"] is True
    assert len(client.calls) == 2


@pytest.mark.asyncio
async def test_api_retries_are_bounded(api_provider):
    """EMAIL_MAX_RETRIES=2 means 3 attempts total, then give up."""
    service = EmailService()
    client = FakeHTTPClient([
        FakeResponse(503, text="unavailable"),
        FakeResponse(503, text="unavailable"),
        FakeResponse(503, text="unavailable"),
        FakeResponse(503, text="unavailable"),
    ])
    with patch("httpx.AsyncClient", return_value=client):
        result = await service.send("budi@example.com", "Subjek", "<p>x</p>")

    assert result["sent"] is False
    assert len(client.calls) == 3


@pytest.mark.asyncio
async def test_multiple_recipients_passed_through(api_provider):
    service = EmailService()
    client = FakeHTTPClient([FakeResponse(200, {"id": "m"})])
    with patch("httpx.AsyncClient", return_value=client):
        await service.send(["a@example.com", "b@example.com"], "S", "<p>x</p>")
    assert client.calls[0]["json"]["to"] == ["a@example.com", "b@example.com"]


# -- SMTP relay ------------------------------------------------------------

@pytest.mark.asyncio
async def test_smtp_send_success(smtp_provider):
    service = EmailService()
    mock_smtp = MagicMock()
    mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
    mock_smtp.__exit__ = MagicMock(return_value=False)

    with patch("smtplib.SMTP_SSL", return_value=mock_smtp):
        result = await service.send("budi@example.com", "Subjek", "<p>Halo</p>", "Halo")

    assert result["sent"] is True
    assert result["provider"] == "resend_smtp"
    mock_smtp.login.assert_called_once()
    mock_smtp.send_message.assert_called_once()


@pytest.mark.asyncio
async def test_smtp_auth_failure_not_retried(smtp_provider):
    """Bad SMTP credentials are permanent; no retry storm."""
    service = EmailService()
    mock_smtp = MagicMock()
    mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
    mock_smtp.__exit__ = MagicMock(return_value=False)
    mock_smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b"auth failed")

    with patch("smtplib.SMTP_SSL", return_value=mock_smtp):
        result = await service.send("budi@example.com", "Subjek", "<p>x</p>")

    assert result["sent"] is False
    assert result["retryable"] is False
    assert "RESEND_SMTP_ERROR" in result["reason"]


@pytest.mark.asyncio
async def test_smtp_connection_error_is_retryable(smtp_provider):
    service = EmailService()
    settings.EMAIL_MAX_RETRIES = 1
    mock_smtp = MagicMock()
    mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
    mock_smtp.__exit__ = MagicMock(return_value=False)
    mock_smtp.login.side_effect = OSError("connection refused")

    try:
        with patch("smtplib.SMTP_SSL", return_value=mock_smtp):
            result = await service.send("budi@example.com", "Subjek", "<p>x</p>")
    finally:
        settings.EMAIL_MAX_RETRIES = 0

    assert result["sent"] is False
    assert result["retryable"] is True


# -- templates -------------------------------------------------------------

def test_interview_template_escapes_html():
    """Job titles and notes come from user input and must be escaped."""
    subject, html, text = interview_scheduled(
        masked_identifier="#TK-A1B2C3",
        job_title='Engineer <script>alert("x")</script>',
        start_time="1 Nov 2026 09:00",
        end_time="10:00",
        meeting_note="Bawa <b>laptop</b>",
    )
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "&lt;b&gt;laptop&lt;/b&gt;" in html
    assert "#TK-A1B2C3" in html
    assert "#TK-A1B2C3" in text
    assert subject == "Jadwal Wawancara - Engineer <script>alert(\"x\")</script>"


def test_application_received_template_has_plain_text():
    subject, html, text = application_received("#TK-001122", "Backend Engineer")
    assert "#TK-001122" in html
    assert "#TK-001122" in text
    assert "<html" in html.lower()
    assert "<" not in text  # plain-text alternative must not carry markup


def test_status_update_template_includes_label():
    subject, html, text = application_status_update(
        "#TK-FFEE00", "Backend Engineer", "Tidak Dilanjutkan", "Terima kasih atas waktu Anda."
    )
    assert "Tidak Dilanjutkan" in html
    assert "Tidak Dilanjutkan" in text
    assert "Terima kasih" in html


def test_erasure_template_references_pdp_law():
    subject, html, text = erasure_confirmation("#TK-ABCDEF", "Backend Engineer")
    assert "27/2022" in html
    assert "27/2022" in text
    assert "#TK-ABCDEF" in text


def test_hr_alert_template_lists_flags():
    subject, html, text = hr_new_application_alert(
        "#TK-123456", "Backend Engineer", "HIGH_ATTENTION",
        ["PDF_WHITE_TEXT", "PROMPT_INJECTION"],
    )
    assert "PDF_WHITE_TEXT" in html
    assert "PROMPT_INJECTION" in html
    assert "HIGH_ATTENTION" in text


def test_templates_never_leak_unescaped_user_input():
    """A malicious note must not break out of the HTML body."""
    _, html, _ = application_status_update(
        "#TK-000001", "Role", "Status",
        '"><img src=x onerror=alert(1)>',
    )
    assert "<img src=x" not in html
    assert "&lt;img" in html
