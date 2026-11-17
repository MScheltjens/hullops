-- CreateTable
CREATE TABLE "CrewAssignment" (
    "weekStart" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,

    CONSTRAINT "CrewAssignment_pkey" PRIMARY KEY ("userId","weekStart")
);

-- CreateIndex
CREATE INDEX "CrewAssignment_vesselId_weekStart_idx" ON "CrewAssignment"("vesselId", "weekStart");

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
