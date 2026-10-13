import { parse } from "./toml";
import { mergeCustomization } from "./bmad-customization";
import fs from "node:fs/promises";
import { safeChild } from "./bmad-control";
import { customizationState } from "./agent-behavior";
export async function readCustomization(
  root: string,
  skill: string,
  schema: string | null,
  legacy: string | null,
  slug?: string,
) {
  const read = async (p: string) =>
    fs.readFile(safeChild(root, p), "utf8").catch(() => "");
  const [team, personal] = await Promise.all([
    read("_bmad/custom/" + skill + ".toml"),
    read("_bmad/custom/" + skill + ".user.toml"),
  ]);
  let central = {};
  for (const p of [
    "_bmad/config.toml",
    "_bmad/config.user.toml",
    "_bmad/custom/config.toml",
    "_bmad/custom/config.user.toml",
  ]) {
    const text = await read(p);
    if (text.trim()) central = mergeCustomization(central, parse(text));
  }
  const descriptor = (
    central as { agents?: Record<string, { persona?: unknown }> }
  ).agents?.[slug ?? skill];
  const original =
    typeof descriptor?.persona === "string" ? descriptor.persona : legacy;
  return customizationState(schema, team, personal, original);
}
