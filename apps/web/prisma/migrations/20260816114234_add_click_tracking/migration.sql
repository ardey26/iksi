-- AlterTable
ALTER TABLE "LongURL" ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Click" (
    "id" BIGSERIAL NOT NULL,
    "urlId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT,
    "country" TEXT,
    "browser" TEXT,
    "device" TEXT,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Click_urlId_createdAt_idx" ON "Click"("urlId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Click_createdAt_idx" ON "Click"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Click_country_idx" ON "Click"("country");

-- CreateIndex
CREATE INDEX "Click_referrer_idx" ON "Click"("referrer");

-- CreateIndex
CREATE INDEX "Click_device_idx" ON "Click"("device");

-- CreateIndex
CREATE INDEX "LongURL_clickCount_idx" ON "LongURL"("clickCount" DESC);

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "LongURL"("id") ON DELETE CASCADE ON UPDATE CASCADE;

