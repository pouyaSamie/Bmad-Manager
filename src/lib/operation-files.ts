import fs from "node:fs/promises";
import crypto from "node:crypto";
import { parse } from "./toml";
import { stringify, type TomlValue } from "smol-toml";
import { safeChild, validSkillSlug } from "./bmad-control";
import { behaviorSchema } from "./agent-behavior";
import { skillLocations } from "./bmad-installation";
import { validateGraph } from "./workflow-graph";
export type FileChange = {
  path: string;
  before: string | null;
  after: string | null;
  beforeHash: string | null;
  afterHash: string | null;
  directory?: boolean;
  afterKnown?: boolean;
};
export const fileHash = (text: string | null) =>
  text === null ? null : crypto.createHash("sha256").update(text).digest("hex");
export async function currentText(root: string, relative: string) {
  return fs.readFile(safeChild(root, relative), "utf8").catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
}
export function workflowText(input: unknown) {
  const graph = validateGraph(input);
  return (
    "# Bmad Manager design configuration. Does not execute BMad workflows.\n" +
    stringify({
      manager: { version: 2 },
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        agent: n.agentSlug,
        x: n.position.x,
        y: n.position.y,
      })),
      edges: graph.edges,
    })
  );
}
export async function planAgentFiles(
  root: string,
  payload: Record<string, unknown>,
): Promise<FileChange[]> {
  const slug = String(payload.slug ?? ""),
    skill = String(payload.skillName ?? "");
  if (!validSkillSlug(slug) || !validSkillSlug(skill))
    throw new Error("Invalid customization");
  const suffix = payload.scope === "personal" ? ".user" : "";
  const descriptorPath = "_bmad/custom/config" + suffix + ".toml",
    behaviorPath = "_bmad/custom/" + skill + suffix + ".toml";
  const descriptorBefore = await currentText(root, descriptorPath),
    behaviorBefore = await currentText(root, behaviorPath);
  const doc = descriptorBefore?.trim() ? parse(descriptorBefore) : {},
    override = behaviorBefore?.trim() ? parse(behaviorBefore) : {};
  const roster = (doc.agents ?? {}) as Record<string, TomlValue>;
  const descriptorPatch =
    (payload.descriptor as Record<string, TomlValue> | undefined) ??
    Object.fromEntries(
      ["name", "title", "icon", "description", "skill"].flatMap((k) =>
        typeof payload[k === "skill" ? "skillName" : k] === "string"
          ? [[k, String(payload[k === "skill" ? "skillName" : k])]]
          : [],
      ),
    );
  if (
    Object.keys(descriptorPatch).some(
      (k) =>
        !["name", "title", "icon", "description", "skill", "team"].includes(k),
    )
  )
    throw new Error("Invalid descriptor");
  const descriptor = {
    ...((roster[slug] as object) ?? {}),
    ...descriptorPatch,
  } as Record<string, TomlValue>;
  for (const k of (payload.descriptorReset as string[]) ?? [])
    delete descriptor[k];
  if (Object.keys(descriptor).length) roster[slug] = descriptor;
  else delete roster[slug];
  if (Object.keys(roster).length) doc.agents = roster;
  else delete doc.agents;
  const patch = behaviorSchema.parse(
    payload.behaviorPatch ??
      (typeof payload.persona === "string"
        ? { identity: payload.persona }
        : {}),
  );
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    const values = patch[key];
    if (Array.isArray(values) && values.every((v) => typeof v === "string"))
      (patch as Record<string, unknown>)[key] = values.filter(
        (v) => (v as string).trim().length > 0,
      );
  }
  const reset = (payload.behaviorReset as string[]) ?? [];
  if (reset.some((k) => !Object.keys(behaviorSchema.shape).includes(k)))
    throw new Error("Invalid reset field");
  let native: Record<string, unknown> | undefined;
  for (const location of skillLocations) {
    const schema = await currentText(
      root,
      location + "/" + skill + "/customize.toml",
    );
    if (schema) {
      native = parse(schema).agent as Record<string, unknown>;
      break;
    }
  }
  if (
    Object.keys(patch).some((k) => (native ? !(k in native) : k !== "identity"))
  )
    throw new Error("This field is not supported by the installed skill");
  const agent = { ...((override.agent as object) ?? {}), ...patch } as Record<
    string,
    TomlValue
  >;
  for (const k of reset) delete agent[k];
  if (Object.keys(agent).length) override.agent = agent;
  else delete override.agent;
  const changes: FileChange[] = [];
  for (const [p, before, content] of [
    [
      descriptorPath,
      descriptorBefore,
      Object.keys(doc).length ? stringify(doc) : null,
    ],
    [
      behaviorPath,
      behaviorBefore,
      Object.keys(override).length ? stringify(override) : null,
    ],
  ] as const) {
    if (before !== content)
      changes.push({
        path: p,
        before,
        after: content,
        beforeHash: fileHash(before),
        afterHash: fileHash(content),
      });
  }
  if (payload.scope === "personal" && changes.length) {
    const before = await currentText(root, ".gitignore");
    if (!before?.split(/\r?\n/).includes("*.user.toml")) {
      const after = (before ?? "").trimEnd() + "\n*.user.toml\n";
      changes.push({
        path: ".gitignore",
        before,
        after,
        beforeHash: fileHash(before),
        afterHash: fileHash(after),
      });
    }
  }
  return changes;
}
export async function directoryFingerprint(
  root: string,
  relative: string,
): Promise<{ hash: string | null; count: number }> {
  const target = safeChild(root, relative);
  if (
    !(await fs
      .stat(target)
      .then(() => true)
      .catch(() => false))
  )
    return { hash: null, count: 0 };
  const hash = crypto.createHash("sha256");
  let count = 0;
  async function walk(dir: string) {
    for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const file = dir + "/" + entry.name;
      if (entry.isSymbolicLink())
        throw new Error("Managed directories cannot include symlinks");
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        if (++count > 20000) throw new Error("Too many files for safe review");
        hash.update(file.slice(target.length));
        hash.update(await fs.readFile(file));
      }
    }
  }
  await walk(target);
  return { hash: hash.digest("hex"), count };
}
export function managedSkillText(payload: Record<string, unknown>) {
  const slug = String(payload.slug),
    name = String(payload.name ?? slug),
    description = String(payload.description ?? "Custom project agent"),
    persona = String(payload.persona ?? description);
  return (
    (typeof payload.content === "string"
      ? payload.content
      : "---\nname: " +
        slug +
        "\ndescription: " +
        JSON.stringify(description) +
        "\n---\n\n# " +
        name +
        "\n\n## Persona\n" +
        persona) + "\n\n<!-- Managed by Bmad-Manager. -->\n"
  );
}

export async function operationFilePreview(
  root: string,
  kind: string,
  payload: Record<string, unknown>,
): Promise<FileChange[]> {
  if (kind === "customize_agent") return planAgentFiles(root, payload);
  const directoryChanges: FileChange[] = [];
  const dirs =
    kind === "uninstall"
      ? ["_bmad", "_bmad-output", ".agents/skills"]
      : kind === "clone_skill"
        ? [String(payload.sourceDirectory)]
        : kind === "update"
          ? ["_bmad", ".agents/skills"]
          : [];
  for (const p of dirs) {
    const state = await directoryFingerprint(root, p);
    directoryChanges.push({
      path: p,
      directory: true,
      before: state.count + " files",
      after:
        kind === "uninstall"
          ? "Folder removed; source code and Git preserved"
          : "Contents are checked again before application",
      beforeHash: state.hash,
      afterHash: null,
    });
  }
  const files: Record<string, string | null> = {};
  if (kind === "set_workflow")
    files["_bmad/custom/workflow.toml"] = workflowText(payload.graph);
  if (kind === "write_override")
    files[String(payload.path)] = String(payload.content);
  if (["create_agent", "write_skill", "clone_skill"].includes(kind))
    files[".agents/skills/" + String(payload.slug) + "/SKILL.md"] =
      managedSkillText(payload);
  if (kind === "create_agent")
    directoryChanges.push(...(await planAgentFiles(root, payload)));
  if (["install", "update"].includes(kind))
    for (const p of [
      "_bmad/config.toml",
      "_bmad/config.user.toml",
      "_bmad/core/config.yaml",
      "_bmad/_config/manifest.yaml",
    ])
      files[p] = await currentText(root, p);
  return [
    ...directoryChanges,
    ...(await Promise.all(
      Object.entries(files).map(async ([p, after]) => {
        const before = await currentText(root, p);
        return {
          path: p,
          before,
          after,
          beforeHash: fileHash(before),
          afterHash: fileHash(after),
        };
      }),
    )),
  ];
}
export async function assertFileSnapshot(root: string, changes: FileChange[]) {
  for (const c of changes)
    if (
      (c.directory
        ? (await directoryFingerprint(root, c.path)).hash
        : fileHash(await currentText(root, c.path))) !== c.beforeHash
    )
      throw new Error(
        "Files changed since this draft. Create and review a fresh draft.",
      );
}
