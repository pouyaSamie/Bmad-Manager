import { parse } from "./toml";
import yaml from "js-yaml";
export const skillLocations = [
  ".agents/skills",
  ".agent/skills",
  ".claude/skills",
  ".cursor/skills",
  ".cline/skills",
  ".bob/skills",
  ".adal/skills",
] as const;
export type InstallationProfile = {
  generation: "v6" | "v7" | "unknown" | "missing";
  version: string | null;
  method: "legacy-cli" | "skills-or-plugin" | "unknown";
  tools: string[];
  modules: string[];
  settings: Record<string, string>;
  canUpdate: boolean;
  moduleVersions: Record<string, string>;
  reason: string;
};
export function detectInstallation(
  files: Record<string, string>,
  directories: string[],
): InstallationProfile {
  let config: Record<string, unknown> = {};
  for (const p of [
    "_bmad/config.toml",
    "_bmad/config.user.toml",
    "_bmad/custom/config.toml",
    "_bmad/custom/config.user.toml",
  ])
    if (files[p]) {
      const d = parse(files[p]);
      config = {
        ...config,
        ...d,
        core: {
          ...((config.core as object) ?? {}),
          ...((d.core as object) ?? {}),
        },
      };
    }
  const manifest = files["_bmad/_config/manifest.yaml"]
    ? (yaml.load(files["_bmad/_config/manifest.yaml"]) as Record<
        string,
        unknown
      >)
    : {};
  const core = (config.core as Record<string, unknown>) ?? {};
  const version =
    String(
      config.version ??
        core.version ??
        (manifest?.installation as Record<string, unknown>)?.version ??
        manifest?.version ??
        "",
    ) || null;
  const modules = Object.keys((config.modules as object) ?? {});
  const tools = directories
    .filter((p) => p.includes("/skills"))
    .map((p) => p.split("/skills")[0]);
  const records = Object.entries(files)
    .filter(([p]) => p.endsWith("/bmod.toml"))
    .map(
      ([, text]) =>
        parse(text.replace(/^\uFEFF/, "")).bmod as {
          code?: string;
          version?: string;
        },
    );
  const moduleVersions = Object.fromEntries(
    records
      .filter((r) => r?.code && r?.version)
      .map((r) => [r.code!, r.version!]),
  );
  const generation = records.length
    ? "v7"
    : version?.startsWith("7.")
      ? "v7"
      : version?.startsWith("6.")
        ? "v6"
        : files["_bmad/config.toml"]
          ? "unknown"
          : files["_bmad/core/config.yaml"]
            ? "v6"
            : directories.length
              ? "unknown"
              : "missing";
  const legacy = files["_bmad/core/config.yaml"]
    ? (yaml.load(files["_bmad/core/config.yaml"]) as Record<string, unknown>)
    : {};
  const settings = Object.fromEntries(
    Object.entries({ ...legacy, ...core }).filter(
      ([, v]) => typeof v === "string",
    ),
  ) as Record<string, string>;
  const legacyTools = Array.isArray(manifest?.ides)
    ? manifest.ides.map(String)
    : [];
  const legacyModules = Array.isArray(manifest?.modules)
    ? manifest.modules.map((m) =>
        typeof m === "string"
          ? m
          : String((m as Record<string, unknown>).name ?? ""),
      )
    : [];
  return {
    generation,
    version,
    moduleVersions,
    method:
      generation === "v6"
        ? "legacy-cli"
        : generation === "v7"
          ? "skills-or-plugin"
          : "unknown",
    tools: legacyTools.length ? legacyTools : tools,
    modules: (records.length
      ? records.map((r) => r.code ?? "")
      : modules.length
        ? modules
        : legacyModules
    ).filter((m) => m !== "core"),
    settings,
    canUpdate:
      generation === "v6" &&
      !!version &&
      !(/^6\.12\.(\d+)/.test(version) && Number(version.split(".")[2]) > 0) &&
      legacyTools.length > 0 &&
      legacyModules.length > 0,
    reason:
      generation === "v7"
        ? "Use the installed bmad setup skill or plugin update flow. Manager does not execute setup agents."
        : generation === "v6"
          ? "Stable legacy installation; preserve detected installation answers."
          : "Inspect the installation before updating. No automatic generation change is allowed.",
  };
}
