-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "eligibilityResult";

-- AlterTable
ALTER TABLE "UrgentRequest" DROP COLUMN "urgencyLevel";

-- DropEnum
DROP TYPE "UrgencyLevel";
