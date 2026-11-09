"""Builds the GTNIC 2026 proposal DOCX from PROPOSAL_AI_RECRUITMENT_AGENT.md.

Format enforced: A4, Times New Roman 12 pt, 1.5 line spacing, margins 4/3/3/3 cm,
GTNIC 2026 logo on the cover (guidebook requirement), max 15 pages.

    python _build_proposal.py            # writes GTNIC2026_AIAgent_DoaIbu.docx
    python _build_proposal.py --pdf      # also exports PDF through Word (Windows)

Markdown is the source of truth; this script only renders it. Edit the .md, re-run.
"""

import argparse
import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

HERE = Path(__file__).resolve().parent
MD_PATH = HERE / "PROPOSAL_AI_RECRUITMENT_AGENT.md"
ASSETS = HERE / "assets"
DOCX_PATH = HERE / "GTNIC2026_AIAgent_DoaIbu.docx"
PDF_PATH = HERE / "GTNIC2026_AIAgent_DoaIbu.pdf"

FONT = "Times New Roman"
MONO = "Consolas"
BODY_PT = 12
CONTENT_WIDTH_CM = 14.0  # A4 21 cm - margin kiri 4 cm - margin kanan 3 cm


def _set_run_font(run, name=FONT, size=BODY_PT, bold=None, italic=None):
    run.font.name = name
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), name)


def _spacing(paragraph, line=1.5, before=0, after=6):
    fmt = paragraph.paragraph_format
    fmt.line_spacing = line
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)


def _shade(cell, hex_fill="F2F2F2"):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_fill)
    tc_pr.append(shd)


def setup_document() -> Document:
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(3.0)
    section.bottom_margin = Cm(3.0)
    section.left_margin = Cm(4.0)
    section.right_margin = Cm(3.0)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(BODY_PT)
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), FONT)
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    return doc


def _add_page_field(paragraph):
    run = paragraph.add_run()
    _set_run_font(run, size=10)
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._element.append(fld_begin)
    run._element.append(instr)
    run._element.append(fld_end)


# --------------------------------------------------------------------------- cover


def build_cover(doc: Document):
    """Cover must carry the official GTNIC 2026 logo (guidebook section 6)."""
    # Both marks live in one centered paragraph: a 3-column table pushed the pair
    # off the page centre because the logo widths are not equal.
    logo_para = doc.add_paragraph()
    logo_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _spacing(logo_para, line=1.0, before=0, after=10)
    marks = (("logo_gtnic.png", Cm(6.0)), ("logo_unsoed.png", Cm(3.0)))
    for index, (name, width) in enumerate(marks):
        if index:
            _set_run_font(logo_para.add_run("       "), size=12)
        path = ASSETS / name
        if path.exists():
            logo_para.add_run().add_picture(str(path), width=width)
        else:
            _set_run_font(logo_para.add_run(f"[{name} tidak ditemukan]"), size=10)

    def block(text, size, after=4, before=6):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _spacing(para, line=1.15, before=before, after=after)
        _set_run_font(para.add_run(text), size=size, bold=True)

    block("PROPOSAL KARYA INOVASI", 16, after=2)
    block("GARDA TECH NATIONAL INNOVATION COMPETITION", 12.5, after=2)
    block("(GTNIC) 2026", 13, after=2)
    block("KATEGORI LOMBA: AI AGENT DEVELOPMENT", 12, after=14)
    block("TALENTOPS AI", 15, after=2)
    block("SISTEM REKRUTMEN MANDIRI", 12.5, after=0)
    block("BERBASIS KECERDASAN BUATAN", 12.5, after=16)

    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _spacing(para, line=1.15, before=10, after=2)
    _set_run_font(para.add_run("Disusun oleh:"), size=12)
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _spacing(para, line=1.15, after=10)
    _set_run_font(para.add_run("Tim Doa Ibu"), size=12, bold=True)

    for name, nim in (
        ("Adridinan Najmi Faza", "H1D025059 (Ketua Tim)"),
        ("Timotius Willy Narendra", "H1D025052 (Anggota)"),
        ("Fardizza Vinda Rahman", "H1D025067 (Anggota)"),
    ):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _spacing(para, line=1.15, after=2)
        _set_run_font(para.add_run(name), size=12, bold=True, italic=True)
        _set_run_font(para.add_run(" : " + nim), size=12)

    for text, before in (
        ("JURUSAN INFORMATIKA", 150),
        ("FAKULTAS TEKNIK", 0),
        ("UNIVERSITAS JENDERAL SOEDIRMAN", 0),
        ("PURWOKERTO", 0),
        ("2026", 0),
    ):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _spacing(para, line=1.15, before=before, after=0)
        _set_run_font(para.add_run(text), size=12, bold=True)

    body_sec = doc.add_section()
    body_sec.page_width = Cm(21.0)
    body_sec.page_height = Cm(29.7)
    body_sec.top_margin = Cm(3.0)
    body_sec.bottom_margin = Cm(3.0)
    body_sec.left_margin = Cm(4.0)
    body_sec.right_margin = Cm(3.0)
    body_sec.footer.is_linked_to_previous = False

    pgNumType = OxmlElement("w:pgNumType")
    pgNumType.set(qn("w:start"), "1")
    body_sec._sectPr.append(pgNumType)

    footer = body_sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _set_run_font(footer.add_run("Halaman "), size=10)
    _add_page_field(footer)


# ---------------------------------------------------------------------- rendering


def add_inline(paragraph, text, size=BODY_PT):
    """Renders **bold**, *italic* and `code` spans of a markdown line."""
    text = text.replace("->", "\u2192").replace("<-", "\u2190")
    for token in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)", text):
        if not token:
            continue
        bold = italic = False
        if token.startswith("**") and token.endswith("**") and len(token) > 4:
            token, bold = token[2:-2], True
        elif token.startswith("*") and token.endswith("*") and len(token) > 2:
            token, italic = token[1:-1], True
        elif token.startswith("`") and token.endswith("`") and len(token) > 2:
            token, italic = token[1:-1], True
        run = paragraph.add_run(token)
        _set_run_font(run, size=size, bold=bold or None, italic=italic or None)


def add_table(doc: Document, rows):
    header, body = rows[0], rows[1:]
    table = doc.add_table(rows=len(rows), cols=len(header))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    col_width = Cm(CONTENT_WIDTH_CM / max(1, len(header)))
    for r, row in enumerate([header] + body):
        for col, text in enumerate(row[: len(header)]):
            cell = table.rows[r].cells[col]
            cell.width = col_width
            para = cell.paragraphs[0]
            _spacing(para, line=1.0, after=2)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            add_inline(para, text, size=10 if r == 0 else 9.5)
            if r == 0:
                _shade(cell)
                for run in para.runs:
                    run.bold = True
    spacer = doc.add_paragraph()
    _spacing(spacer, line=1.0, after=0)


def add_mono_block(doc: Document, lines):
    table = doc.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    cell = table.rows[0].cells[0]
    cell.paragraphs[0]._element.getparent().remove(cell.paragraphs[0]._element)
    for line in lines:
        para = cell.add_paragraph()
        _spacing(para, line=1.0, after=0)
        run = para.add_run(line.rstrip() or " ")
        _set_run_font(run, name=MONO, size=7.5)
    spacer = doc.add_paragraph()
    _spacing(spacer, line=1.0, after=0)


def split_table_row(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _is_block_start(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if stripped.startswith(("#", "|", "```", "---", "<!--")):
        return True
    return bool(re.match(r"^(\s*)([*\-]|\d+\.)\s+", line))


def _gather_continuation(lines, i):
    """Merges indented markdown soft-wraps into the current block's text.

    The draft writes ``* **Judul Karya:**`` followed by an indented value line.
    Without this merge the value became a separate paragraph flushed to the margin.
    """
    extra = []
    j = i + 1
    while j < len(lines) and not _is_block_start(lines[j]) and lines[j].startswith("  "):
        extra.append(lines[j].strip())
        j += 1
    return " ".join(extra), j


def render_body(doc: Document, md_text: str, start_marker: str):
    lines = md_text.split("\n")
    i = next(idx for idx, line in enumerate(lines) if line.strip().startswith(start_marker))
    list_counter = 0

    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped or stripped in ("---", "***", "<br>", "&nbsp;", "\\"):
            list_counter = 0
            i += 1
            continue

        img_match = re.match(r'^<p align="center">\s*<img\s+src="([^"]+)"[^>]*>\s*</p>', stripped, re.I) or re.match(r'^!\[([^\]]*)\]\(([^)]+)\)', stripped)
        if img_match:
            img_src = img_match.group(1) if len(img_match.groups()) == 1 else img_match.group(2)
            img_path = (HERE / img_src).resolve() if not Path(img_src).is_absolute() else Path(img_src)
            if img_path.exists():
                para = doc.add_paragraph()
                para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                _spacing(para, line=1.0, before=6, after=4)
                para.add_run().add_picture(str(img_path), width=Cm(CONTENT_WIDTH_CM))
            list_counter = 0
            i += 1
            continue

        if stripped.startswith("<!--") or re.match(
            r"^</?(style|div|p|img|h[1-6]|table|tr|td|section|article)\b", stripped, re.I
        ):
            i += 1
            continue

        if stripped.startswith("```"):
            block = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            i += 1
            add_mono_block(doc, block)
            list_counter = 0
            continue

        if stripped.startswith("|") and i + 1 < len(lines) and set(lines[i + 1].strip()) <= set("|-: "):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                if not set(lines[i].strip()) <= set("|-: "):
                    rows.append(split_table_row(lines[i]))
                i += 1
            if rows:
                add_table(doc, rows)
            list_counter = 0
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            level = len(heading.group(1))
            text = heading.group(2).replace("**", "").strip()
            para = doc.add_paragraph()
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            sizes = {1: 13, 2: 12.5, 3: 12, 4: 12}
            _spacing(para, line=1.15, before=12 if level <= 2 else 8, after=6)
            para.paragraph_format.keep_with_next = True
            _set_run_font(
                para.add_run(text),
                size=sizes[level],
                bold=True,
                italic=True if level >= 3 else None,
            )
            list_counter = 0
            i += 1
            continue

        bullet = re.match(r"^(\s*)[*\-]\s+(.*)$", line)
        if bullet:
            indent = len(bullet.group(1))
            text, nxt = _gather_continuation(lines, i)
            body = bullet.group(2) + ((" " + text) if text else "")
            # 2 spaces in the draft already means "child of the bullet above it".
            para = doc.add_paragraph(style="List Bullet" if indent < 2 else "List Bullet 2")
            _spacing(para, line=1.15, after=3)
            para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            # Explicit indents: Word's built-in list styles barely separate the levels.
            level = 0.65 if indent < 2 else 1.3
            para.paragraph_format.left_indent = Cm(level)
            para.paragraph_format.first_line_indent = Cm(-0.5)
            add_inline(para, body)
            list_counter = 0
            i = nxt
            continue

        numbered = re.match(r"^(\s*)(\d+)\.\s+(.*)$", line)
        if numbered:
            indent = len(numbered.group(1))
            text, nxt = _gather_continuation(lines, i)
            body = numbered.group(3) + ((" " + text) if text else "")
            # Manual numbering: Word's "List Number" style keeps one shared numbering
            # definition, which made the counter run across unrelated sections (44, 45...).
            if indent >= 2:
                prefix = "  " + numbered.group(2) + ". "
            else:
                list_counter += 1
                prefix = f"{list_counter}. "
            para = doc.add_paragraph()
            _spacing(para, line=1.15, after=3)
            para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            fmt = para.paragraph_format
            indent_cm = Cm(0.75 if indent < 2 else 1.5)
            fmt.left_indent = indent_cm
            fmt.first_line_indent = Cm(-0.75)
            fmt.tab_stops.add_tab_stop(indent_cm, WD_TAB_ALIGNMENT.LEFT)
            _set_run_font(para.add_run(prefix), size=BODY_PT)
            add_inline(para, body)
            i = nxt
            continue

        text, nxt = _gather_continuation(lines, i)
        body = stripped + ((" " + text) if text else "")
        para = doc.add_paragraph()
        _spacing(para, line=1.5, after=6)
        para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_inline(para, body)
        list_counter = 0
        i = nxt


def build_docx() -> Path:
    md_text = MD_PATH.read_text(encoding="utf-8")
    doc = setup_document()
    build_cover(doc)
    render_body(doc, md_text, "# PROPOSAL KARYA GARDA TECH NATIONAL INNOVATION COMPETITION")
    doc.save(DOCX_PATH)
    return DOCX_PATH


def export_pdf():
    import win32com.client

    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    doc = word.Documents.Open(str(DOCX_PATH))
    try:
        pages = doc.ComputeStatistics(2)  # wdStatisticPages
        doc.SaveAs(str(PDF_PATH), FileFormat=17)
    finally:
        doc.Close(False)
        word.Quit()
    return PDF_PATH, pages


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", action="store_true", help="export PDF via Word COM and print page count")
    args = parser.parse_args()
    out = build_docx()
    print(f"DOCX: {out} ({out.stat().st_size/1024:.1f} KB)")
    if args.pdf:
        pdf, pages = export_pdf()
        print(f"PDF : {pdf} ({pdf.stat().st_size/1024:.1f} KB) - {pages} halaman")
        if pages > 15:
            print("PERINGATAN: melebihi batas 15 halaman guidebook.")