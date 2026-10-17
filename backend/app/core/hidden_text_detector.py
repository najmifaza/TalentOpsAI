import docx
from docx.oxml.ns import qn

# ponytail: Basic XML tag inspection for DOCX hidden text. Upgrade to PDF alpha-channel OCR scanner.
def audit_docx_hidden_text(docx_path: str) -> tuple[str, list[str]]:
    """
    PRD Bab 6.1: Inspects DOCX for hidden elements (w:vanish, white font, 1pt font).
    Returns (cleaned_text, detected_hidden_snippets).
    """
    doc = docx.Document(docx_path)
    clean_paragraphs: list[str] = []
    hidden_snippets: list[str] = []

    for paragraph in doc.paragraphs:
        p_clean_runs: list[str] = []
        for run in paragraph.runs:
            is_hidden = False

            # Check w:vanish XML tag
            rPr = run._r.rPr
            if rPr is not None and (rPr.find(qn("w:vanish")) is not None or rPr.find(qn("w:hidden")) is not None):
                is_hidden = True

            # Check font color RGB white #FFFFFF
            if run.font.color and run.font.color.rgb and str(run.font.color.rgb).upper() in ("FFFFFF", "FFF"):
                is_hidden = True

            # Check font size <= 1pt
            if run.font.size and run.font.size.pt <= 1.0:
                is_hidden = True

            text = run.text
            if is_hidden:
                if text.strip():
                    hidden_snippets.append(text.strip())
            else:
                p_clean_runs.append(text)

        p_text = "".join(p_clean_runs).strip()
        if p_text:
            clean_paragraphs.append(p_text)

    return "\n".join(clean_paragraphs), hidden_snippets
