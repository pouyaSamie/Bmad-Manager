import type { Metadata } from "next";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { redirect } from "next/navigation";
import { getUsers, getUsageMetrics } from "@/actions/admin-actions";
import { UsageMetrics } from "@/components/admin/usage-metrics";
import { UsersTable } from "@/components/admin/users-table";
import { AlertBanner } from "@/components/shared/alert-banner";

export const metadata: Metadata = {
  title: "Administration",
};

export default async function AdminPage() {
  const session = await getAuthenticatedSession();
  if (!session || session.role !== "admin") redirect("/");

  const [usersResult, metricsResult] = await Promise.all([
    getUsers(),
    getUsageMetrics(),
  ]);

  return (
    <div className="mesh-gradient min-h-full">
      <div className="space-y-8 pt-6 lg:pt-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Administration Panel
        </h1>
        <p className="text-muted-foreground mt-1">
          Usage overview and user management.
        </p>
      </div>

      {metricsResult.success ? (
        <UsageMetrics
          totalUsers={metricsResult.data.totalUsers}
          totalRepos={metricsResult.data.totalRepos}
          recentUsers={metricsResult.data.recentUsers}
          activeUsersLast30d={metricsResult.data.activeUsersLast30d}
          parsingErrorRate={metricsResult.data.parsingErrorRate}
        />
      ) : (
        <AlertBanner variant="error" title={`Failed to load metrics: ${metricsResult.error}`} />
      )}

      {usersResult.success ? (
        <UsersTable users={usersResult.data} currentUserId={session.userId} />
      ) : (
        <AlertBanner variant="error" title={`Failed to load users: ${usersResult.error}`} />
      )}
      </div>
    </div>
  );
}
