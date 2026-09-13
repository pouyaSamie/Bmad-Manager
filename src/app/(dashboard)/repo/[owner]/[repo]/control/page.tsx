import { BmadControlPanel } from "@/components/bmad/bmad-control-panel";

export default async function BmadControlPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return <BmadControlPanel owner={owner} name={repo} />;
}