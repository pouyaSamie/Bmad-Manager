import { parse } from "../toml";
import { mergeCustomization } from "../bmad-customization";
import yaml from "js-yaml";
import type { ContentProvider } from "@/lib/content-provider";

export interface BmadConfig {
  outputDir: string;
}

export const DEFAULT_OUTPUT_DIR = "_bmad-output";
export const CORE_CONFIG_PATH = "_bmad/core/config.yaml";

const PROJECT_ROOT_PREFIX = /^\{project-root\}\/+/;

function normalizeOutputFolder(raw: string): string | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;
  const stripped = trimmed.replace(PROJECT_ROOT_PREFIX, "");
  const cleaned = stripped.replace(/^\/+/, "").replace(/\/+$/, "");
  return cleaned || null;
}

export function parseConfigContent(content: string): BmadConfig | null {
  try {
    const data = yaml.load(content);
    if (!data || typeof data !== "object") return null;

    const raw = (data as Record<string, unknown>).output_folder;
    if (typeof raw !== "string") return null;

    const outputDir = normalizeOutputFolder(raw);
    if (!outputDir) return null;

    return { outputDir };
  } catch (e) {
    console.warn("[BMAD Config] Failed to parse config YAML:", e);
    return null;
  }
}

export async function getBmadConfig(
  provider: ContentProvider,
  paths: string[],
): Promise<BmadConfig> {
  const tomlPaths = [
    "_bmad/config.toml",
    "_bmad/config.user.toml",
    "_bmad/custom/config.toml",
    "_bmad/custom/config.user.toml",
  ].filter((p) => paths.includes(p));
  if (tomlPaths.length) {
    let doc = {};
    for (const p of tomlPaths)
      doc = mergeCustomization(doc, parse(await provider.getFileContent(p)));
    const core = (doc as { core?: Record<string, unknown> }).core ?? {};
    const output =
      typeof core.output_folder === "string"
        ? normalizeOutputFolder(core.output_folder)
        : DEFAULT_OUTPUT_DIR;
    const initiative =
      typeof core.active_initiative === "string" ? core.active_initiative : "";
    if (initiative.split("/").some((s) => s === ".." || s === "."))
      throw new Error("Invalid initiative path");
    return {
      outputDir:
        (output ?? DEFAULT_OUTPUT_DIR) + (initiative ? "/" + initiative : ""),
    };
  }
  if (!paths.includes(CORE_CONFIG_PATH)) {
    return { outputDir: DEFAULT_OUTPUT_DIR };
  }

  try {
    const content = await provider.getFileContent(CORE_CONFIG_PATH);
    const parsed = parseConfigContent(content);
    if (parsed) return parsed;
  } catch (e) {
    console.warn(`[BMAD Config] Failed to read ${CORE_CONFIG_PATH}:`, e);
  }

  return { outputDir: DEFAULT_OUTPUT_DIR };
}

/**
 * When `outputDir` is nested (e.g. "custom/out"), the LocalProvider whitelist
 * is extended at the top-level segment ("custom") only — the walker can't
 * filter on a multi-segment prefix. This means a manual file read could
 * reach sibling files under the top segment (e.g. "custom/secret.txt")
 * even though only "custom/out/..." should be accessible.
 *
 * Returns true when `requestedPath` falls inside the top segment but
 * outside the configured outputDir prefix — caller must deny in that case.
 */
export function isPathOutsideNestedOutput(
  requestedPath: string,
  outputDir: string,
): boolean {
  const topSegment = outputDir.split("/")[0];
  const isNested = topSegment !== outputDir;
  if (!isNested) return false;
  const requestedTop = requestedPath.split("/")[0];
  if (requestedTop !== topSegment) return false;
  return !requestedPath.startsWith(outputDir + "/");
}

/**
 * Resolve the BMAD output directory and ensure the provider can scan it.
 * For local providers, extends the whitelist to the top-level segment of
 * the configured output dir. Returns the (possibly re-fetched) tree paths
 * and the resolved `outputDir`.
 */
export async function resolveBmadOutputDir(
  provider: ContentProvider,
  initialPaths: string[],
): Promise<{ outputDir: string; paths: string[] }> {
  const { outputDir } = await getBmadConfig(provider, initialPaths);
  if (outputDir === DEFAULT_OUTPUT_DIR || !provider.extendBmadDirs) {
    return { outputDir, paths: initialPaths };
  }
  const topSegment = outputDir.split("/")[0];
  try {
    provider.extendBmadDirs(topSegment);
    const refreshed = await provider.getTree();
    return { outputDir, paths: refreshed.paths };
  } catch (e) {
    console.warn(
      `[BMAD Config] Cannot extend whitelist to "${topSegment}":`,
      e,
    );
    return { outputDir, paths: initialPaths };
  }
}

import type { StoryAgent } from "./types";

export function parseBmadAgents(
  configToml: string,
  teamConfigToml?: string,
  userConfigToml?: string,
  personalConfigToml?: string,
): StoryAgent[] {
  let doc = {};
  for (const text of [
    configToml,
    userConfigToml,
    teamConfigToml,
    personalConfigToml,
  ])
    if (text?.trim()) doc = mergeCustomization(doc, parse(text));
  return Object.entries(
    (doc as { agents?: Record<string, Record<string, unknown>> }).agents ?? {},
  ).map(([slug, a]) => ({
    slug,
    name: typeof a.name === "string" ? a.name : slug,
    title: typeof a.title === "string" ? a.title : "BMAD Agent",
    icon: typeof a.icon === "string" ? a.icon : "🤖",
  }));
}
