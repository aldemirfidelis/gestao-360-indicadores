-- CreateEnum
CREATE TYPE "CommPostType" AS ENUM ('SIMPLE', 'BANNER', 'VIDEO', 'POLL', 'SURVEY', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "CommPostPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'URGENT');

-- CreateEnum
CREATE TYPE "CommPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommReactionType" AS ENUM ('LIKE', 'UNDERSTOOD', 'IMPORTANT', 'QUESTION');

-- CreateEnum
CREATE TYPE "CommCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommMediaType" AS ENUM ('IMAGE', 'BANNER', 'VIDEO', 'PDF', 'DOCUMENT', 'ICON', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "CommMediaStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CommunicationPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content" TEXT NOT NULL,
    "type" "CommPostType" NOT NULL DEFAULT 'SIMPLE',
    "category" TEXT NOT NULL DEFAULT 'Institucional',
    "priority" "CommPostPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CommPostStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "approverId" TEXT,
    "approvalComment" TEXT,
    "audience" JSONB NOT NULL,
    "channels" JSONB NOT NULL,
    "poll" JSONB,
    "attachments" JSONB,
    "history" JSONB,
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "bannerUrl" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "estimatedMinutes" INTEGER,
    "requiresReadConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "requiresPollAnswer" BOOLEAN NOT NULL DEFAULT false,
    "requiresVideoCompletion" BOOLEAN NOT NULL DEFAULT false,
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowReactions" BOOLEAN NOT NULL DEFAULT true,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publicLinkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "qrCodeValue" TEXT,
    "linkedModule" TEXT,
    "linkedEntityId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPostRead" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "channel" TEXT,
    "device" TEXT,
    "ip" TEXT,
    "dwellSeconds" INTEGER,

    CONSTRAINT "CommunicationPostRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CommReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPostReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "moderated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPollResponse" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPollResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationCampaign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "category" TEXT,
    "status" "CommCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "targetAudience" JSONB,
    "indicatorIds" JSONB,
    "actionIds" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationMedia" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommMediaType" NOT NULL DEFAULT 'IMAGE',
    "category" TEXT,
    "tags" JSONB,
    "url" TEXT,
    "ownerAreaId" TEXT,
    "authorId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "CommMediaStatus" NOT NULL DEFAULT 'ACTIVE',
    "validUntil" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationPost_companyId_status_idx" ON "CommunicationPost"("companyId", "status");

-- CreateIndex
CREATE INDEX "CommunicationPost_companyId_publishedAt_idx" ON "CommunicationPost"("companyId", "publishedAt");

-- CreateIndex
CREATE INDEX "CommunicationPost_campaignId_idx" ON "CommunicationPost"("campaignId");

-- CreateIndex
CREATE INDEX "CommunicationPostRead_userId_idx" ON "CommunicationPostRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPostRead_postId_userId_key" ON "CommunicationPostRead"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPostReaction_postId_userId_key" ON "CommunicationPostReaction"("postId", "userId");

-- CreateIndex
CREATE INDEX "CommunicationPostComment_postId_idx" ON "CommunicationPostComment"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPollResponse_postId_userId_key" ON "CommunicationPollResponse"("postId", "userId");

-- CreateIndex
CREATE INDEX "CommunicationCampaign_companyId_status_idx" ON "CommunicationCampaign"("companyId", "status");

-- CreateIndex
CREATE INDEX "CommunicationMedia_companyId_status_idx" ON "CommunicationMedia"("companyId", "status");

-- AddForeignKey
ALTER TABLE "CommunicationPost" ADD CONSTRAINT "CommunicationPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPost" ADD CONSTRAINT "CommunicationPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPostRead" ADD CONSTRAINT "CommunicationPostRead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunicationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPostReaction" ADD CONSTRAINT "CommunicationPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunicationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPostComment" ADD CONSTRAINT "CommunicationPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunicationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPollResponse" ADD CONSTRAINT "CommunicationPollResponse_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunicationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMedia" ADD CONSTRAINT "CommunicationMedia_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

