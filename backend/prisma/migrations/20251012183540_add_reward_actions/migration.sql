-- CreateEnum
CREATE TYPE "RewardActionType" AS ENUM ('RESTAKING', 'SELL');

-- CreateTable
CREATE TABLE "RewardAction" (
    "id" TEXT NOT NULL,
    "actionType" "RewardActionType" NOT NULL,
    "amount" TEXT NOT NULL,
    "averagePrice" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardAction_pkey" PRIMARY KEY ("id")
);
