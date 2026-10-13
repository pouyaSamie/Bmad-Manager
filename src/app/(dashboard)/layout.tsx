import { redirect } from "next/navigation";
import {
  getAuthenticatedSession,
  getAuthenticatedRepos,
} from "@/lib/db/helpers";
import { getGitHubToken } from "@/lib/github/client";
import { prisma } from "@/lib/db/client";
import { WorkspaceShell } from "@/components/workspace/shell";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getAuthenticatedSession();
  if (!s) redirect("/login");
  const repos = await getAuthenticatedRepos(s.userId);
  const githubEnabled = !!(
    (process.env.GITHUB_PAT || process.env.GITHUB_CLIENT_ID) &&
    (await getGitHubToken(s.userId))
  );
  const rows = await prisma.bmadOperation.findMany({
    where: {
      status: { in: ["draft", "queued", "running"] },
      runtime: { repo: { userId: s.userId } },
    },
    select: {
      runtime: { select: { repo: { select: { owner: true, name: true } } } },
    },
  });
  const pending: Record<string, number> = {};
  for (const row of rows) {
    const p = "/repo/" + row.runtime.repo.owner + "/" + row.runtime.repo.name;
    pending[p] = (pending[p] ?? 0) + 1;
  }
  return (
    <BreadcrumbProvider>
      <WorkspaceShell
        repos={repos}
        email={s.email}
        admin={s.role === "admin"}
        localFsEnabled={process.env.ENABLE_LOCAL_FS === "true"}
        githubEnabled={githubEnabled}
        pending={pending}
      >
        {children}
      </WorkspaceShell>
    </BreadcrumbProvider>
  );
}
