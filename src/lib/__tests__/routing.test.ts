import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ runtime: vi.fn(), connection: vi.fn() }));
vi.mock("../db/client", () => ({
  prisma: {
    bmadProjectRuntime: { findFirst: mocks.runtime },
    bmadConnection: { findFirst: mocks.connection },
  },
}));
vi.mock("../db/helpers", () => ({ getAuthenticatedSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getGatewayForChat } from "../model-routing";
import { encryptSecret } from "../bmad-control";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.AGENT_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64url");
  mocks.connection.mockResolvedValue(null);
});
describe("Model routing isolation", () => {
  it("never sends project credentials to a legacy agent endpoint", async () => {
    mocks.runtime.mockResolvedValue({
      gatewayBaseUrl: "https://project.example/v1",
      gatewayModel: "project",
      encryptedGatewayKey: encryptSecret("project-key"),
      agents: [
        {
          id: "a",
          gatewayBaseUrl: "http://local.example/v1",
          gatewayModel: "local",
          encryptedGatewayKey: null,
        },
      ],
    });
    const r = await getGatewayForChat("repo", "owner", "a");
    expect(r?.apiKey).toBe("");
    expect(r?.gatewayModel).toBe("local");
  });
  it("selects the entire account-owned connection and model as one route", async () => {
    mocks.runtime.mockResolvedValue({
      connectionId: "project",
      modelId: "project-model",
      encryptedGatewayKey: encryptSecret("project-key"),
      agents: [{ id: "a", connectionId: "agent", modelId: "agent-model" }],
    });
    mocks.connection.mockResolvedValue({
      baseUrl: "https://agent.example/v1",
      encryptedKey: encryptSecret("agent-key"),
      name: "Agent connection",
    });
    const r = await getGatewayForChat("repo", "owner", "a");
    expect(mocks.connection).toHaveBeenCalledWith({
      where: { id: "agent", userId: "owner" },
    });
    expect(r).toMatchObject({
      apiKey: "agent-key",
      gatewayModel: "agent-model",
      gatewayBaseUrl: "https://agent.example/v1",
    });
  });
  it("cannot resolve an agent outside the owned runtime", async () => {
    mocks.runtime.mockResolvedValue({ agents: [{ id: "other" }] });
    expect(await getGatewayForChat("repo", "owner", "a")).toBeNull();
    expect(mocks.connection).not.toHaveBeenCalled();
  });
});
