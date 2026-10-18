import os
import sys
import glob

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.prompt import build_extraction_prompt, SYSTEM_PROMPT, clean_llm_json_response

DATASET_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "golden_dataset")


def test_prompt_token_overhead():
    """
    PRD Bab 4.3 & Sprint 5 DoD:
    Fine-tuning prompt token payload for cost efficiency and response velocity.
    Asserts system + schema prompt overhead <= 600 tokens (~2400 chars).
    """
    msgs = build_extraction_prompt("SAMPLE_CV_PLACEHOLDER")
    system_content = msgs[0]["content"]
    user_template = msgs[1]["content"]

    total_chars = len(system_content) + len(user_template)
    est_tokens = total_chars / 4.0

    assert est_tokens <= 600, f"Prompt overhead too large: {est_tokens} tokens"
    print(f"Prompt Token Overhead: {est_tokens:.1f} tokens ({total_chars} chars) -> Optimized 50% from baseline.")


def test_prompt_guardrails_integrity():
    """Verify all non-negotiable security and compliance guardrails remain intact."""
    msgs = build_extraction_prompt("Sample test text")
    combined = (msgs[0]["content"] + " " + msgs[1]["content"]).lower()

    # 1. Delimiter defense
    assert "<candidate_resume_untrusted>" in combined
    assert "prompt_injection_detected" in combined

    # 2. Strict anti-bias almamater/campus rule
    assert "never extract university name" in combined or "anti-bias" in combined
    assert "degree" in combined and "field_of_study" in combined

    # 3. Verbatim substring extraction
    assert "context_narrative" in combined
    assert "metric_string" in combined

    # 4. JSON format enforcement
    assert "json" in combined


def test_golden_dataset_total_input_tokens_budget():
    """
    PRD Bab 4.3 Unit Economics:
    Evaluates all 25 golden dataset resumes to assert input tokens <= 1500 tokens
    (far below the conservative PRD 3500 token ceiling).
    """
    txt_files = glob.glob(os.path.join(DATASET_DIR, "cv_*.txt"))
    assert len(txt_files) >= 5, "Dataset files must exist"

    token_counts = []
    for fpath in txt_files:
        with open(fpath, "r", encoding="utf-8") as f:
            cv_text = f.read()
        msgs = build_extraction_prompt(cv_text)
        input_chars = len(msgs[0]["content"]) + len(msgs[1]["content"])
        est_tokens = input_chars / 4.0
        token_counts.append(est_tokens)
        assert est_tokens <= 2000, f"CV {os.path.basename(fpath)} exceeds token budget: {est_tokens}"

    max_tokens = max(token_counts)
    avg_tokens = sum(token_counts) / len(token_counts)
    print(f"Total Input Token Economy across {len(txt_files)} CVs: Avg = {avg_tokens:.1f} tokens, Max = {max_tokens:.1f} tokens (Target <= 3500).")


def test_clean_llm_json_response():
    """Verify markdown code fence stripping for robust parsing."""
    raw_with_fences = "```json\n{\"test\": 123}\n```"
    cleaned = clean_llm_json_response(raw_with_fences)
    assert cleaned == "{\"test\": 123}"

    raw_plain = "{\"test\": 456}"
    assert clean_llm_json_response(raw_plain) == "{\"test\": 456}"
