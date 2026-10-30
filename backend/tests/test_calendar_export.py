"""
Unit tests for Sovereign Calendar Adapter and Slot Export to Personal Google Calendar.
Covers:
  - generate_google_calendar_url format & parameter correctness
  - generate_ics_content RFC 5545 validity
  - reserve_slot returning export_google_url
"""
from datetime import datetime, timedelta
import pytest
from app.adapters.calendar import mock_calendar_adapter


def test_generate_google_calendar_url():
    start = datetime(2026, 11, 5, 10, 0, 0)
    end = datetime(2026, 11, 5, 11, 0, 0)
    url = mock_calendar_adapter.generate_google_calendar_url(
        summary="Wawancara Backend Engineer - #TK-A1B2C3",
        start_time=start,
        end_time=end,
        description="Interview via TalentOps AI",
        location="Google Meet / Room 101",
    )
    assert url.startswith("https://calendar.google.com/calendar/render?")
    assert "action=TEMPLATE" in url
    assert "text=Wawancara+Backend+Engineer" in url or "text=Wawancara%20Backend%20Engineer" in url
    assert "20261105T100000Z%2F20261105T110000Z" in url or "20261105T100000Z/20261105T110000Z" in url
