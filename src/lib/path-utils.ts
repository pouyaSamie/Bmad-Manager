import fs from "node:fs";
import path from "node:path";

/**
 * Normalizes backslashes to forward slashes.
 */
export function normalizePathSeparators(p: string): string {
  return p ? p.replace(/\\/g, "/") : "";
}

/**
 * Extracts the trailing basename from either a POSIX or Windows path.
 * Unlike Node's path.basename() which is platform-dependent, this works
 * consistently on both Linux and Windows.
 */
export function getCrossPlatformBasename(p: string): string {
  if (!p) return "";
  const normalized = normalizePathSeparators(p).replace(/\/+$/, "");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || "";
}

/**
 * Resolves a local project path across Windows and Linux environments,
 * automatically mapping between host paths (e.g. C:\workspace\project)
 * and Docker container mount paths (e.g. /workspace/project).
 */
export function resolveLocalPath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== "string") return inputPath;

  const trimmed = inputPath.trim();
  const normalized = normalizePathSeparators(trimmed);

  // 1. Direct check: If the path directly exists on the system, return resolved path
  try {
    if (fs.existsSync(trimmed)) {
      return path.resolve(trimmed);
    }
  } catch {}

  const workspaceRoot = process.env.LOCAL_WORKSPACE_PATH || "/workspace";
  const hostWorkspace = normalizePathSeparators(process.env.LOCAL_HOST_WORKSPACE || "C:/workspace");

  // 2. Windows drive to container workspace mapping (e.g. C:\workspace\foo or C:/workspace/foo -> /workspace/foo)
  const genericWinMatch = normalized.match(/^[a-zA-Z]:\/workspace(?:\/(.*))?$/i);
  if (genericWinMatch) {
    const subPath = genericWinMatch[1] || "";
    const candidate = subPath ? path.posix.join(workspaceRoot, subPath) : workspaceRoot;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
    return candidate;
  }

  // Check if starts with configured hostWorkspace prefix
  if (hostWorkspace && normalized.toLowerCase().startsWith(hostWorkspace.toLowerCase())) {
    const subPath = normalized.slice(hostWorkspace.length).replace(/^\/+/, "");
    const candidate = subPath ? path.posix.join(workspaceRoot, subPath) : workspaceRoot;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
    return candidate;
  }

  // 3. Container workspace to Windows host mapping (if running on Windows host, /workspace/foo -> C:/workspace/foo)
  if (normalized.toLowerCase().startsWith(workspaceRoot.toLowerCase()) && process.platform === "win32") {
    const subPath = normalized.slice(workspaceRoot.length).replace(/^\/+/, "");
    const candidate = subPath ? path.join(hostWorkspace, subPath) : hostWorkspace;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  // 4. If path starts with "workspace/..." (relative without leading slash)
  if (normalized.startsWith("workspace/")) {
    const candidate = path.posix.join("/", normalized);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
    return candidate;
  }

  // 5. Bare project name (e.g. "chess-report") -> check inside workspaceRoot
  if (!normalized.includes("/") && !normalized.includes("\\")) {
    const candidate = path.posix.join(workspaceRoot, normalized);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  // Fallback: standard path.resolve
  return path.resolve(trimmed);
}

/**
 * Returns a user-friendly display path for a resolved local project path.
 * When running in Docker, converts /workspace/project back to C:\workspace\project for Windows users.
 */
export function getDisplayLocalPath(resolvedPath: string): string {
  if (!resolvedPath) return "";
  const normalized = normalizePathSeparators(resolvedPath);
  const workspaceRoot = process.env.LOCAL_WORKSPACE_PATH || "/workspace";
  const hostWorkspace = process.env.LOCAL_HOST_WORKSPACE || "C:/workspace";

  if (normalized.startsWith(workspaceRoot)) {
    const subPath = normalized.slice(workspaceRoot.length).replace(/^\/+/, "");
    const winHost = hostWorkspace.replace(/\//g, "\\");
    return subPath ? `${winHost}\\${subPath.replace(/\//g, "\\")}` : winHost;
  }

  return resolvedPath;
}

export type AvailableLocalProject = {
  name: string;
  path: string;
  displayPath: string;
  hasBmad: boolean;
};

/**
 * Scans the mounted workspace directory for project folders and detects if they contain BMAD artifacts.
 */
export async function scanWorkspaceProjects(): Promise<AvailableLocalProject[]> {
  const workspaceRoot = process.env.LOCAL_WORKSPACE_PATH || "/workspace";
  const projects: AvailableLocalProject[] = [];

  try {
    const entries = await fs.promises.readdir(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const projectPath = path.posix.join(workspaceRoot, entry.name);
      let hasBmad = false;

      try {
        const subEntries = await fs.promises.readdir(projectPath, { withFileTypes: true });
        hasBmad = subEntries.some(
          (sub) => sub.isDirectory() && (sub.name === "_bmad" || sub.name === "_bmad-output")
        );
      } catch {
        continue;
      }

      projects.push({
        name: entry.name,
        path: projectPath,
        displayPath: getDisplayLocalPath(projectPath),
        hasBmad,
      });
    }
  } catch (err) {
    // If workspaceRoot is not accessible, quietly return empty list
  }

  // Sort: projects with BMAD first, then alphabetically
  return projects.sort((a, b) => {
    if (a.hasBmad && !b.hasBmad) return -1;
    if (!a.hasBmad && b.hasBmad) return 1;
    return a.name.localeCompare(b.name);
  });
}
