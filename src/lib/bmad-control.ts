import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
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
  if (decoded.length !== 32) throw new Error("AGENT_ENCRYPTION_KEY must be a 32-byte base64url value");
  return decoded;
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(value: string): string {
  const [iv, tag, ciphertext] = value.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted gateway key");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function redact(value: string): string {
  return value
    .replace(/(api[_-]?key|authorization|bearer)\s*[:=]\s*[^\s"']+/gi, "$1=[REDACTED]")
    .slice(-MAX_OUTPUT);
}

export function safeChild(root: string, relative: string): string {
  const normRel = normalizePathSeparators(relative);
  if (!normRel || path.isAbsolute(normRel) || normRel.includes("\0") || normRel.startsWith("/")) {
    throw new Error("Invalid project-relative path");
  }
  const resolvedRoot = resolveLocalPath(root);
  const resolved = path.resolve(resolvedRoot, normRel);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new Error("Path escapes the project root");
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
  const read = (name: string) => match[1].match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  return { name: read("name"), description: read("description") };
}

function agentBlocks(content: string): Map<string, string> {
  const sections = content.split(/\r?\n(?=\[agents\.)/).filter((section) => section.startsWith("[agents."));
  return new Map(sections.flatMap((block) => {
    const slug = block.match(/^\[agents\.([^\]]+)\]/)?.[1];
    return slug ? [[slug, block] as const] : [];
  }));
}

function tomlString(block: string | undefined, field: string): string | null {
  return block?.match(new RegExp(`^${field}\\s*=\\s*"([^\"]*)"`, "m"))?.[1] ?? null;
}

export async function discoverBmad(root: string) {
  const projectRoot = await assertProjectRoot(root);
  const configPath = safeChild(projectRoot, "_bmad/config.toml");
  const config = await fs.readFile(configPath, "utf8").catch(() => "");
  const teamConfig = await fs.readFile(safeChild(projectRoot, "_bmad/custom/config.toml"), "utf8").catch(() => "");
  const personalConfig = await fs.readFile(safeChild(projectRoot, "_bmad/custom/config.user.toml"), "utf8").catch(() => "");
  const installedVersion = config.match(/^\s*version\s*=\s*["']?([^"'\n]+)/m)?.[1]?.trim() ?? null;
  const base = agentBlocks(config);
  const team = agentBlocks(teamConfig);
  const personal = agentBlocks(personalConfig);
  const slugs = new Set([...base.keys(), ...team.keys(), ...personal.keys()]);
  const agents: DiscoveredAgent[] = [...slugs].map((slug) => {
    const blocks = [base.get(slug), team.get(slug), personal.get(slug)];
    const read = (field: string, fallback: string) => blocks.reduce<string>((value, block) => tomlString(block, field) ?? value, fallback);
    const optional = (field: string) => blocks.reduce<string | null>((value, block) => tomlString(block, field) ?? value, null);
    return {
      slug,
      skillName: read("skill", slug),
      name: read("name", slug),
      title: read("title", "BMad agent"),
      icon: read("icon", "🤖"),
      description: optional("description"),
      persona: optional("persona"),
      source: read("team", "") === "custom" ? "managed" : "discovered",
    };
  });
  const skillsRoot = safeChild(projectRoot, ".agents/skills");
  const directories = await fs.readdir(skillsRoot, { withFileTypes: true }).catch(() => []);
  const skills: DiscoveredSkill[] = [];
  for (const dirent of directories) {
    if (!dirent.isDirectory()) continue;
    const directory = safeChild(projectRoot, `.agents/skills/${dirent.name}`);
    const skill = await fs.readFile(path.join(directory, "SKILL.md"), "utf8").catch(() => "");
    if (!skill) continue;
    const meta = frontmatter(skill);
    const customizeSchema = await fs.readFile(path.join(directory, "customize.toml"), "utf8").catch(() => null);
    skills.push({ name: meta.name ?? dirent.name, description: meta.description ?? null, directory: `.agents/skills/${dirent.name}`, source: /Managed by (?:Bmad-Manager|BMAD Manager|MyBMAD)/i.test(skill) ? "managed" : "installed", customizeSchema });
  }
  return { projectRoot, installedVersion, agents, skills, config };
}
export function validCustomPath(relative: string): boolean {
  return /^_bmad\/custom\/[a-z0-9_-]+(?:\.user)?\.toml$/i.test(relative);
}

export function validSkillSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value);
}

export async function runBmadInstaller(root: string, tools: string[]) {
  const projectRoot = await assertProjectRoot(root);
  const safeTools = tools.filter((tool) => /^[a-z0-9-]+$/i.test(tool));
  if (!safeTools.length) throw new Error("At least one supported tool is required");
  return new Promise<string>((resolve, reject) => {
    const child = spawn("npx", ["bmad-method", "install", "--yes", "--modules", "bmm", "--tools", safeTools.join(",")], { cwd: projectRoot, shell: process.platform === "win32" });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(redact(output)) : reject(new Error(redact(output) || `BMad installer exited with ${code}`)));
  });
}