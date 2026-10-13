-- AlterTable
ALTER TABLE "bmad_agents" ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "modelId" TEXT;

-- AlterTable
ALTER TABLE "bmad_messages" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'completed';

-- AlterTable
ALTER TABLE "bmad_project_runtimes" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "modelId" TEXT;

-- CreateTable
CREATE TABLE "bmad_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "encryptedKey" TEXT,
    "models" JSONB,
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmad_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bmad_connections_userId_idx" ON "bmad_connections"("userId");

-- AddForeignKey
ALTER TABLE "bmad_project_runtimes" ADD CONSTRAINT "bmad_project_runtimes_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "bmad_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_agents" ADD CONSTRAINT "bmad_agents_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "bmad_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_connections" ADD CONSTRAINT "bmad_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
