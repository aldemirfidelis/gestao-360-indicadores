-- CreateTable
CREATE TABLE "UserDelegation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "delegatorUserId" TEXT NOT NULL,
    "delegateUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "scope" JSONB,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemFollow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "titleSnapshot" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItemFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDelegation_companyId_delegatorUserId_delegateUserId_startsAt_key" ON "UserDelegation"("companyId", "delegatorUserId", "delegateUserId", "startsAt");

-- CreateIndex
CREATE INDEX "UserDelegation_companyId_delegatorUserId_status_idx" ON "UserDelegation"("companyId", "delegatorUserId", "status");

-- CreateIndex
CREATE INDEX "UserDelegation_companyId_delegateUserId_status_idx" ON "UserDelegation"("companyId", "delegateUserId", "status");

-- CreateIndex
CREATE INDEX "UserDelegation_startsAt_endsAt_idx" ON "UserDelegation"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemFollow_companyId_userId_sourceEntityType_sourceEntityId_itemType_key" ON "WorkItemFollow"("companyId", "userId", "sourceEntityType", "sourceEntityId", "itemType");

-- CreateIndex
CREATE INDEX "WorkItemFollow_companyId_userId_pinned_idx" ON "WorkItemFollow"("companyId", "userId", "pinned");

-- CreateIndex
CREATE INDEX "WorkItemFollow_sourceEntityType_sourceEntityId_idx" ON "WorkItemFollow"("sourceEntityType", "sourceEntityId");

-- AddForeignKey
ALTER TABLE "UserDelegation" ADD CONSTRAINT "UserDelegation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegation" ADD CONSTRAINT "UserDelegation_delegatorUserId_fkey" FOREIGN KEY ("delegatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegation" ADD CONSTRAINT "UserDelegation_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemFollow" ADD CONSTRAINT "WorkItemFollow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemFollow" ADD CONSTRAINT "WorkItemFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
