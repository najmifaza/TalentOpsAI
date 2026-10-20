"""
Email templates for the recruitment lifecycle.

Templates are plain functions returning (subject, html, text) so they are trivially
unit-testable and cannot leak template engine state between requests.

PII rule: candidate emails are only ever sent *after* a human decision (PRD Bab 7
Gatekeeper HITL forbids automated dispatch). Callers are responsible for that
ordering; these templates only render.
"""
from __future__ import annotations

import html as html_lib
from typing import Dict, Tuple

BRAND = "TalentOps AI"
ACCENT = "#233876"
ORANGE = "#F49523"


def _esc(value: str) -> str:
    """Escapes user-supplied text before interpolation into HTML."""
    return html_lib.escape(str(value or ""))


def _layout(title: str, body_html: str, footer_note: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#FFFFFF;border:1px solid #E8E8EA;border-radius:16px;overflow:hidden;">
        <tr><td style="background:{ACCENT};padding:20px 28px;">
          <span style="color:#FFFFFF;font-size:16px;font-weight:700;letter-spacing:-0.2px;">{BRAND}</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:{ACCENT};">{_esc(title)}</h1>
          <div style="font-size:14px;line-height:1.6;color:#334155;">{body_html}</div>
        </td></tr>
        <tr><td style="padding:0 28px 28px;">
          <div style="border-top:1px solid #E8E8EA;padding-top:16px;font-size:12px;line-height:1.6;color:#64748B;">
            {footer_note or "Email ini dikirim otomatis oleh sistem rekrutmen TalentOps AI."}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def interview_scheduled(
    masked_identifier: str,
    job_title: str,
    start_time: str,
    end_time: str,
    interviewer_name: str = "",
    meeting_note: str = "",
) -> Tuple[str, str, str]:
    """Confirmation sent once HR approves a candidate and a slot is booked."""
    subject = f"Jadwal Wawancara - {job_title}"
    interviewer_line = (
        f"<p style=\"margin:0 0 12px;\">Pewawancara: <strong>{_esc(interviewer_name)}</strong></p>"
        if interviewer_name else ""
    )
    note_line = (
        f"<p style=\"margin:16px 0 0;padding:12px;background:#F8FAFC;border-radius:8px;font-size:13px;\">"
        f"{_esc(meeting_note)}</p>"
        if meeting_note else ""
    )
    body = f"""
      <p style="margin:0 0 12px;">Halo,</p>
      <p style="margin:0 0 16px;">Lamaran Anda untuk posisi <strong>{_esc(job_title)}</strong>
      telah lolos tahap evaluasi awal. Kami mengundang Anda untuk sesi wawancara.</p>
      <table role="presentation" cellpadding="0" cellspacing="0"
             style="background:#F8FAFC;border:1px solid #E8E8EA;border-radius:12px;padding:16px;width:100%;">
        <tr><td style="padding:16px;font-size:14px;line-height:1.7;">
          <strong>Waktu</strong><br>{_esc(start_time)} &ndash; {_esc(end_time)} WIB
        </td></tr>
      </table>
      {interviewer_line}
      <p style="margin:16px 0 0;font-size:13px;color:#64748B;">
        ID Lamaran Anda: <strong>{_esc(masked_identifier)}</strong>
      </p>
      {note_line}
      <p style="margin:20px 0 0;font-size:13px;color:#64748B;">
        Silakan simpan ID lamaran di atas untuk memantau status melalui portal karier.
      </p>
    """
    text = (
        f"Jadwal Wawancara - {job_title}\n\n"
        f"Lamaran Anda telah lolos tahap evaluasi awal.\n"
        f"Waktu: {start_time} - {end_time} WIB\n"
        + (f"Pewawancara: {interviewer_name}\n" if interviewer_name else "")
        + f"ID Lamaran: {masked_identifier}\n"
        + (f"\n{meeting_note}\n" if meeting_note else "")
    )
    return subject, _layout(subject, body), text


def application_received(masked_identifier: str, job_title: str, tracking_hint: str = "") -> Tuple[str, str, str]:
    """Acknowledgement sent after a public portal application is accepted."""
    subject = f"Lamaran Diterima - {job_title}"
    body = f"""
      <p style="margin:0 0 12px;">Halo,</p>
      <p style="margin:0 0 16px;">Lamaran Anda untuk posisi <strong>{_esc(job_title)}</strong>
      telah kami terima dan sedang dalam proses evaluasi.</p>
      <p style="margin:0 0 8px;font-size:13px;">ID Lamaran Anda:</p>
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:{ACCENT};letter-spacing:0.5px;">
        {_esc(masked_identifier)}
      </p>
      <p style="margin:0;font-size:13px;color:#64748B;">
        {_esc(tracking_hint) or "Gunakan ID di atas pada halaman pelacakan untuk memantau status."}
      </p>
    """
    text = (
        f"Lamaran Diterima - {job_title}\n\n"
        f"Lamaran Anda sedang dalam proses evaluasi.\n"
        f"ID Lamaran: {masked_identifier}\n"
    )
    return subject, _layout(subject, body), text


def application_status_update(masked_identifier: str, job_title: str, status_label: str, note: str = "") -> Tuple[str, str, str]:
    """Status-change notification for the applicant tracker."""
    subject = f"Pembaruan Status Lamaran - {job_title}"
    note_block = (
        f"<p style=\"margin:16px 0 0;padding:12px;background:#F8FAFC;border-radius:8px;font-size:13px;\">"
        f"{_esc(note)}</p>" if note else ""
    )
    body = f"""
      <p style="margin:0 0 12px;">Halo,</p>
      <p style="margin:0 0 16px;">Status lamaran Anda untuk posisi
      <strong>{_esc(job_title)}</strong> telah diperbarui.</p>
      <p style="margin:0 0 16px;">
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:#E1EBE4;
                     color:{ACCENT};font-size:13px;font-weight:600;">{_esc(status_label)}</span>
      </p>
      <p style="margin:0;font-size:13px;color:#64748B;">ID Lamaran: <strong>{_esc(masked_identifier)}</strong></p>
      {note_block}
    """
    text = (
        f"Pembaruan Status Lamaran - {job_title}\n\n"
        f"Status: {status_label}\n"
        f"ID Lamaran: {masked_identifier}\n"
        + (f"\n{note}\n" if note else "")
    )
    return subject, _layout(subject, body), text


def erasure_confirmation(masked_identifier: str, job_title: str = "") -> Tuple[str, str, str]:
    """Confirms a Right to Erasure request was honoured (UU PDP No. 27/2022)."""
    subject = "Konfirmasi Penghapusan Data Lamaran"
    body = f"""
      <p style="margin:0 0 12px;">Halo,</p>
      <p style="margin:0 0 16px;">Permohonan penghapusan data lamaran Anda
      {f"untuk posisi <strong>{_esc(job_title)}</strong> " if job_title else ""}
      telah kami proses.</p>
      <p style="margin:0 0 16px;">Sesuai UU No. 27/2022 tentang Pelindungan Data Pribadi,
      kunci enkripsi data Anda telah dihancurkan secara kriptografis. Data identitas
      tidak dapat dipulihkan lagi oleh sistem kami.</p>
      <p style="margin:0;font-size:13px;color:#64748B;">
        ID Lamaran: <strong>{_esc(masked_identifier)}</strong>
      </p>
    """
    text = (
        "Konfirmasi Penghapusan Data Lamaran\n\n"
        "Permohonan penghapusan data Anda telah diproses sesuai UU No. 27/2022.\n"
        f"ID Lamaran: {masked_identifier}\n"
    )
    return subject, _layout(subject, body), text


def hr_new_application_alert(
    masked_identifier: str, job_title: str, triage_priority: str, flags: list[str] | None = None
) -> Tuple[str, str, str]:
    """Internal alert to the recruiter when a new candidate lands in the queue."""
    subject = f"Kandidat Baru - {job_title} ({masked_identifier})"
    flag_block = ""
    if flags:
        items = "".join(
            f"<li style=\"margin:2px 0;\">{_esc(f)}</li>" for f in flags
        )
        flag_block = f"<p style=\"margin:16px 0 4px;font-size:13px;\"><strong>Anomali terdeteksi:</strong></p><ul style=\"margin:0;padding-left:20px;font-size:13px;color:#B91C1C;\">{items}</ul>"
    body = f"""
      <p style="margin:0 0 16px;">Kandidat baru masuk ke antrean triage.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.8;">
        <tr><td style="padding-right:12px;color:#64748B;">Posisi</td><td><strong>{_esc(job_title)}</strong></td></tr>
        <tr><td style="padding-right:12px;color:#64748B;">ID</td><td><strong>{_esc(masked_identifier)}</strong></td></tr>
        <tr><td style="padding-right:12px;color:#64748B;">Prioritas</td><td><strong>{_esc(triage_priority)}</strong></td></tr>
      </table>
      {flag_block}
      <p style="margin:20px 0 0;font-size:13px;color:#64748B;">
        Identitas kandidat tetap tersamar sesuai kebijakan blind review.
      </p>
    """
    text = (
        f"Kandidat Baru - {job_title}\n\n"
        f"ID: {masked_identifier}\nPrioritas: {triage_priority}\n"
        + (f"Anomali: {', '.join(flags)}\n" if flags else "")
    )
    return subject, _layout(subject, body), text
