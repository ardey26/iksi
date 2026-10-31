-- AlterTable
ALTER TABLE "LongURL" ADD COLUMN     "safeCheckedAt" TIMESTAMP(3),
ADD COLUMN     "safeVerdict" TEXT,
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Click" ADD COLUMN     "profileId" INTEGER,
ADD COLUMN     "rowId" INTEGER,
ADD COLUMN     "surface" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "twitterId" TEXT NOT NULL,
    "twitterHandle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Handle" (
    "id" SERIAL NOT NULL,
    "handle" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Handle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'default',
    "accent" TEXT NOT NULL DEFAULT '#3B82F6',
    "publicClicks" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileRow" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "linkId" INTEGER,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quarantined" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileView" (
    "id" BIGSERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT,
    "country" TEXT,

    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandleClaimRateLimit" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandleClaimRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_twitterId_key" ON "User"("twitterId");

-- CreateIndex
CREATE UNIQUE INDEX "Handle_handle_key" ON "Handle"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Handle_userId_key" ON "Handle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "ProfileRow_profileId_position_idx" ON "ProfileRow"("profileId", "position");

-- CreateIndex
CREATE INDEX "ProfileView_profileId_createdAt_idx" ON "ProfileView"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HandleClaimRateLimit_resetAt_idx" ON "HandleClaimRateLimit"("resetAt");

-- CreateIndex
CREATE INDEX "LongURL_userId_idx" ON "LongURL"("userId");

-- CreateIndex
CREATE INDEX "LongURL_safeCheckedAt_idx" ON "LongURL"("safeCheckedAt");

-- CreateIndex
CREATE INDEX "Click_profileId_createdAt_idx" ON "Click"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Click_rowId_createdAt_idx" ON "Click"("rowId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Click_surface_idx" ON "Click"("surface");

-- AddForeignKey
ALTER TABLE "Handle" ADD CONSTRAINT "Handle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRow" ADD CONSTRAINT "ProfileRow_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRow" ADD CONSTRAINT "ProfileRow_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "LongURL"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongURL" ADD CONSTRAINT "LongURL_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "ProfileRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

