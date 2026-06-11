-- CreateTable
CREATE TABLE "SchoolConfigurationForm" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "formData" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolConfigurationForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolConfigurationForm_schoolId_key" ON "SchoolConfigurationForm"("schoolId");

-- AddForeignKey
ALTER TABLE "SchoolConfigurationForm" ADD CONSTRAINT "SchoolConfigurationForm_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
