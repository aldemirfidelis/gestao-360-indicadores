-- CreateTable
CREATE TABLE "PublicContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "requestType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicContactMessage_createdAt_idx" ON "PublicContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "PublicContactMessage_read_idx" ON "PublicContactMessage"("read");
