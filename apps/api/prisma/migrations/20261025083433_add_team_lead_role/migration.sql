/*
  Warnings:

  - You are about to drop the column `reportedBy` on the `StaffingRequest` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEAM_LEAD';

-- AlterTable
ALTER TABLE "StaffingRequest" DROP COLUMN "reportedBy";

-- AlterTable
ALTER TABLE "Vessel" ADD COLUMN     "teamLeadId" TEXT;

-- AddForeignKey
ALTER TABLE "Vessel" ADD CONSTRAINT "Vessel_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
