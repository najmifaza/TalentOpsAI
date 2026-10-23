-- ==============================================================================
-- TALENTOPS AI: BLOG POSTS (Public Blog & Admin CMS)
-- Tujuan: portal publik artikel inspirasi gaya blog.google / rumio.id
-- Hanya user role admin yang dapat create, edit, delete
-- ==============================================================================

CREATE TABLE IF NOT EXISTS blog_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    summary TEXT NOT NULL,
    content LONGTEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    author_name VARCHAR(100) DEFAULT 'Admin TalentOps',
    cover_image_url VARCHAR(500) NULL,
    read_time_minutes INT DEFAULT 3,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_blog_slug (slug),
    INDEX idx_blog_category (category),
    INDEX idx_blog_published_created (is_published, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
