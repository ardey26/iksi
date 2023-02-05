/*
  Warnings:

  - You are about to drop the `shortURL` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "shortURL";

-- CreateTable
CREATE TABLE "URL_MODEL" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "longURL" TEXT NOT NULL,
    "shortURL" TEXT NOT NULL,

    CONSTRAINT "URL_MODEL_pkey" PRIMARY KEY ("id")
);
