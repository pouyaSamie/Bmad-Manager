import { Studio } from "@/components/workspace/studio";
export default async function Page({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return <Studio owner={owner} name={repo} section="workflow" />;
}
