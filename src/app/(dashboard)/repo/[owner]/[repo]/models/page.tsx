import { ModelsProvidersManager } from "@/components/bmad/models-providers-manager";

export default async function ModelsProvidersPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return <ModelsProvidersManager owner={owner} name={repo} />;
}
