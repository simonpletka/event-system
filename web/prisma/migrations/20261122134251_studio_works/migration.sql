-- CreateTable
CREATE TABLE "StudioWork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "app" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudioWork_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudioWork_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudioWork_app_idx" ON "StudioWork"("app");

-- CreateIndex
CREATE INDEX "StudioWork_projectId_idx" ON "StudioWork"("projectId");
