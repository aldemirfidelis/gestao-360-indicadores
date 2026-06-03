-- Message attachments stored by the API, plus help center and user integration preferences.

ALTER TABLE "MessageAttachment"
  ALTER COLUMN "fileUrl" DROP NOT NULL,
  ADD COLUMN "uploadedById" TEXT,
  ADD COLUMN "data" BYTEA,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "MessageAttachment_uploadedById_idx" ON "MessageAttachment"("uploadedById");

ALTER TABLE "MessageAttachment"
  ADD CONSTRAINT "MessageAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HelpCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HelpCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HelpCategory_slug_key" ON "HelpCategory"("slug");
CREATE INDEX "HelpCategory_published_position_idx" ON "HelpCategory"("published", "position");

CREATE TABLE "HelpArticle" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "body" TEXT NOT NULL,
  "tags" TEXT NOT NULL DEFAULT '[]',
  "roleVisibility" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "flowKey" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HelpArticle_slug_key" ON "HelpArticle"("slug");
CREATE INDEX "HelpArticle_categoryId_status_idx" ON "HelpArticle"("categoryId", "status");
CREATE INDEX "HelpArticle_status_updatedAt_idx" ON "HelpArticle"("status", "updatedAt");

ALTER TABLE "HelpArticle"
  ADD CONSTRAINT "HelpArticle_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "HelpCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HelpFeedback" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "userId" TEXT,
  "helpful" BOOLEAN NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HelpFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HelpFeedback_articleId_idx" ON "HelpFeedback"("articleId");
CREATE INDEX "HelpFeedback_userId_idx" ON "HelpFeedback"("userId");

ALTER TABLE "HelpFeedback"
  ADD CONSTRAINT "HelpFeedback_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "HelpArticle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HelpFeedback"
  ADD CONSTRAINT "HelpFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserIntegrationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" TEXT NOT NULL DEFAULT '{}',
  "lastTestAt" TIMESTAMP(3),
  "lastTestStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserIntegrationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserIntegrationPreference_userId_code_key" ON "UserIntegrationPreference"("userId", "code");
CREATE INDEX "UserIntegrationPreference_userId_idx" ON "UserIntegrationPreference"("userId");

ALTER TABLE "UserIntegrationPreference"
  ADD CONSTRAINT "UserIntegrationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
