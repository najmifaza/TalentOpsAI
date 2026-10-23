import logging
import math
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_roles
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/blog", tags=["Public & Admin Blog"])


def _slugify(text_val: str) -> str:
    s = text_val.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-")


def _calc_read_time(content: str) -> int:
    words = len(content.split())
    # ponytail: 200 wpm baseline reading speed; upgrade to syllable analyzer if needed
    return max(1, math.ceil(words / 200))


class BlogPostCreate(BaseModel):
    title: str = Field(..., max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    summary: str = Field(..., min_length=5)
    content: str = Field(..., min_length=10)
    category: str = Field(..., max_length=100)
    cover_image_url: Optional[str] = Field(None, max_length=500)
    author_name: Optional[str] = Field("Admin TalentOps", max_length=100)
    read_time_minutes: Optional[int] = Field(None, ge=1, le=60)
    is_published: bool = True


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    summary: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    cover_image_url: Optional[str] = Field(None, max_length=500)
    author_name: Optional[str] = Field(None, max_length=100)
    read_time_minutes: Optional[int] = Field(None, ge=1, le=60)
    is_published: Optional[bool] = None


@router.get("")
async def list_posts(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(9, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    offset = (page - 1) * limit
    where_clauses = ["is_published = 1"]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if category:
        where_clauses.append("category = :category")
        params["category"] = category

    if search:
        where_clauses.append("(title LIKE :search OR summary LIKE :search)")
        params["search"] = f"%{search.strip()}%"

    where_sql = " AND ".join(where_clauses)

    count_res = await db.execute(
        text(f"SELECT COUNT(*) as total FROM blog_posts WHERE {where_sql}"),
        params,
    )
    count_row = count_res.mappings().first()
    total = int(count_row["total"]) if count_row else 0

    query = text(f"""
        SELECT id, title, slug, summary, category, author_name, cover_image_url,
               read_time_minutes, is_published, created_at, updated_at
        FROM blog_posts
        WHERE {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    res = await db.execute(query, params)
    rows = [dict(r) for r in res.mappings().all()]
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        if r.get("updated_at"):
            r["updated_at"] = r["updated_at"].isoformat()

    # List distinct categories with counts for filter chips
    cat_res = await db.execute(
        text("SELECT category, COUNT(*) as count FROM blog_posts WHERE is_published = 1 GROUP BY category ORDER BY count DESC")
    )
    categories = [dict(c) for c in cat_res.mappings().all()]

    return {
        "items": rows,
        "total": total,
        "page": page,
        "total_pages": math.ceil(total / limit) if total > 0 else 1,
        "categories": categories,
    }


@router.get("/admin/all")
async def list_all_posts_admin(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: Dict[str, Any] = Depends(require_roles("admin")),
) -> Dict[str, Any]:
    offset = (page - 1) * limit
    count_res = await db.execute(text("SELECT COUNT(*) as total FROM blog_posts"))
    count_row = count_res.mappings().first()
    total = int(count_row["total"]) if count_row else 0

    res = await db.execute(
        text("""
            SELECT id, title, slug, summary, category, author_name, cover_image_url,
                   read_time_minutes, is_published, created_at, updated_at
            FROM blog_posts
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset},
    )
    rows = [dict(r) for r in res.mappings().all()]
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        if r.get("updated_at"):
            r["updated_at"] = r["updated_at"].isoformat()

    return {
        "items": rows,
        "total": total,
        "page": page,
        "total_pages": math.ceil(total / limit) if total > 0 else 1,
    }


@router.get("/{slug}")
async def get_post_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(
        text("""
            SELECT id, title, slug, summary, content, category, author_name,
                   cover_image_url, read_time_minutes, is_published, created_at, updated_at
            FROM blog_posts
            WHERE slug = :slug AND is_published = 1
        """),
        {"slug": slug},
    )
    row = res.mappings().first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ARTICLE_NOT_FOUND",
        )
    data = dict(row)
    if data.get("created_at"):
        data["created_at"] = data["created_at"].isoformat()
    if data.get("updated_at"):
        data["updated_at"] = data["updated_at"].isoformat()
    return data


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: BlogPostCreate,
    db: AsyncSession = Depends(get_db),
    _user: Dict[str, Any] = Depends(require_roles("admin")),
) -> Dict[str, Any]:
    slug = _slugify(payload.slug or payload.title)
    if not slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_SLUG",
        )

    # Check slug duplicate
    existing = await db.execute(text("SELECT id FROM blog_posts WHERE slug = :slug"), {"slug": slug})
    if existing.first():
        # Append short suffix
        slug = f"{slug}-{int(math.floor(math.fmod(float(len(payload.content)), 1000)))}"

    read_time = payload.read_time_minutes or _calc_read_time(payload.content)

    stmt = text("""
        INSERT INTO blog_posts (
            title, slug, summary, content, category, author_name,
            cover_image_url, read_time_minutes, is_published
        ) VALUES (
            :title, :slug, :summary, :content, :category, :author_name,
            :cover_image_url, :read_time_minutes, :is_published
        )
    """)
    await db.execute(
        stmt,
        {
            "title": payload.title.strip(),
            "slug": slug,
            "summary": payload.summary.strip(),
            "content": payload.content.strip(),
            "category": payload.category.strip(),
            "author_name": payload.author_name or "Admin TalentOps",
            "cover_image_url": payload.cover_image_url,
            "read_time_minutes": read_time,
            "is_published": 1 if payload.is_published else 0,
        },
    )
    await db.commit()

    res = await db.execute(text("SELECT * FROM blog_posts WHERE slug = :slug"), {"slug": slug})
    raw_row = res.mappings().first()
    if not raw_row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="FAILED_RETRIEVING_CREATED_POST")
    row = dict(raw_row)
    if row.get("created_at"):
        row["created_at"] = str(row["created_at"])
    if row.get("updated_at"):
        row["updated_at"] = str(row["updated_at"])
    return row


@router.put("/{post_id}")
async def update_post(
    post_id: int,
    payload: BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
    _user: Dict[str, Any] = Depends(require_roles("admin")),
) -> Dict[str, Any]:
    check = await db.execute(text("SELECT id, content FROM blog_posts WHERE id = :id"), {"id": post_id})
    existing = check.mappings().first()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ARTICLE_NOT_FOUND")

    updates = []
    params: Dict[str, Any] = {"id": post_id}

    if payload.title is not None:
        updates.append("title = :title")
        params["title"] = payload.title.strip()
    if payload.slug is not None:
        updates.append("slug = :slug")
        params["slug"] = _slugify(payload.slug)
    if payload.summary is not None:
        updates.append("summary = :summary")
        params["summary"] = payload.summary.strip()
    if payload.content is not None:
        updates.append("content = :content")
        params["content"] = payload.content.strip()
        if payload.read_time_minutes is None:
            updates.append("read_time_minutes = :read_time_minutes")
            params["read_time_minutes"] = _calc_read_time(payload.content)
    if payload.category is not None:
        updates.append("category = :category")
        params["category"] = payload.category.strip()
    if payload.cover_image_url is not None:
        updates.append("cover_image_url = :cover_image_url")
        params["cover_image_url"] = payload.cover_image_url
    if payload.author_name is not None:
        updates.append("author_name = :author_name")
        params["author_name"] = payload.author_name
    if payload.read_time_minutes is not None:
        updates.append("read_time_minutes = :read_time_minutes")
        params["read_time_minutes"] = payload.read_time_minutes
    if payload.is_published is not None:
        updates.append("is_published = :is_published")
        params["is_published"] = 1 if payload.is_published else 0

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NO_FIELDS_TO_UPDATE")

    sql = f"UPDATE blog_posts SET {', '.join(updates)} WHERE id = :id"
    await db.execute(text(sql), params)
    await db.commit()

    res = await db.execute(text("SELECT * FROM blog_posts WHERE id = :id"), {"id": post_id})
    raw_row = res.mappings().first()
    if not raw_row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="FAILED_RETRIEVING_UPDATED_POST")
    row = dict(raw_row)
    if row.get("created_at"):
        row["created_at"] = str(row["created_at"])
    if row.get("updated_at"):
        row["updated_at"] = str(row["updated_at"])
    return row


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _user: Dict[str, Any] = Depends(require_roles("admin")),
):
    check = await db.execute(text("SELECT id FROM blog_posts WHERE id = :id"), {"id": post_id})
    if not check.first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ARTICLE_NOT_FOUND")

    await db.execute(text("DELETE FROM blog_posts WHERE id = :id"), {"id": post_id})
    await db.commit()
    return None
