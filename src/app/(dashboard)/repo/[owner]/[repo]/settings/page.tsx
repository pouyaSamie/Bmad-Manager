import { notFound } from "next/navigation";
import {
  getAuthenticatedUserId,
  getAuthenticatedRepoConfig,
} from "@/lib/db/helpers";
import { Studio } from "@/components/workspace/studio";
import { ProjectLifecycle } from "@/components/workspace/project-lifecycle";
export default async function Page({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const id = await getAuthenticatedUserId();
  if (!id) notFound();
  const config = await getAuthenticatedRepoConfig(id, owner, repo);
  if (!config) notFound();
  return (
    <div className="space-y-8">
      {config.sourceType === "local" && (
        <Studio owner={owner} name={repo} section="settings" />
      )}
      <ProjectLifecycle repo={config} />
    </div>
  );
}
