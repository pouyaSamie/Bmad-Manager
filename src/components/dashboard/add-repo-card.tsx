"use client";

import { Card } from "@/components/ui/card";
import { Plus, Workflow } from "lucide-react";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";

interface AddRepoCardProps {
  localFsEnabled?: boolean;
  githubEnabled?: boolean;
}

export function AddRepoCard({ localFsEnabled, githubEnabled }: AddRepoCardProps) {
  return (
    <AddRepoDialog
      localFsEnabled={localFsEnabled}
      githubEnabled={githubEnabled}
      trigger={
        <Card className="glass-card hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer aspect-square flex items-center justify-center border-dashed border-2 border-border/50 hover:border-primary/30 p-8">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Workflow className="h-12 w-12" aria-hidden="true" />
            </div>
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Add a project</span>
          </div>
        </Card>
      }
    />
  );
}
