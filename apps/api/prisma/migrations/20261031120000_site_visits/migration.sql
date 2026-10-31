-- Visitantes do site e da demonstração (Portal Admin Global): uma linha por visita às páginas
-- públicas, com origem, localização aproximada pelo IP, rolagem da página inicial, entrada e
-- navegação na demonstração e contato; os eventos formam a linha do tempo de cada visita.
-- O formulário de contato passa a guardar a visita em que foi enviado.

-- AlterTable
ALTER TABLE "PublicContactMessage" ADD COLUMN "siteVisitId" TEXT;

-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeMs" INTEGER NOT NULL DEFAULT 0,
    "demoMs" INTEGER NOT NULL DEFAULT 0,
    "maxScrollPct" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "geoAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "device" TEXT NOT NULL,
    "browser" TEXT,
    "os" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "screen" TEXT,
    "timezone" TEXT,
    "entryPath" TEXT NOT NULL,
    "referrer" TEXT,
    "referrerHost" TEXT,
    "source" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "pages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "sections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "demoClicks" INTEGER NOT NULL DEFAULT 0,
    "firstDemoClickAt" TIMESTAMP(3),
    "demoStartedAt" TIMESTAMP(3),
    "demoErrors" INTEGER NOT NULL DEFAULT 0,
    "demoPageViews" INTEGER NOT NULL DEFAULT 0,
    "demoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "demoPathCount" INTEGER NOT NULL DEFAULT 0,
    "whatsappAt" TIMESTAMP(3),
    "formAt" TIMESTAMP(3),
    "eventCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteEvent" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicContactMessage_siteVisitId_idx" ON "PublicContactMessage"("siteVisitId");

-- CreateIndex
CREATE INDEX "SiteVisit_startedAt_idx" ON "SiteVisit"("startedAt");

-- CreateIndex
CREATE INDEX "SiteVisit_visitorId_startedAt_idx" ON "SiteVisit"("visitorId", "startedAt");

-- CreateIndex
CREATE INDEX "SiteVisit_geoAt_idx" ON "SiteVisit"("geoAt");

-- CreateIndex
CREATE INDEX "SiteEvent_visitId_createdAt_idx" ON "SiteEvent"("visitId", "createdAt");

-- AddForeignKey
ALTER TABLE "SiteEvent" ADD CONSTRAINT "SiteEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SiteVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
