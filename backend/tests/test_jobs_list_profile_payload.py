"""
GET /api/jobs feeds the JobManagement table, and the edit modal is opened from
a row of that table. If the list omits the public-profile columns the modal
opens with empty fields and saving wipes the profile that was already filled
in. These tests pin the columns into the list query.

Source-level assertions (not live DB) so the suite stays offline.
"""
import inspect
import re

from app.api import jobs as jobs_module


def _code_only(func) -> str:
    """Function source with comments and docstrings stripped."""
    source = inspect.getsource(func)
    source = re.sub(r'"""[\s\S]*?"""', "", source)
    source = re.sub(r"#.*", "", source)
    return source


PROFILE_COLUMNS = (
    "company_name",
    "company_logo_url",
    "company_about",
    "company_address",
    "company_industry",
    "company_website",
    "job_function",
    "employment_level",
    "location",
    "deadline",
    "description_text",
    "requirements_text",
)


def test_list_jobs_selects_every_profile_column():
    source = _code_only(jobs_module.list_jobs)
    for column in PROFILE_COLUMNS:
        assert column in source, f"list_jobs does not select {column}"


def test_list_jobs_returns_profile_columns_in_payload():
    source = _code_only(jobs_module.list_jobs)
    # Selected is not enough: each one also has to be copied into the dict.
    for column in PROFILE_COLUMNS:
        assert f'"{column}"' in source, f"list_jobs does not return {column}"


def test_list_jobs_includes_raw_text_for_the_edit_form():
    # The modal pre-fills the description textarea from raw_text. Without it,
    # saving a profile edit blanks the job description the triage engine reads.
    source = _code_only(jobs_module.list_jobs)
    assert "raw_text" in source


def test_list_jobs_serialises_deadline_as_iso_date():
    # date objects are not JSON serialisable; the frontend <input type="date">
    # also wants YYYY-MM-DD, so the endpoint flattens it itself.
    source = _code_only(jobs_module.list_jobs)
    assert "isoformat" in source


def test_profile_fields_allowlist_matches_selected_columns():
    # JobProfileFields.PROFILE_FIELDS is the write allowlist; the read side must
    # cover the same set, otherwise a field can be written through the API but
    # never read back into the edit form.
    assert set(jobs_module.JobProfileFields.PROFILE_FIELDS) == set(PROFILE_COLUMNS)
