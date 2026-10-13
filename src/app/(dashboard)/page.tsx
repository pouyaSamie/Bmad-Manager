import { Projects } from "@/components/workspace/projects";
import { sanitizeError } from "@/lib/errors";
import { redirect } from "next/navigation";
import { getBmadProject } from "@/lib/bmad/parser";
import { createUserOctokit, getGitHubToken } from "@/lib/github/client";
import { createContentProvider } from "@/lib/content-provider";
import {
  getAuthenticatedUserId,
  getAuthenticatedRepos,
} from "@/lib/db/helpers";
import type { BmadProject } from "@/lib/bmad/types";

const localFsEnabled = process.env.ENABLE_LOCAL_FS === "true";

export default async function DashboardPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login?error=session_expired");

  const repos = await getAuthenticatedRepos(userId);

  // Only fetch GitHub token if at least one repo is GitHub-sourced (F34)
  const hasGithubRepos = repos.some((r) => r.sourceType === "github");
  const token = hasGithubRepos ? await getGitHubToken(userId) : null;
  const octokit = token ? createUserOctokit(token) : undefined;

  const projects: BmadProject[] = [];
  const errors: string[] = [];
  const results = await Promise.allSettled(
    repos.map((repo) => {
      const provider = createContentProvider(repo, octokit, userId);
      return getBmadProject(repo, provider);
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value !== null) {
      projects.push(result.value);
    } else if (result.status === "rejected") {
      const repo = repos[i];
      const msg = result.reason?.message || String(result.reason);
      console.error(`Failed to fetch ${repo.owner}/${repo.name}:`, msg);
      errors.push(
        `${repo.displayName}: ${sanitizeError(result.reason, "FS_ERROR")}`,
      );
    }
  }

  return (
    <Projects
      projects={projects}
      repos={repos}
      errors={errors}
      localFsEnabled={localFsEnabled}
      githubEnabled={!!token}
    />
  );
}
