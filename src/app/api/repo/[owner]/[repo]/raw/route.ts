import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { resolveLocalPath, normalizePathSeparators } from "@/lib/path-utils";
import { createUserOctokit, getGitHubToken } from "@/lib/github/client";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  json: "application/json",
};

interface RouteProps {
  params: Promise<{ owner: string; repo: string }>;
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { owner, repo: repoName } = await params;
  const repo = await prisma.repo.findFirst({
    where: { userId: session.userId, owner, name: repoName },
    select: { id: true, sourceType: true, localPath: true, branch: true },
  });

  if (!repo) {
    return new NextResponse("Project not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const relativePath = searchParams.get("path");

  if (!relativePath || relativePath.includes("\0")) {
    return new NextResponse("Invalid file path", { status: 400 });
  }

  const cleanPath = normalizePathSeparators(relativePath).replace(/^\/+/, "");
  const ext = cleanPath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  try {
    if (repo.sourceType === "local") {
      if (!repo.localPath) {
        return new NextResponse("Local path not configured", { status: 500 });
      }

      const root = resolveLocalPath(repo.localPath);
      const fullPath = path.resolve(root, cleanPath);

      // Jail check
      if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
        return new NextResponse("Path traversal forbidden", { status: 403 });
      }

      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) {
        return new NextResponse("Not a file", { status: 404 });
      }

      const buffer = await fs.readFile(fullPath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Length": stat.size.toString(),
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    // GitHub repository
    const token = await getGitHubToken(session.userId);
    if (!token) {
      return new NextResponse("GitHub token missing", { status: 401 });
    }

    const octokit = createUserOctokit(token);
    const response = await octokit.rest.repos.getContent({
      owner,
      repo: repoName,
      path: cleanPath,
      ref: repo.branch,
      mediaType: {
        format: "raw",
      },
    });

    const data = response.data;
    const buffer = Buffer.isBuffer(data)
      ? data
      : typeof data === "string"
        ? Buffer.from(data)
        : Buffer.from(JSON.stringify(data));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "ENOENT"
    ) {
      return new NextResponse("File not found", { status: 404 });
    }
    return new NextResponse("Failed to read file", { status: 500 });
  }
}
