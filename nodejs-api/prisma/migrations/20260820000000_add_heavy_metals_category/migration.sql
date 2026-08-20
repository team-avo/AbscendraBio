-- Add HEAVY_METALS to the third-party report category enum (additive; no data change)
ALTER TYPE "ThirdPartyReportCategory" ADD VALUE IF NOT EXISTS 'HEAVY_METALS';
