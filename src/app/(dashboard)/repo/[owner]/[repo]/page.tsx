import { redirect, notFound } from "next/navigation";
import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { getGitHubToken } from "@/lib/github/client";
import {
  getAuthenticatedUserId,
  getAuthenticatedRepoConfig,
} from "@/lib/db/helpers";
import { ProjectOverview } from "@/components/workspace/projects";
export default async function Page({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");
  const config = await getAuthenticatedRepoConfig(userId, owner, repo);
  if (!config) notFound();
  const token =
    config.sourceType === "local"
      ? undefined
      : ((await getGitHubToken(userId)) ?? undefined);
  const project = await getCachedBmadProject(config, token, userId);
  return <ProjectOverview project={project} repo={config} />;
}
