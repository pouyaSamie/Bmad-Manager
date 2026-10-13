import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  repo: vi.fn(),
  conversation: vi.fn(),
  messages: vi.fn(),
  cursor: vi.fn(),
}));
vi.mock("@/lib/db/helpers", () => ({ getAuthenticatedSession: mocks.session }));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    repo: { findFirst: mocks.repo },
    bmadConversation: { findFirst: mocks.conversation },
    bmadMessage: { findMany: mocks.messages, findFirst: mocks.cursor },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getConversationMessages } from "@/actions/bmad-control-actions";
const input = {
  owner: "local",
  name: "project",
  agentId: "agent",
  conversationId: "conversation",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ userId: "owner" });
  mocks.repo.mockResolvedValue({
    id: "repo",
    localPath: "C:/workspace/project",
    sourceType: "local",
  });
  mocks.conversation.mockResolvedValue({ id: "conversation" });
  mocks.messages.mockResolvedValue([]);
  mocks.cursor.mockResolvedValue({ id: "cursor" });
});
it("rejects unauthenticated readers", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await getConversationMessages(input)).success).toBe(false);
  expect(mocks.messages).not.toHaveBeenCalled();
});
it("binds conversation reads to owner project and agent", async () => {
  mocks.conversation.mockResolvedValue(null);
  expect((await getConversationMessages(input)).success).toBe(false);
  expect(mocks.conversation).toHaveBeenCalledWith({
    where: {
      id: "conversation",
      agentId: "agent",
      runtime: { repoId: "repo" },
    },
  });
  expect(mocks.messages).not.toHaveBeenCalled();
});
it("paginates equal-time messages using their stable IDs", async () => {
  mocks.messages.mockResolvedValue(
    Array.from({ length: 51 }, (_, i) => ({
      id: "m-" + i,
      role: "assistant",
      content: "Message " + i,
      status: "completed",
      createdAt: new Date(0),
    })),
  );
  const r = await getConversationMessages(input);
  expect(r.success).toBe(true);
  if (r.success) {
    expect(r.data.messages).toHaveLength(50);
    expect(r.data.nextBefore).toBe("m-49");
  }
  await getConversationMessages({ ...input, before: "m-49" });
  expect(mocks.messages.mock.calls.at(-1)?.[0]).toMatchObject({
    cursor: { id: "m-49" },
    skip: 1,
  });
});
it("rejects a cursor from another conversation", async () => {
  mocks.cursor.mockResolvedValue(null);
  expect(
    (await getConversationMessages({ ...input, before: "other" })).success,
  ).toBe(false);
  expect(mocks.messages).not.toHaveBeenCalled();
});
