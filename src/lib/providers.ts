import { z } from "zod";
export const providerIds = [
  "ollama",
  "lm-studio",
  "openrouter",
  "codex-cli",
  "agy",
  "openai",
  "gemini",
  "custom",
] as const;
export const providerSchema = z.enum(providerIds);
export const providers = [
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://host.docker.internal:11434/v1",
    key: false,
  },
  {
    id: "lm-studio",
    name: "LM Studio",
    baseUrl: "http://host.docker.internal:1234/v1",
    key: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    key: true,
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    baseUrl: "http://host.docker.internal:3006/v1",
    key: true,
  },
  {
    id: "agy",
    name: "Antigravity CLI",
    baseUrl: "http://host.docker.internal:3005/v1",
    key: true,
  },
  {
    id: "openai",
    name: "OpenAI API",
    baseUrl: "https://api.openai.com/v1",
    key: true,
  },
  {
    id: "gemini",
    name: "Gemini API",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    key: true,
  },
  {
    id: "custom",
    name: "Custom endpoint",
    baseUrl: "http://host.docker.internal:8080/v1",
    key: false,
  },
];
export type ModelOption = { id: string; name: string };
export function requestHeaders(key: string) {
  return {
    "content-type": "application/json",
    ...(key ? { authorization: "Bearer " + key } : {}),
  };
}
export function validateEndpoint(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use an HTTP endpoint without embedded credentials");
  return value.replace(/\/$/, "");
}
