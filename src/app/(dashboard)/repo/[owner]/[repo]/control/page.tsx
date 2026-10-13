import { redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  redirect("/repo/" + owner + "/" + repo + "/workflow");
}
