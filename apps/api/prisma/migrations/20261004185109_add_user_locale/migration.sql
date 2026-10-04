-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'DE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'EN';
