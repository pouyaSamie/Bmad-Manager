import { redirect, notFound } from "next/navigation";
import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { getGitHubToken } from "@/lib/github/client";
import { StoryBrowser } from "@/components/workspace/artifacts";
import {
  getAuthenticatedUserId,
  getAuthenticatedRepoConfig,
} from "@/lib/db/helpers";

interface StoriesPageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StoriesPage({
  params,
  searchParams,
}: StoriesPageProps) {
  const { owner, repo: repoName } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawView =
    typeof resolvedSearchParams.view === "string"
      ? resolvedSearchParams.view
      : undefined;
  const initialView =
    rawView === "table" || rawView === "backlog"
      ? "table"
      : rawView === "board" || rawView === "kanban"
        ? "kanban"
        : undefined;
  const initialEpic =
    typeof resolvedSearchParams.epic === "string"
      ? resolvedSearchParams.epic
      : undefined;

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

  return (
    <StoryBrowser
      stories={project.stories}
      epics={project.epics}
      initialView={initialView}
      initialEpic={initialEpic}
    />
  );
}
