/*
  Warnings:

  - You are about to drop the column `isAdmin` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,episodeId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,movieId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,seasonId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,showId]` on the table `WatchProgress` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `WatchProgress` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- DropIndex
DROP INDEX "WatchProgress_episodeId_key";

-- DropIndex
DROP INDEX "WatchProgress_movieId_key";

-- DropIndex
DROP INDEX "WatchProgress_seasonId_key";

-- DropIndex
DROP INDEX "WatchProgress_showId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isAdmin",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "WatchProgress" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_episodeId_key" ON "WatchProgress"("userId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_movieId_key" ON "WatchProgress"("userId", "movieId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_seasonId_key" ON "WatchProgress"("userId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_showId_key" ON "WatchProgress"("userId", "showId");

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
