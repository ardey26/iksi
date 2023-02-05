-- CreateTable
CREATE TABLE "shortURL" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "longURL" TEXT NOT NULL,

    CONSTRAINT "shortURL_pkey" PRIMARY KEY ("id")
);
