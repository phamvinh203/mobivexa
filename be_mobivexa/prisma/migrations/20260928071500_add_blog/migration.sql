-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlogContentType" AS ENUM ('NEWS', 'SMARTPHONE_NEWS', 'REVIEW', 'COMPARISON', 'GUIDE', 'TIP_ANDROID', 'TIP_IPHONE', 'BUYING_ADVICE', 'TOP_LIST', 'PROMOTION', 'BRAND_NEWS', 'ACCESSORY', 'KNOWLEDGE', 'FAQ');

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT,
    "coverImagePublicId" TEXT,
    "categoryId" TEXT,
    "contentType" "BlogContentType",
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "authorDisplayName" TEXT NOT NULL,
    "readingTimeMinutes" INTEGER NOT NULL DEFAULT 1,
    "isReadingTimeManual" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "canonicalUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_tags" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "blog_post_tags_pkey" PRIMARY KEY ("postId", "tagId")
);

-- CreateTable
CREATE TABLE "blog_post_products" (
    "postId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "blog_post_products_pkey" PRIMARY KEY ("postId", "productId")
);

-- CreateTable
CREATE TABLE "blog_related_posts" (
    "postId" TEXT NOT NULL,
    "relatedPostId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "blog_related_posts_pkey" PRIMARY KEY ("postId", "relatedPostId")
);

-- CreateTable
CREATE TABLE "blog_post_faqs" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "blog_post_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");
CREATE INDEX "blog_categories_parentId_idx" ON "blog_categories"("parentId");
CREATE UNIQUE INDEX "blog_tags_name_key" ON "blog_tags"("name");
CREATE UNIQUE INDEX "blog_tags_slug_key" ON "blog_tags"("slug");
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");
CREATE INDEX "blog_posts_status_publishedAt_idx" ON "blog_posts"("status", "publishedAt");
CREATE INDEX "blog_posts_categoryId_status_publishedAt_idx" ON "blog_posts"("categoryId", "status", "publishedAt");
CREATE INDEX "blog_posts_status_scheduledAt_idx" ON "blog_posts"("status", "scheduledAt");
CREATE INDEX "blog_posts_authorId_idx" ON "blog_posts"("authorId");
CREATE INDEX "blog_posts_updatedById_idx" ON "blog_posts"("updatedById");
CREATE INDEX "blog_post_tags_tagId_idx" ON "blog_post_tags"("tagId");
CREATE INDEX "blog_post_products_productId_idx" ON "blog_post_products"("productId");
CREATE INDEX "blog_related_posts_relatedPostId_idx" ON "blog_related_posts"("relatedPostId");
CREATE INDEX "blog_post_faqs_postId_sortOrder_idx" ON "blog_post_faqs"("postId", "sortOrder");

-- AddForeignKey
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "blog_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_post_products" ADD CONSTRAINT "blog_post_products_postId_fkey" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_post_products" ADD CONSTRAINT "blog_post_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_related_posts" ADD CONSTRAINT "blog_related_posts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_related_posts" ADD CONSTRAINT "blog_related_posts_relatedPostId_fkey" FOREIGN KEY ("relatedPostId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_post_faqs" ADD CONSTRAINT "blog_post_faqs_postId_fkey" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search expression used by blog.service.searchPosts
CREATE INDEX "idx_blog_posts_fts" ON "blog_posts" USING GIN ((
    setweight(to_tsvector('simple', "title"), 'A') ||
    setweight(to_tsvector('simple', coalesce("excerpt", '')), 'B')
));
