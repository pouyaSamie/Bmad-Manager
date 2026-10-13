import { it, expect } from "vitest";
import {
  modelCatalog,
  streamDelta,
  boundedMessages,
  connectionStatus,
} from "../model-adapters";
it("normalizes declared catalog capabilities without inventing limits", () => {
  expect(
    modelCatalog([
      {
        id: "m",
        context_length: 32000,
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["text"],
        },
      },
    ])[0],
  ).toMatchObject({ id: "m", contextWindow: 32000, inputModalities: ["text"] });
  expect(modelCatalog([{ id: "unknown" }])[0].contextWindow).toBeUndefined();
});
it("requires explicit provider termination and propagates errors", () => {
  expect(
    streamDelta({
      choices: [{ delta: { content: "partial" }, finish_reason: null }],
    }),
  ).toEqual({ text: "partial", finished: false });
  expect(streamDelta({ choices: [{ finish_reason: "stop" }] }).finished).toBe(
    true,
  );
  expect(() => streamDelta({ error: { message: "private path" } })).toThrow(
    "PROVIDER_STREAM_FAILED",
  );
});
it("bounds history and preserves the current message", () => {
  const history = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: "x".repeat(2000),
  }));
  const messages = boundedMessages(
    "s".repeat(24000),
    history,
    "Current message",
  );
  expect(messages.at(-1)?.content).toBe("Current message");
  expect(
    messages.reduce((n, m) => n + m.content.length, 0),
  ).toBeLessThanOrEqual(16384);
  expect(messages[1]?.role).toBe("user");
  expect(() => boundedMessages("", [], "x".repeat(16000), 4096)).toThrow(
    "MESSAGE_CONTEXT_LIMIT",
  );
});
it("keeps catalog evidence separate from authentication and model tests", () => {
  expect(
    connectionStatus({
      catalog: { status: "reachable", checkedAt: "now" },
      authentication: { status: "unknown", checkedAt: "now" },
    }),
  ).toBe("reachable");
  expect(
    connectionStatus({ tests: { m: { status: "failed", checkedAt: "now" } } }),
  ).toBe("unverified");
});
