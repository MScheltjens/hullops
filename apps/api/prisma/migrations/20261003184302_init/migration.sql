-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PROJECT_LEAD', 'WORKER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CLEANING', 'PROTECTION');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "ProtectionKind" AS ENUM ('ENCLOSURE', 'COVERING', 'FLOOR', 'COATING');

-- CreateEnum
CREATE TYPE "ProtectionMaterial" AS ENUM ('OSB_STANDARD', 'OSB_FIRE_RESISTANT', 'PROPLEX_3MM', 'PROPLEX_HD', 'GLASS_FIBER_FABRIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "serviceTypes" "ServiceType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vessel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imoNumber" TEXT,
    "vesselType" TEXT,
    "lengthM" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLANNED',
    "serviceType" "ServiceType" NOT NULL,
    "shipyard" TEXT NOT NULL,
    "berth" TEXT,
    "areaSqm" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vesselId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningDetails" (
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "surface" TEXT NOT NULL,

    CONSTRAINT "CleaningDetails_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "ProtectionDetails" (
    "orderId" TEXT NOT NULL,
    "kind" "ProtectionKind" NOT NULL,
    "protectedItem" TEXT,
    "materials" "ProtectionMaterial"[],
    "coatingProduct" TEXT,
    "layers" INTEGER,
    "targetThicknessUm" INTEGER,

    CONSTRAINT "ProtectionDetails_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "OrderAssignment" (
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAssignment_pkey" PRIMARY KEY ("orderId","userId")
);

-- CreateTable
CREATE TABLE "StatusUpdate" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "StatusUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusUpdateId" TEXT NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_imoNumber_key" ON "Vessel"("imoNumber");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_serviceType_idx" ON "Order"("serviceType");

-- CreateIndex
CREATE INDEX "Order_dueDate_idx" ON "Order"("dueDate");

-- CreateIndex
CREATE INDEX "Order_vesselId_idx" ON "Order"("vesselId");

-- CreateIndex
CREATE INDEX "StatusUpdate_orderId_createdAt_idx" ON "StatusUpdate"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningDetails" ADD CONSTRAINT "CleaningDetails_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionDetails" ADD CONSTRAINT "ProtectionDetails_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusUpdate" ADD CONSTRAINT "StatusUpdate_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusUpdate" ADD CONSTRAINT "StatusUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_statusUpdateId_fkey" FOREIGN KEY ("statusUpdateId") REFERENCES "StatusUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
