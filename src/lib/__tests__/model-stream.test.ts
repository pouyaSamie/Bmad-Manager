import { describe, it, expect } from "vitest";
import { sseData } from "../model-stream";
async function consume(chunks: Uint8Array[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((x) => c.enqueue(x));
      c.close();
    },
  });
  const values = [];
  for await (const data of sseData(stream)) values.push(data);
  return values;
}
describe("Model streaming", () => {
  it("buffers partial UTF-8 and event boundaries", async () => {
    const encoded = new TextEncoder().encode(
      'data: {"text":"سلام"}\n\ndata: [DONE]\n\n',
    );
    expect(await consume([...encoded].map((b) => Uint8Array.of(b)))).toEqual([
      '{"text":"سلام"}',
      "[DONE]",
    ]);
  });
  it("handles CRLF boundaries split between chunks", async () => {
    const encoded = new TextEncoder().encode(
      "data: one\r\n\r\ndata: two\r\n\r\n",
    );
    expect(await consume([...encoded].map((b) => Uint8Array.of(b)))).toEqual([
      "one",
      "two",
    ]);
  });
  it("ignores comments and joins multiline data", async () => {
    expect(
      await consume([
        new TextEncoder().encode(": heartbeat\ndata: first\ndata: second\n\n"),
      ]),
    ).toEqual(["first\nsecond"]);
  });
});
