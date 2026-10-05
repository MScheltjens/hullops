-- CreateTable
CREATE TABLE "OrderComment" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "OrderComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderComment_orderId_createdAt_idx" ON "OrderComment"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
