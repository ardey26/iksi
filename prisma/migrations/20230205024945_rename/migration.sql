/*
  Warnings:

  - You are about to drop the `URL_MODEL` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "URL_MODEL";

-- CreateTable
CREATE TABLE "Url" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "longURL" TEXT NOT NULL,
    "shortURL" TEXT NOT NULL,

    CONSTRAINT "Url_pkey" PRIMARY KEY ("id")
);
