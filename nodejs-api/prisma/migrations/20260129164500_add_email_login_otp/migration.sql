-- CreateTable
CREATE TABLE "email_login_otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_login_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_login_otps_userId_idx" ON "email_login_otps"("userId");

-- CreateIndex
CREATE INDEX "email_login_otps_email_idx" ON "email_login_otps"("email");

-- AddForeignKey
ALTER TABLE "email_login_otps" ADD CONSTRAINT "email_login_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
