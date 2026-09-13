ALTER TABLE "bmad_agents"
  ADD COLUMN "providerLabel" TEXT,
  ADD COLUMN "gatewayBaseUrl" TEXT,
  ADD COLUMN "gatewayModel" TEXT,
  ADD COLUMN "encryptedGatewayKey" TEXT;