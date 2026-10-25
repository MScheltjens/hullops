-- CreateTable
CREATE TABLE "StaffingRequest" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "workersNeeded" INTEGER NOT NULL,
    "workersActual" INTEGER,
    "reportedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vesselId" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,

    CONSTRAINT "StaffingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffingRequestWorker" (
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StaffingRequestWorker_pkey" PRIMARY KEY ("requestId","userId")
);

-- CreateIndex
CREATE INDEX "StaffingRequest_weekStart_idx" ON "StaffingRequest"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "StaffingRequest_vesselId_weekStart_key" ON "StaffingRequest"("vesselId", "weekStart");

-- CreateIndex
CREATE INDEX "StaffingRequestWorker_userId_idx" ON "StaffingRequestWorker"("userId");

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequestWorker" ADD CONSTRAINT "StaffingRequestWorker_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequestWorker" ADD CONSTRAINT "StaffingRequestWorker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
