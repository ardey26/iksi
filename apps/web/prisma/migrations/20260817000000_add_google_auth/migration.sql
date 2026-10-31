-- AlterTable: make Twitter fields optional (users may now sign in with Google instead)
ALTER TABLE "User" ALTER COLUMN "twitterId" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "twitterHandle" DROP NOT NULL;

-- AlterTable: add Google identity columns
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "googleEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- Constraint: every user must have at least one identity provider
ALTER TABLE "User" ADD CONSTRAINT "user_has_provider"
  CHECK ("twitterId" IS NOT NULL OR "googleId" IS NOT NULL);
