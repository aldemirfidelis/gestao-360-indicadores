-- CreateTable
CREATE TABLE "MyDayAssistantLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "suggestion" TEXT,
    "explanation" TEXT,
    "contextData" JSONB,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "helpful" BOOLEAN,
    "feedback" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MyDayAssistantLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MyDayAssistantLog_companyId_userId_recommendationKey_key" ON "MyDayAssistantLog"("companyId", "userId", "recommendationKey");

-- CreateIndex
CREATE INDEX "MyDayAssistantLog_companyId_userId_hidden_idx" ON "MyDayAssistantLog"("companyId", "userId", "hidden");

-- CreateIndex
CREATE INDEX "MyDayAssistantLog_generatedAt_idx" ON "MyDayAssistantLog"("generatedAt");

-- AddForeignKey
ALTER TABLE "MyDayAssistantLog" ADD CONSTRAINT "MyDayAssistantLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MyDayAssistantLog" ADD CONSTRAINT "MyDayAssistantLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
