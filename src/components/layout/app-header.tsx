"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Command } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

const routeLabels: Record<string, string> = { profile: "Profile", overview: "Overview", epics: "Epics", stories: "Stories", docs: "Library", control: "BMad Control" };

function getRouteLabel(segment: string) { return routeLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1); }

export function AppHeader() {
  const pathname = usePathname();
  const { extraSegments } = useBreadcrumb();
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: { label: string; href?: string; onClick?: () => void }[] = [{ label: "Dashboard", href: "/" }];

  if (segments[0] === "repo" && segments.length >= 3) {
    const [owner, repo] = [segments[1], segments[2]];
    if (segments[3]) {
      if (extraSegments.length > 0) for (const segment of extraSegments) breadcrumbs.push({ label: segment.label, onClick: segment.onClick });
      else breadcrumbs.push({ label: getRouteLabel(segments[3]), href: `/repo/${owner}/${repo}/${segments[3]}` });
    }
  } else if (segments.length === 1 && segments[0] !== "") breadcrumbs.push({ label: getRouteLabel(segments[0]) });

  return (
    <header className="sticky top-3 z-30 mx-3 mt-3 flex h-14 items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar/95 px-4 shadow-sm backdrop-blur group-data-[collapsible=icon]:ml-2">
      <SidebarTrigger className="size-8 rounded-md hover:bg-sidebar-accent" />
      <Separator orientation="vertical" className="h-5" />
      <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1"><>{index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}</>{index === breadcrumbs.length - 1 ? <span className="truncate font-semibold">{crumb.label}</span> : crumb.onClick ? <button type="button" onClick={crumb.onClick} className="truncate text-muted-foreground transition-colors hover:text-foreground">{crumb.label}</button> : <Link href={crumb.href!} className="truncate text-muted-foreground transition-colors hover:text-foreground">{crumb.label}</Link>}</span>)}
      </nav>
      <div className="ml-auto flex items-center gap-2"><span className="hidden items-center gap-1 rounded-md border border-sidebar-border bg-background px-2 py-1 text-xs text-muted-foreground lg:flex"><Command className="h-3 w-3" />B</span><AnimatedThemeToggler className="size-8 rounded-md p-1.5 hover:bg-sidebar-accent" /></div>
      <ScrollProgress />
    </header>
  );
}