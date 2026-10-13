ALTER TABLE "bmad_connections" ADD COLUMN "evidence" JSONB;
CREATE TABLE "bmad_worker_leases" ("runtimeId" TEXT NOT NULL PRIMARY KEY,"operationId" TEXT NOT NULL UNIQUE,"workerId" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"heartbeatAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "bmad_worker_presence" ("id" TEXT NOT NULL PRIMARY KEY,"heartbeatAt" TIMESTAMP(3) NOT NULL,"capabilities" JSONB);
