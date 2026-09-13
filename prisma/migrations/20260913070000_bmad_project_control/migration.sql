-- CreateTable
CREATE TABLE "bmad_project_runtimes" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "gatewayBaseUrl" TEXT,
    "gatewayModel" TEXT,
    "encryptedGatewayKey" TEXT,
    "installedVersion" TEXT,
    "installStatus" TEXT NOT NULL DEFAULT 'not_scanned',
    "tools" JSONB,
    "modules" JSONB,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmad_project_runtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bmad_agents" (
    "id" TEXT NOT NULL,
    "runtimeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "skillName" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🤖',
    "description" TEXT,
    "persona" JSONB,
    "source" TEXT NOT NULL DEFAULT 'discovered',
    "scope" TEXT NOT NULL DEFAULT 'team',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmad_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bmad_skills" (
    "id" TEXT NOT NULL,
    "runtimeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "directory" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'installed',
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "customizeSchema" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmad_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bmad_conversations" (
    "id" TEXT NOT NULL,
    "runtimeId" TEXT NOT NULL,
    "agentId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmad_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bmad_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "proposals" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bmad_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bmad_operations" (
    "id" TEXT NOT NULL,
    "runtimeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payload" JSONB NOT NULL,
    "preview" JSONB,
    "output" TEXT,
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmad_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bmad_project_runtimes_repoId_key" ON "bmad_project_runtimes"("repoId");

-- CreateIndex
CREATE UNIQUE INDEX "bmad_agents_runtimeId_slug_key" ON "bmad_agents"("runtimeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "bmad_skills_runtimeId_name_key" ON "bmad_skills"("runtimeId", "name");

-- CreateIndex
CREATE INDEX "bmad_conversations_runtimeId_updatedAt_idx" ON "bmad_conversations"("runtimeId", "updatedAt");

-- CreateIndex
CREATE INDEX "bmad_messages_conversationId_createdAt_idx" ON "bmad_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "bmad_operations_runtimeId_status_createdAt_idx" ON "bmad_operations"("runtimeId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "bmad_project_runtimes" ADD CONSTRAINT "bmad_project_runtimes_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_agents" ADD CONSTRAINT "bmad_agents_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "bmad_project_runtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_skills" ADD CONSTRAINT "bmad_skills_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "bmad_project_runtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_conversations" ADD CONSTRAINT "bmad_conversations_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "bmad_project_runtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_conversations" ADD CONSTRAINT "bmad_conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "bmad_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_messages" ADD CONSTRAINT "bmad_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "bmad_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmad_operations" ADD CONSTRAINT "bmad_operations_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "bmad_project_runtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
