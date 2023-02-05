/*
  Warnings:

  - You are about to drop the `Url` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Url";

-- CreateTable
CREATE TABLE "LongURL" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalURL" TEXT NOT NULL,
    "shortURL" TEXT NOT NULL,

    CONSTRAINT "LongURL_pkey" PRIMARY KEY ("id")
);
