import type { ModelOption } from "./providers";
export const adapterCapabilities = {
  protocol: "openai-compatible",
  streaming: true,
  tools: false,
  history: true,
} as const;
export function modelCatalog(data: unknown): ModelOption[] {
  if (!Array.isArray(data) || data.length > 10000)
    throw new Error("Invalid model catalog");
  return data.map((m) => {
    if (!m || typeof m.id !== "string") throw new Error("Invalid model");
    return {
      id: m.id,
      name: typeof m.name === "string" ? m.name : m.id,
      ...(typeof m.context_length === "number"
        ? { contextWindow: m.context_length }
        : {}),
      ...(Array.isArray(m.architecture?.input_modalities)
        ? { inputModalities: m.architecture.input_modalities }
        : {}),
      ...(Array.isArray(m.architecture?.output_modalities)
        ? { outputModalities: m.architecture.output_modalities }
        : {}),
    };
  });
}
export function streamDelta(event: {
  error?: unknown;
  choices?: { delta?: { content?: unknown }; finish_reason?: string | null }[];
}) {
  if (event.error) throw new Error("PROVIDER_STREAM_FAILED");
  return {
    text:
      typeof event.choices?.[0]?.delta?.content === "string"
        ? (event.choices[0].delta!.content as string)
        : "",
    finished: !!event.choices?.[0]?.finish_reason,
  };
}
export function boundedMessages(
  system: string,
  history: { role: string; content: string }[],
  latest: string,
  contextWindow?: number,
) {
  const budget = Math.min(48000, Math.max(6000, (contextWindow ?? 8192) * 2));
  if (latest.length > Math.floor(budget / 2))
    throw new Error("MESSAGE_CONTEXT_LIMIT");
  const input = latest;
  const instruction = system.slice(0, Math.floor(budget / 3));
  let left = budget - input.length - instruction.length;
  const kept: { role: string; content: string }[] = [];
  for (const m of history.slice(-30).reverse()) {
    if (m.content.length > left) break;
    kept.unshift(m);
    left -= m.content.length;
  }
  while (kept.length && kept[0].role !== "user") kept.shift();
  return [
    { role: "system", content: instruction },
    ...kept,
    { role: "user", content: input },
  ];
}
export type ConnectionEvidence = {
  catalog?: { checkedAt: string; status: string };
  authentication?: { checkedAt: string; status: string };
  tests?: Record<
    string,
    { checkedAt: string; status: string; latencyMs?: number }
  >;
  bridge?: {
    version?: string;
    login?: string;
    restricted?: boolean;
    provider?: string;
    error?: string;
  };
};
export function connectionStatus(evidence: ConnectionEvidence) {
  if (Object.values(evidence.tests ?? {}).some((t) => t.status === "completed"))
    return "tested";
  if (evidence.authentication?.status === "verified") return "authenticated";
  return evidence.catalog?.status === "reachable" ? "reachable" : "unverified";
}
