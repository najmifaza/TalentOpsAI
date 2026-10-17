import asyncio
import json
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.hidden_text_detector import audit_docx_hidden_text
from app.core.llm_adapter import LLMAdapter, compute_file_hash, register_pre_cached_fixture
from app.core.prompt import build_extraction_prompt
from app.schemas.extraction import CandidateExtractionSchema

DATASET_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "golden_dataset")


def clean_json_markdown(text: str) -> str:
    """Strip markdown backticks if model wrapped JSON in fences."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
    return cleaned.strip()


async def run_checks():
    # 1. Hidden text audit check
    dewi_docx = os.path.join(DATASET_DIR, "cv_04_dewi_sartika.docx")
    budi_docx = os.path.join(DATASET_DIR, "cv_01_budi_santoso.docx")

    _, dewi_hidden = audit_docx_hidden_text(dewi_docx)
    assert len(dewi_hidden) > 0, "Must detect hidden text in Dewi Sartika CV"
    assert "SYSTEM OVERRIDE" in dewi_hidden[0], "Hidden prompt snippet must match injection attempt"

    _, budi_hidden = audit_docx_hidden_text(budi_docx)
    assert len(budi_hidden) == 0, "Budi Santoso CV must contain zero hidden snippets"

    # 2. Extract Budi Santoso CV using LLM Adapter and Gemini 3.8
    budi_txt_path = os.path.join(DATASET_DIR, "cv_01_budi_santoso.txt")
    with open(budi_txt_path, "r", encoding="utf-8") as f:
        budi_text = f.read()

    adapter = LLMAdapter()
    file_hash = compute_file_hash(budi_text)
    messages = build_extraction_prompt(budi_text)

    res = await adapter.complete(messages=messages, file_hash=file_hash, use_cache=False)
    raw_json_str = clean_json_markdown(res["content"])
    parsed_dict = json.loads(raw_json_str)

    schema = CandidateExtractionSchema.model_validate(parsed_dict)
    schema.apply_substring_guard(budi_text)

    assert len(schema.claims) > 0, "Must extract technical claims"
    assert len(schema.career_timeline) >= 2, "Must extract career timeline"
    assert schema.education is not None, "Must extract education"
    assert schema.education.degree == "S1"

    # Verify that claims with implementation details are kept
    verified_claims = [c for c in schema.claims if c.has_implementation_detail]
    assert len(verified_claims) > 0, "At least one verified claim must exist"

    # 3. Seed pre-cached fixture so walking skeleton can run offline
    register_pre_cached_fixture(file_hash, schema.model_dump())

    fixtures_path = os.path.join(DATASET_DIR, "pre_cached_fixtures.json")
    fixtures = {file_hash: schema.model_dump()}
    with open(fixtures_path, "w", encoding="utf-8") as f:
        json.dump(fixtures, f, indent=2)

    print("ALL CHECKS PASSED: Golden dataset generation, hidden text detector, & LLM extraction validated.")


if __name__ == "__main__":
    asyncio.run(run_checks())
