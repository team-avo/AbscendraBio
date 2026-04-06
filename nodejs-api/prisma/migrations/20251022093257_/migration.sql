-- CreateEnum
CREATE TYPE "ShipmentRequestStatus" AS ENUM ('CREATED', 'ACCEPTED_BY_SHIPPER', 'ON_THE_WAY', 'DELIVERED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "estimatedShippingCost" DECIMAL(10,2),
ADD COLUMN     "shipmentRequestStatus" "ShipmentRequestStatus",
ADD COLUMN     "shipmentTrackingNumber" TEXT;

-- CreateTable
CREATE TABLE "shipment_tracking_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_tracking_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
