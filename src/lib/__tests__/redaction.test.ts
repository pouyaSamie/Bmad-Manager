import { it, expect } from "vitest";
import { redact } from "../output-redaction";
it("redacts tokens in headers, JSON, env output, and host paths", () => {
  const out = redact(
    'Bearer secret-token {"apiKey":"json-secret"} CLI_BRIDGE_TOKEN=bridge-secret C:\\workspace\\private /home/user/private',
  );
  for (const secret of [
    "secret-token",
    "json-secret",
    "bridge-secret",
    "private",
  ])
    expect(out).not.toContain(secret);
  expect(out).toContain("[REDACTED]");
  expect(out).toContain("[path]");
});
