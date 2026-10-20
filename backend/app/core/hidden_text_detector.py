"""
Hidden-content audit for uploaded resumes (DOCX + PDF).

Threat model (PRD Bab 6.1): a CV can carry instructions aimed at the LLM that a
human reviewer never sees — white-on-white text, 1pt glyphs, PDF render mode 3
(invisible text), or text positioned outside the visible page. Those payloads must
be stripped before sanitization and scoring, and surfaced as anomalies.

DOCX: OOXML run properties (`w:vanish`, `w:hidden`, white RGB, <=1pt).
PDF:  content-stream operator walk (`Tr`, `rg`/`g`/`k`, `Tf`, `Tm`/`Td`, `TJ`/`Tj`),
      plus detection of image-only pages that need OCR rather than silently
      returning empty text.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import docx
from docx.oxml.ns import qn

logger = logging.getLogger(__name__)

# Thresholds
MIN_VISIBLE_FONT_PT = 2.0
NEAR_WHITE_THRESHOLD = 0.95
TINY_IMAGE_PT = 6.0
MAX_XOBJECT_DEPTH = 2
INVISIBLE_RENDER_MODES = {3, 7}  # 3 = invisible, 7 = add to clip only


# ---------------------------------------------------------------------------
# DOCX
# ---------------------------------------------------------------------------

def audit_docx_hidden_text(docx_source: str | bytes) -> tuple[str, list[str]]:
    """
    Inspects DOCX for hidden elements (w:vanish, w:hidden, white font, 1pt font).
    Accepts filepath string or raw bytes.
    Returns (cleaned_text, detected_hidden_snippets).
    """
    if isinstance(docx_source, bytes):
        doc = docx.Document(io.BytesIO(docx_source))
    else:
        doc = docx.Document(docx_source)
    clean_paragraphs: list[str] = []
    hidden_snippets: list[str] = []

    for paragraph in doc.paragraphs:
        p_clean_runs: list[str] = []
        for run in paragraph.runs:
            is_hidden = False

            # Check w:vanish / w:hidden XML tags
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

    # Tables and headers are common hiding places too
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        rPr = run._r.rPr
                        hidden = False
                        if rPr is not None and (
                            rPr.find(qn("w:vanish")) is not None or rPr.find(qn("w:hidden")) is not None
                        ):
                            hidden = True
                        if run.font.color and run.font.color.rgb and str(run.font.color.rgb).upper() in ("FFFFFF", "FFF"):
                            hidden = True
                        if run.font.size and run.font.size.pt <= 1.0:
                            hidden = True
                        if hidden and run.text.strip():
                            hidden_snippets.append(run.text.strip())

    return "\n".join(clean_paragraphs), hidden_snippets


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

@dataclass
class PdfAuditResult:
    """Outcome of a PDF hidden-content audit."""
    visible_text: str = ""
    hidden_snippets: List[str] = field(default_factory=list)
    findings: List[Dict[str, Any]] = field(default_factory=list)
    image_only_pages: List[int] = field(default_factory=list)
    parsed_with: str = "content-stream"

    @property
    def hidden_text_detected(self) -> bool:
        return bool(self.hidden_snippets)

    @property
    def requires_ocr(self) -> bool:
        """True when pages carry images but no usable text layer."""
        return bool(self.image_only_pages)

    def finding_types(self) -> List[str]:
        return sorted({f["type"] for f in self.findings})


def _decode_pdf_string(value: Any) -> str:
    """Best-effort decode of a PDF string operand into text."""
    raw: Optional[bytes] = None
    if isinstance(value, (bytes, bytearray)):
        raw = bytes(value)
    elif hasattr(value, "original_bytes"):
        try:
            raw = value.original_bytes
        except Exception:
            raw = None
    if raw is None:
        return str(value)

    # UTF-16BE with BOM
    if raw[:2] in (b"\xfe\xff", b"\xff\xfe"):
        try:
            return raw.decode("utf-16")
        except Exception:
            pass
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("latin-1", errors="ignore")


def _is_near_white(color: Optional[Tuple[float, ...]]) -> bool:
    if not color:
        return False
    try:
        return all(float(c) >= NEAR_WHITE_THRESHOLD for c in color)
    except Exception:
        return False


def _audit_pdf_page_operations(operations, reader, page_index: int, result: PdfAuditResult,
                               depth: int = 0, state: Optional[Dict[str, Any]] = None) -> None:
    """
    Walks one content stream, tracking the text/graphics state and classifying each
    shown-text run as visible or hidden.

    `operations` may be a ContentStream or its `.operations` list — pypdf's
    ContentStream.__iter__ yields nothing in 6.x, so it must not be iterated directly.
    """
    from pypdf.generic import ContentStream

    op_list = operations.operations if isinstance(operations, ContentStream) else operations

    gs: Dict[str, Any] = dict(state or {})
    gs.setdefault("fill", None)        # (r,g,b) tuple or None
    gs.setdefault("font_size", None)   # float or None
    gs.setdefault("render_mode", 0)
    gs.setdefault("x", 0.0)
    gs.setdefault("y", 0.0)
    gs.setdefault("leading", 0.0)

    stack: List[Dict[str, Any]] = []
    visible_parts: List[str] = []

    def _flush_hidden(text: str, reason: str) -> None:
        snippet = text.strip()
        if not snippet:
            return
        result.hidden_snippets.append(snippet)
        result.findings.append({
            "type": reason,
            "page": page_index + 1,
            "severity": "HIGH" if reason in ("PDF_INVISIBLE_RENDER_MODE", "PDF_WHITE_TEXT") else "MEDIUM",
            "excerpt": snippet[:200],
        })

    def _flush_visible(text: str) -> None:
        if text:
            visible_parts.append(text)

    for operands, operator in op_list:
        try:
            if operator == b"q":
                stack.append(dict(gs))
            elif operator == b"Q":
                if stack:
                    gs = stack.pop()

            # ---- colors -------------------------------------------------
            elif operator in (b"rg", b"RG"):
                gs["fill"] = tuple(float(o) for o in operands[:3])
            elif operator in (b"g", b"G"):
                v = float(operands[0])
                gs["fill"] = (v, v, v)
            elif operator in (b"k", b"K"):
                c, m, y, k = (float(o) for o in operands[:4])
                # CMYK -> RGB approximation
                gs["fill"] = ((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k))
            elif operator in (b"sc", b"scn", b"SC", b"SCN"):
                if len(operands) >= 3:
                    try:
                        gs["fill"] = tuple(float(o) for o in operands[:3])
                    except Exception:
                        pass

            # ---- text state ---------------------------------------------
            elif operator == b"Tf":
                try:
                    gs["font_size"] = float(operands[1])
                except Exception:
                    pass
            elif operator == b"Tr":
                try:
                    gs["render_mode"] = int(operands[0])
                except Exception:
                    pass
            elif operator == b"TL":
                try:
                    gs["leading"] = float(operands[0])
                except Exception:
                    pass

            # ---- positioning --------------------------------------------
            elif operator == b"Tm":
                try:
                    gs["x"] = float(operands[4])
                    gs["y"] = float(operands[5])
                except Exception:
                    pass
            elif operator in (b"Td", b"TD"):
                try:
                    gs["x"] = gs.get("x", 0.0) + float(operands[0])
                    gs["y"] = gs.get("y", 0.0) + float(operands[1])
                except Exception:
                    pass
            elif operator == b"T*":
                gs["y"] = gs.get("y", 0.0) - float(gs.get("leading") or 0.0)

            # ---- shown text ---------------------------------------------
            elif operator in (b"Tj", b"'", b'"'):
                if operator == b"'":
                    gs["y"] = gs.get("y", 0.0) - float(gs.get("leading") or 0.0)
                text = _decode_pdf_string(operands[-1]) if operands else ""

                reason = None
                if int(gs.get("render_mode") or 0) in INVISIBLE_RENDER_MODES:
                    reason = "PDF_INVISIBLE_RENDER_MODE"
                elif _is_near_white(gs.get("fill")):
                    reason = "PDF_WHITE_TEXT"
                elif gs.get("font_size") is not None and float(gs["font_size"]) < MIN_VISIBLE_FONT_PT:
                    reason = "PDF_TINY_FONT"
                else:
                    # Off-page text (outside MediaBox/CropBox)
                    try:
                        box = reader.pages[page_index].mediabox
                        x0, y0 = float(box.left), float(box.bottom)
                        x1, y1 = float(box.right), float(box.top)
                        px, py = float(gs.get("x", 0.0)), float(gs.get("y", 0.0))
                        if px < x0 - 1 or px > x1 + 1 or py < y0 - 1 or py > y1 + 1:
                            reason = "PDF_OFFPAGE_TEXT"
                    except Exception:
                        pass

                if reason:
                    _flush_hidden(text, reason)
                else:
                    _flush_visible(text)

            elif operator == b"TJ":
                array = operands[0] if operands else []
                buffer: List[str] = []
                try:
                    items = list(array)
                except Exception:
                    items = []
                for item in items:
                    if isinstance(item, (int, float)):
                        # Kerning jump; large negative = visual space
                        if float(item) < -120:
                            buffer.append(" ")
                    else:
                        buffer.append(_decode_pdf_string(item))
                text = "".join(buffer)

                reason = None
                if int(gs.get("render_mode") or 0) in INVISIBLE_RENDER_MODES:
                    reason = "PDF_INVISIBLE_RENDER_MODE"
                elif _is_near_white(gs.get("fill")):
                    reason = "PDF_WHITE_TEXT"
                elif gs.get("font_size") is not None and float(gs["font_size"]) < MIN_VISIBLE_FONT_PT:
                    reason = "PDF_TINY_FONT"
                else:
                    try:
                        box = reader.pages[page_index].mediabox
                        px, py = float(gs.get("x", 0.0)), float(gs.get("y", 0.0))
                        if (px < float(box.left) - 1 or px > float(box.right) + 1
                                or py < float(box.bottom) - 1 or py > float(box.top) + 1):
                            reason = "PDF_OFFPAGE_TEXT"
                    except Exception:
                        pass

                if reason:
                    _flush_hidden(text, reason)
                else:
                    _flush_visible(text)

            # ---- nested form XObjects -----------------------------------
            elif operator == b"Do" and depth < MAX_XOBJECT_DEPTH and operands:
                name = operands[0]
                try:
                    resources = reader.pages[page_index].get("/Resources")
                    if resources is None:
                        continue
                    xobjects = resources.get_object().get("/XObject")
                    if xobjects is None:
                        continue
                    xobject = xobjects.get_object().get(name)
                    if xobject is None:
                        continue
                    xobject = xobject.get_object()
                    subtype = xobject.get("/Subtype")
                    if subtype == "/Form":
                        nested = ContentStream(xobject, reader)
                        _audit_pdf_page_operations(
                            nested, reader, page_index, result, depth + 1, dict(gs)
                        )
                    elif subtype == "/Image":
                        _flag_suspicious_image(xobject, gs, page_index, result)
                except Exception:
                    continue

        except Exception as exc:  # malformed operator: keep scanning
            logger.debug("PDF operator %r skipped on page %s: %s", operator, page_index + 1, exc)
            continue

    joined = "".join(visible_parts)
    if joined.strip():
        result.visible_text += ("\n" if result.visible_text else "") + joined.strip()


def _flag_suspicious_image(xobject, gs: Dict[str, Any], page_index: int, result: PdfAuditResult) -> None:
    """Flags near-invisible embedded images (1x1 pixels, fully transparent SMask)."""
    try:
        width = int(xobject.get("/Width") or 0)
        height = int(xobject.get("/Height") or 0)
    except Exception:
        return

    if 0 < width <= 2 and 0 < height <= 2:
        result.findings.append({
            "type": "PDF_MICRO_IMAGE",
            "page": page_index + 1,
            "severity": "MEDIUM",
            "excerpt": f"Embedded image {width}x{height}px (possible covert marker)",
        })


def audit_pdf_hidden_text(content: bytes, min_visible_font_pt: float = MIN_VISIBLE_FONT_PT) -> PdfAuditResult:
    """
    Audits a PDF for hidden text and image-only pages.

    Returns visible text with hidden runs removed, the hidden snippets, and
    structured findings. Falls back to pypdf's plain extraction (marked
    `parsed_with="fallback"`) when the content stream cannot be walked, so a
    malformed PDF degrades to "cannot verify" rather than crashing ingestion.
    """
    result = PdfAuditResult()

    try:
        import pypdf
        from pypdf.generic import ContentStream
    except Exception:
        logger.warning("pypdf unavailable; PDF hidden-text audit skipped.")
        result.parsed_with = "unavailable"
        return result

    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
        if getattr(reader, "is_encrypted", False):
            try:
                reader.decrypt("")
            except Exception:
                result.parsed_with = "encrypted"
                result.findings.append({
                    "type": "PDF_ENCRYPTED",
                    "page": None,
                    "severity": "HIGH",
                    "excerpt": "Encrypted PDF: content could not be audited",
                })
                return result

        for page_index, page in enumerate(reader.pages):
            page_text_before = len(result.visible_text)
            try:
                operations = ContentStream(page.get_contents(), reader)
                _audit_pdf_page_operations(operations, reader, page_index, result)
            except Exception as exc:
                logger.debug("Content stream walk failed on page %s: %s", page_index + 1, exc)

            # Image-only detection: page renders images but yields no text
            page_produced_text = len(result.visible_text) > page_text_before
            if not page_produced_text and _page_has_images(page):
                result.image_only_pages.append(page_index + 1)
                result.findings.append({
                    "type": "PDF_IMAGE_ONLY_PAGE",
                    "page": page_index + 1,
                    "severity": "MEDIUM",
                    "excerpt": "No text layer; page appears to be a scan and needs OCR",
                })

        # Fallback only when the walk recovered nothing at all. If it stripped hidden
        # runs (findings present), re-extracting would re-inject the payload.
        if not result.visible_text.strip() and not result.findings:
            try:
                fallback = "\n".join(
                    (p.extract_text() or "") for p in reader.pages
                ).strip()
                if fallback:
                    result.visible_text = fallback
                    result.parsed_with = "fallback"
            except Exception:
                pass

    except Exception as exc:
        logger.warning("PDF audit failed, degrading to raw text: %s", exc)
        result.parsed_with = "fallback"
        try:
            result.visible_text = content.decode("utf-8", errors="ignore")
        except Exception:
            result.visible_text = ""

    return result


def _page_has_images(page) -> bool:
    """True when the page's resources reference at least one image XObject."""
    try:
        resources = page.get("/Resources")
        if resources is None:
            return False
        xobjects = resources.get_object().get("/XObject")
        if xobjects is None:
            return False
        for _, ref in xobjects.get_object().items():
            try:
                if ref.get_object().get("/Subtype") == "/Image":
                    return True
            except Exception:
                continue
    except Exception:
        return False
    return False


# ---------------------------------------------------------------------------
# Unified dispatcher
# ---------------------------------------------------------------------------

def audit_document_hidden_text(content: bytes, file_format: str) -> Tuple[str, List[str], PdfAuditResult | None]:
    """
    Audits hidden content for the given format.

    Returns (cleaned_text, hidden_snippets, pdf_result). `pdf_result` is None for
    DOCX. For PDFs with no text layer, `cleaned_text` is empty and the caller
    should treat the document as requiring OCR (see `pdf_result.requires_ocr`).
    """
    fmt = (file_format or "").lower()

    if fmt == "docx":
        cleaned, snippets = audit_docx_hidden_text(content)
        return cleaned, snippets, None

    if fmt == "pdf":
        pdf_result = audit_pdf_hidden_text(content)
        return pdf_result.visible_text, pdf_result.hidden_snippets, pdf_result

    return content.decode("utf-8", errors="ignore"), [], None
