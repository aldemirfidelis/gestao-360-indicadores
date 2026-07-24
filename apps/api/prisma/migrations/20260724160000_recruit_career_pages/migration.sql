CREATE TABLE "recruit_career_pages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "showInGlobalPortal" BOOLEAN NOT NULL DEFAULT true,
    "template" TEXT NOT NULL DEFAULT 'MODERN',
    "heroAlignment" TEXT NOT NULL DEFAULT 'LEFT',
    "headline" TEXT,
    "subheadline" TEXT,
    "bannerUrl" TEXT,
    "bannerStorageKey" TEXT,
    "bannerMimeType" TEXT,
    "logoUrl" TEXT,
    "logoStorageKey" TEXT,
    "logoMimeType" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0284c7',
    "accentColor" TEXT NOT NULL DEFAULT '#10b981',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f8fafc',
    "aboutTitle" TEXT,
    "aboutText" TEXT,
    "cultureTitle" TEXT,
    "cultureText" TEXT,
    "benefitsTitle" TEXT,
    "benefitsText" TEXT,
    "contactEmail" TEXT,
    "websiteUrl" TEXT,
    "linkedinUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "showAbout" BOOLEAN NOT NULL DEFAULT true,
    "showCulture" BOOLEAN NOT NULL DEFAULT true,
    "showBenefits" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruit_career_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruit_career_pages_companyId_key"
ON "recruit_career_pages"("companyId");

ALTER TABLE "recruit_career_pages"
ADD CONSTRAINT "recruit_career_pages_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
