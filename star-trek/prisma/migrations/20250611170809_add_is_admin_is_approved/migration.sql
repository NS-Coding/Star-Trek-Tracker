/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `WatchProgress` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[episodeId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[movieId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[seasonId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[showId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "WatchProgress" DROP CONSTRAINT "WatchProgress_userId_fkey";

-- DropIndex
DROP INDEX "WatchProgress_userId_episodeId_key";

-- DropIndex
DROP INDEX "WatchProgress_userId_movieId_key";

-- DropIndex
DROP INDEX "WatchProgress_userId_seasonId_key";

-- DropIndex
DROP INDEX "WatchProgress_userId_showId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WatchProgress" DROP COLUMN "userId";

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_episodeId_key" ON "WatchProgress"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_movieId_key" ON "WatchProgress"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_seasonId_key" ON "WatchProgress"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_showId_key" ON "WatchProgress"("showId");
