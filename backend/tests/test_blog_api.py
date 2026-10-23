import pytest
from app.api.blog import _slugify, _calc_read_time, BlogPostCreate, BlogPostUpdate


def test_slugify():
    assert _slugify("Teknologi AI dalam Rekrutmen 2026!") == "teknologi-ai-dalam-rekrutmen-2026"
    assert _slugify("  Panduan Memilih Properti & Karir  ") == "panduan-memilih-properti-karir"


def test_calc_read_time():
    short_text = "kata " * 50
    assert _calc_read_time(short_text) == 1
    medium_text = "kata " * 450
    assert _calc_read_time(medium_text) == 3


def test_blog_schemas_validation():
    post = BlogPostCreate(
        title="Inovasi AI TalentOps",
        summary="Ringkasan singkat artikel inovasi AI",
        content="Isi konten lengkap artikel inovasi AI TalentOps yang komprehensif...",
        category="Teknologi",
    )
    assert post.title == "Inovasi AI TalentOps"
    assert post.is_published is True
    assert post.author_name == "Admin TalentOps"

    update = BlogPostUpdate(title="Judul Baru")
    assert update.title == "Judul Baru"
    assert update.summary is None
