import { redirect, notFound } from "next/navigation";
import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { getGitHubToken } from "@/lib/github/client";
import { EpicBrowser } from "@/components/workspace/artifacts";
import {
  getAuthenticatedUserId,
  getAuthenticatedRepoConfig,
} from "@/lib/db/helpers";

interface EpicsPageProps {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function EpicsPage({ params }: EpicsPageProps) {
  const { owner, repo: repoName } = await params;
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login?error=session_expired");

  const repoConfig = await getAuthenticatedRepoConfig(userId, owner, repoName);
  if (!repoConfig) return notFound();

  const isLocal = repoConfig.sourceType === "local";
  const token = isLocal
    ? undefined
    : ((await getGitHubToken(userId)) ?? undefined);
  const project = await getCachedBmadProject(repoConfig, token, userId);
  if (!project) return notFound();

  return <EpicBrowser epics={project.epics} stories={project.stories} />;
}
