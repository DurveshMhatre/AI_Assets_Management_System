-- CreateTable
CREATE TABLE "MappingFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "excelHeaderOriginal" TEXT NOT NULL,
    "excelHeaderNormalized" TEXT NOT NULL,
    "mappedSystemField" TEXT NOT NULL,
    "wasCorrect" BOOLEAN NOT NULL,
    "confidenceScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MappingFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgMappingPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "excelHeaderNormalized" TEXT NOT NULL,
    "systemField" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "successRate" REAL NOT NULL DEFAULT 1.0,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgMappingPattern_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT NOT NULL DEFAULT '[]',
    "importedBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mappingConfidenceAvg" REAL,
    "mappingRequiredManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ImportJob_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ImportJob" ("completedAt", "createdAt", "errorLog", "errorRows", "fileName", "id", "importedBy", "organizationId", "processedRows", "status", "totalRows") SELECT "completedAt", "createdAt", "errorLog", "errorRows", "fileName", "id", "importedBy", "organizationId", "processedRows", "status", "totalRows" FROM "ImportJob";
DROP TABLE "ImportJob";
ALTER TABLE "new_ImportJob" RENAME TO "ImportJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MappingFeedback_organizationId_excelHeaderNormalized_idx" ON "MappingFeedback"("organizationId", "excelHeaderNormalized");

-- CreateIndex
CREATE INDEX "MappingFeedback_mappedSystemField_idx" ON "MappingFeedback"("mappedSystemField");

-- CreateIndex
CREATE INDEX "OrgMappingPattern_organizationId_idx" ON "OrgMappingPattern"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMappingPattern_organizationId_excelHeaderNormalized_systemField_key" ON "OrgMappingPattern"("organizationId", "excelHeaderNormalized", "systemField");
