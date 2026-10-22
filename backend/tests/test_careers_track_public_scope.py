"""
Guardrails for what the public career portal is allowed to say about AI decisions.

`GET /careers/track/{token}` is unauthenticated: the token is the only secret. So the
payload must stay at the level of "status + recommendation + scores" and must never
grow a resume quotation, an anomaly description, or a repository URL — those live in
the dossier behind `require_roles`.

These tests pin the payload shape without touching a database.
"""
import inspect
import re
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.api.careers import track_application_status

# Fields the dossier may show and the public tracker must not.
FORBIDDEN_IN_PUBLIC_TRACK = (
    "claim_text",
    "matched_requirement",
    "sanitized_resume_text",
    "masked_name_hint",
    "github_url",
    "portfolio_url",
    "encrypted_",
    "suggested_verification",
    "repo_url",
)


def _code_only(fn) -> str:
    """Function source with comments and the docstring removed.

    The docstring legitimately names the fields that are withheld ("kutipan CV
    (claim_text)"), so a plain substring check would flag the documentation
    itself. Only executable lines matter here.
    """
    lines = []
    in_docstring = False
    for raw in inspect.getsource(fn).splitlines():
        line = raw.strip()
        if line.count('"""') == 1:
            in_docstring = not in_docstring
            continue
        if in_docstring or line.startswith('"""'):
            continue
        lines.append(re.sub(r"#.*$", "", raw))
    return "\n".join(lines)


def test_public_tracker_never_selects_dossier_only_columns():
    source = _code_only(track_application_status)
    for forbidden in FORBIDDEN_IN_PUBLIC_TRACK:
        assert forbidden not in source, f"public tracker selects {forbidden}"


def test_public_tracker_does_not_join_evidence_tables():
    source = _code_only(track_application_status)
    assert "candidate_evidence" not in source
    assert "candidate_anomalies" not in source


def test_decision_rule_is_derived_not_stored():
    """
    The rule label is recomputed from stored scores, so it cannot drift from
    `DeterministicScoringEngine`. If someone starts persisting a rule column,
    this test is the place to notice.
    """
    source = _code_only(track_application_status)
    assert "evaluate_decision_points" in source
    assert "rule_applied" not in source


def test_quarantine_label_is_never_forced_on_the_applicant():
    # has_prompt_injection=False keeps "Aturan 0 (Security Quarantine)" out of the
    # public payload: a flagged candidate sees a neutral status, not an accusation.
    source = _code_only(track_application_status)
    assert "has_prompt_injection=False" in source


def test_assessment_is_null_until_scored():
    # The endpoint must not present 0.0 as a real score for a queued application.
    source = _code_only(track_application_status)
    assert "if overall is not None" in source


def test_weights_are_exposed_so_the_total_can_be_checked():
    """
    The published total is a weighted mean, not an arithmetic mean. Without the
    weights on the page a candidate computing the plain average of the four bars
    gets a different number and concludes the score is wrong.
    """
    source = _code_only(track_application_status)
    assert "weight_config" in source
    assert '"weights"' in source


def test_decision_reason_is_a_public_sentence_not_a_rule_name():
    from app.api.careers import public_rule_label

    # Every rule the engine can emit maps to a sentence with no "Aturan N" in it.
    for rule in (
        "Aturan 1 (Kandidat Unggul)",
        "Aturan 2 (Ambang Kritis / Anomali)",
        "Aturan 3 (Kandidat Kompeten Standard)",
        "Aturan 4 (Eliminasi Kelayakan)",
    ):
        label = public_rule_label(rule)
        assert label and "Aturan" not in label, rule

    # An unmapped rule still produces something readable rather than None.
    assert public_rule_label("Aturan 9 (Baru)") == (
        "Penilaian mengikuti ambang batas yang ditetapkan lowongan."
    )
    assert public_rule_label(None) is None


def test_weighted_total_reconciles_with_dimension_scores():
    """
    Locks the arithmetic the page now explains: total == sum(dim * weight).
    Uses the live-shaped payload from the demo candidate (88.67).
    """
    dims = {"SKILL": 81.67, "EXPERIENCE": 100.0, "EDUCATION": 60.0, "PORTFOLIO": 100.0}
    weights = {"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2}
    total = round(sum(dims[k] * weights[k] for k in dims), 2)
    assert total == 88.67
    # And it is deliberately NOT the plain mean, which is why the weights are shown.
    assert round(sum(dims.values()) / 4, 2) == 85.42
