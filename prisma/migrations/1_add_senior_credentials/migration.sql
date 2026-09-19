-- Sign-in credentials for a senior.
--
-- Both columns are nullable: the table already has rows, so a NOT NULL column
-- could not be added without a backfill, and a senior in the demo data does not
-- need an account to be shown. The application treats "email AND passwordHash
-- both present" as the account existing.

-- AlterTable
ALTER TABLE "Senior" ADD COLUMN     "email" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Senior_email_key" ON "Senior"("email");
