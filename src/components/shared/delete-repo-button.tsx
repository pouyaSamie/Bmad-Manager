"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteProjectDialog } from "@/components/shared/delete-project-dialog";

interface DeleteRepoButtonProps {
  owner: string;
  name: string;
  displayName: string;
  sourceType?: string;
}

export function DeleteRepoButton({
  owner,
  name,
  displayName,
  sourceType = "local",
}: DeleteRepoButtonProps) {
  return (
    <DeleteProjectDialog
      owner={owner}
      name={name}
      displayName={displayName}
      sourceType={sourceType}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove project"
          title="Remove project"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
    />
  );
}
