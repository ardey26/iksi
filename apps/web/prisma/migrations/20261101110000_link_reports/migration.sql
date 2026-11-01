-- AlterTable
ALTER TABLE "LongURL" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderation" TEXT;

-- CreateTable
CREATE TABLE "LinkReport" (
    "id" SERIAL NOT NULL,
    "linkId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "email" TEXT,
    "ipHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkReport_linkId_status_createdAt_idx" ON "LinkReport"("linkId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LinkReport_status_createdAt_idx" ON "LinkReport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "LinkReport" ADD CONSTRAINT "LinkReport_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "LongURL"("id") ON DELETE CASCADE ON UPDATE CASCADE;

