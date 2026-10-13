import crypto from "node:crypto";
import { parse } from "smol-toml";
import { effectivePersona } from "./bmad-customization";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "./db/client";
import { resolveLocalPath, normalizePathSeparators } from "./path-utils";

export type DiscoveredSkill = {
  name: string;
  description: string | null;
  directory: string;
  source: "installed" | "managed";
  customizeSchema: string | null;
};

export type DiscoveredAgent = {
  slug: string;
  skillName: string | null;
  name: string;
  title: string;
  icon: string;
  description: string | null;
  source: "discovered" | "managed";
};

const MAX_OUTPUT = 32_000;

function key(): Buffer {
  const value = process.env.AGENT_ENCRYPTION_KEY;
  if (!value) throw new Error("AGENT_ENCRYPTION_KEY is not configured");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32)
    throw new Error("AGENT_ENCRYPTION_KEY must be a 32-byte base64url value");
  return decoded;
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string): string {
  const [iv, tag, ciphertext] = value.split(".");
  if (!iv || !tag || !ciphertext)
    throw new Error("Invalid encrypted gateway key");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function redact(value: string): string {
  return value
    .replace(
      /(api[_-]?key|authorization|bearer)\s*[:=]\s*[^\s"']+/gi,
      "$1=[REDACTED]",
    )
    .slice(-MAX_OUTPUT);
}

export function safeChild(root: string, relative: string): string {
  const normRel = normalizePathSeparators(relative);
  if (
    !normRel ||
    path.isAbsolute(normRel) ||
    normRel.includes("\0") ||
    normRel.startsWith("/")
  ) {
    throw new Error("Invalid project-relative path");
  }
  const resolvedRoot = resolveLocalPath(root);
  const resolved = path.resolve(resolvedRoot, normRel);
  if (
    !resolved.startsWith(resolvedRoot + path.sep) &&
    resolved !== resolvedRoot
  ) {
    throw new Error("Path escapes the project root");
  }
  if (fsSync.existsSync(resolvedRoot)) {
    const actualRoot = fsSync.realpathSync(resolvedRoot);
    let ancestor = resolved;
    while (!fsSync.existsSync(ancestor) && ancestor !== path.dirname(ancestor))
      ancestor = path.dirname(ancestor);
    const actual = fsSync.realpathSync(ancestor);
    const relativeReal = path.relative(actualRoot, actual);
    if (
      relativeReal.startsWith(".." + path.sep) ||
      relativeReal === ".." ||
      path.isAbsolute(relativeReal)
    )
      throw new Error("Path escapes the project root through a link");
  }
  return resolved;
}

export async function assertProjectRoot(root: string): Promise<string> {
  const resolved = resolveLocalPath(root);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) throw new Error("Project folder is not available");
  return resolved;
}

function frontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const read = (name: string) =>
    match[1]
      .match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, "");
  return { name: read("name"), description: read("description") };
}

function agentBlocks(content: string): Map<string, Record<string, unknown>> {
  if (!content.trim()) return new Map();
  const doc = parse(content);
  const agents = doc.agents as
    Record<string, Record<string, unknown>> | undefined;
  return new Map(Object.entries(agents ?? {}));
}
function tomlString(
  block: Record<string, unknown> | undefined,
  field: string,
): string | null {
  const value = block?.[field];
  return typeof value === "string" ? value : null;
}
export async function discoverBmad(root: string) {
  const projectRoot = await assertProjectRoot(root);
  const configPath = safeChild(projectRoot, "_bmad/config.toml");
  const config = await fs.readFile(configPath, "utf8").catch(() => "");
  const teamConfig = await fs
    .readFile(safeChild(projectRoot, "_bmad/custom/config.toml"), "utf8")
    .catch(() => "");
  const personalConfig = await fs
    .readFile(safeChild(projectRoot, "_bmad/custom/config.user.toml"), "utf8")
    .catch(() => "");
  const installedVersion =
    config.match(/^\s*version\s*=\s*["']?([^"'\n]+)/m)?.[1]?.trim() ?? null;
  const base = agentBlocks(config);
  const team = agentBlocks(teamConfig);
  const personal = agentBlocks(personalConfig);
  const slugs = new Set([...base.keys(), ...team.keys(), ...personal.keys()]);
  const agents: DiscoveredAgent[] = [...slugs].map((slug) => {
    const blocks = [base.get(slug), team.get(slug), personal.get(slug)];
    const read = (field: string, fallback: string) =>
      blocks.reduce<string>(
        (value, block) => tomlString(block, field) ?? value,
        fallback,
      );
    const optional = (field: string) =>
      blocks.reduce<string | null>(
        (value, block) => tomlString(block, field) ?? value,
        null,
      );
    return {
      slug,
      skillName: read(
        "skill",
        ["analyst", "pm", "architect", "dev", "ux-designer"].includes(slug)
          ? "bmad-agent-" + slug
          : slug,
      ),
      name: read("name", slug),
      title: read("title", "BMad agent"),
      icon: read("icon", "🤖"),
      description: optional("description"),
      persona: optional("persona"),
      source: read("team", "") === "custom" ? "managed" : "discovered",
    };
  });
  const skills: DiscoveredSkill[] = [];
  for (const skillRoot of [
    ".agents/skills",
    ".agent/skills",
    ".claude/skills",
    ".cline/skills",
    ".bob/skills",
    ".adal/skills",
  ]) {
    const skillsRoot = safeChild(projectRoot, skillRoot);
    const directories = await fs
      .readdir(skillsRoot, { withFileTypes: true })
      .catch(() => []);
    for (const dirent of directories) {
      if (!dirent.isDirectory()) continue;
      const directory = safeChild(projectRoot, `${skillRoot}/${dirent.name}`);
      const skill = await fs
        .readFile(path.join(directory, "SKILL.md"), "utf8")
        .catch(() => "");
      if (!skill) continue;
      const meta = frontmatter(skill);
      const customizeSchema = await fs
        .readFile(path.join(directory, "customize.toml"), "utf8")
        .catch(() => null);
      if (skills.some((s) => s.name === (meta.name ?? dirent.name))) continue;
      skills.push({
        name: meta.name ?? dirent.name,
        description: meta.description ?? null,
        directory: `${skillRoot}/${dirent.name}`,
        source: /Managed by (?:Bmad-Manager|BMAD Manager|MyBMAD)/i.test(skill)
          ? "managed"
          : "installed",
        customizeSchema,
      });
    }
  }
  // Also discover agent skills from .agents/skills if not already in config.toml
  for (const skill of skills) {
    if (
      (skill.name.startsWith("bmad-agent-") || skill.name === "bmad-tea") &&
      !agents.some((a) => a.skillName === skill.name)
    ) {
      const isNella =
        skill.name.includes("po") || skill.name.includes("critic");
      const isMurat = skill.name.includes("tea");
      const descriptor = skill.customizeSchema
        ? (parse(skill.customizeSchema).agent as
            Record<string, unknown> | undefined)
        : undefined;
      agents.push({
        slug: skill.name,
        skillName: skill.name,
        name:
          typeof descriptor?.name === "string"
            ? descriptor.name
            : isNella
              ? "Nella"
              : isMurat
                ? "Murat"
                : skill.name.replace("bmad-agent-", ""),
        title:
          typeof descriptor?.title === "string"
            ? descriptor.title
            : isNella
              ? "Product Owner & Principal Design Critic"
              : isMurat
                ? "Quality Advisor"
                : skill.description?.slice(0, 60) || "BMad Agent",
        icon: isNella ? "👑" : isMurat ? "🧪" : "🤖",
        description: skill.description,
        source: skill.source === "managed" ? "managed" : "discovered",
      });
    }
  }

  for (const agent of agents) {
    const override = await fs
      .readFile(
        safeChild(projectRoot, `_bmad/custom/${agent.skillName}.toml`),
        "utf8",
      )
      .catch(() => "");
    const personal = await fs
      .readFile(
        safeChild(projectRoot, `_bmad/custom/${agent.skillName}.user.toml`),
        "utf8",
      )
      .catch(() => "");
    const skill = skills.find((s) => s.name === agent.skillName);
    const withPersona = agent as DiscoveredAgent & { persona?: string | null };
    withPersona.persona = effectivePersona(
      skill?.customizeSchema ?? null,
      withPersona.persona ?? null,
      override,
      personal,
    );
  }

  return { projectRoot, installedVersion, agents, skills, config };
}
export function validCustomPath(relative: string): boolean {
  return /^_bmad\/custom\/[a-z0-9_-]+(?:\.user)?\.toml$/i.test(relative);
}

export function validSkillSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value);
}

export type BmadInstallOptions = {
  tools?: string[];
  modules?: string[];
  userName?: string;
  communicationLanguage?: string;
  documentOutputLanguage?: string;
  outputFolder?: string;
  channel?: "stable" | "next";
  shims?: boolean;
};

export async function runBmadInstaller(
  root: string,
  optionsOrTools?: string[] | BmadInstallOptions,
) {
  const projectRoot = await assertProjectRoot(root);
  const options: BmadInstallOptions = Array.isArray(optionsOrTools)
    ? { tools: optionsOrTools }
    : (optionsOrTools ?? {});

  const safeTools =
    options.tools && options.tools.length > 0
      ? options.tools.filter((tool) => /^[a-z0-9-]+$/i.test(tool))
      : ["codex"];

  const safeModules =
    options.modules && options.modules.length > 0
      ? options.modules.filter((mod) => /^[a-z0-9-]+$/i.test(mod))
      : ["bmm"];

  const args = [
    "bmad-method",
    "install",
    "--yes",
    "--directory",
    projectRoot,
    "--modules",
    safeModules.join(","),
    "--tools",
    safeTools.join(","),
  ];

  if (options.userName?.trim()) {
    args.push("--user-name", options.userName.trim());
  }

  if (options.communicationLanguage?.trim()) {
    args.push("--communication-language", options.communicationLanguage.trim());
  }

  if (options.documentOutputLanguage?.trim()) {
    args.push(
      "--document-output-language",
      options.documentOutputLanguage.trim(),
    );
  }

  if (options.outputFolder?.trim()) {
    safeChild(projectRoot, options.outputFolder.trim());
    args.push("--output-folder", options.outputFolder.trim());
  }

  if (options.channel === "next") {
    args.push("--channel", "next");
  } else {
    args.push("--channel", "stable");
  }

  if (options.shims) {
    args.push("--shims");
  } else {
    args.push("--no-shims");
  }

  return new Promise<string>((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const npxCli = path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npx-cli.js",
    );
    const child = spawn(
      isWindows ? process.execPath : "npx",
      isWindows ? [npxCli, ...args] : args,
      { cwd: projectRoot, shell: false, windowsHide: true },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(redact(output))
        : reject(
            new Error(redact(output) || `BMad installer exited with ${code}`),
          ),
    );
  });
}

export async function syncProjectBmadRuntime(
  repoId: string,
  projectRoot: string,
) {
  const runtime = await prisma.bmadProjectRuntime.upsert({
    where: { repoId },
    create: { repoId },
    update: {},
  });
  const found = await discoverBmad(projectRoot);
  await prisma.$transaction([
    prisma.bmadProjectRuntime.update({
      where: { id: runtime.id },
      data: {
        installedVersion: found.installedVersion,
        installStatus: found.skills.length ? "ready" : "not_installed",
        tools: [
          ...new Set(found.skills.map((s) => s.directory.split("/skills/")[0])),
        ],
        modules: found.config.trim()
          ? Object.keys((parse(found.config).modules ?? {}) as object)
          : [],
        lastScannedAt: new Date(),
      },
    }),
    prisma.bmadSkill.updateMany({
      where: { runtimeId: runtime.id },
      data: { source: "missing" },
    }),
    prisma.bmadAgent.updateMany({
      where: { runtimeId: runtime.id },
      data: { available: false },
    }),
    ...found.skills.map((skill) =>
      prisma.bmadSkill.upsert({
        where: { runtimeId_name: { runtimeId: runtime.id, name: skill.name } },
        create: {
          runtimeId: runtime.id,
          ...skill,
          isManaged: skill.source === "managed",
        },
        update: { ...skill, isManaged: skill.source === "managed" },
      }),
    ),
    ...found.agents.map((agent) =>
      prisma.bmadAgent.upsert({
        where: { runtimeId_slug: { runtimeId: runtime.id, slug: agent.slug } },
        create: {
          runtimeId: runtime.id,
          ...agent,
          available: found.skills.some((s) => s.name === agent.skillName),
        },
        update: {
          ...agent,
          available: found.skills.some((s) => s.name === agent.skillName),
        },
      }),
    ),
  ]);
  return { runtimeId: runtime.id, found };
}
