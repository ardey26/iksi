-- AlterTable
ALTER TABLE "LongURL" ADD COLUMN     "oneTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "secret" TEXT,
ADD COLUMN     "secretKind" TEXT;
