"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ChevronRight, Folder, FolderOpen, UnfoldVertical, FoldVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { renderFileIcon } from "@/lib/bmad/file-icons";
import type { FileTreeNode } from "@/lib/bmad/types";

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
  showToolbar?: boolean;
}

function collectDirectoryPaths(nodes: FileTreeNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.type === "directory") {
      result.push(node.path);
      if (node.children) {
        result.push(...collectDirectoryPaths(node.children));
      }
    }
  }
  return result;
}

function findAncestorPaths(
  nodes: FileTreeNode[],
  targetPath: string,
  currentPath: string[] = []
): string[] | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return currentPath;
    }
    if (node.type === "directory" && node.children) {
      const found = findAncestorPaths(node.children, targetPath, [
        ...currentPath,
        node.path,
      ]);
      if (found) return found;
    }
  }
  return null;
}

export function FileTree({
  nodes,
  selectedPath,
  onSelect,
  showToolbar = true,
}: FileTreeProps) {
  // Default expanded: depth < 2 directories
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const node of nodes) {
      if (node.type === "directory") {
        initial.add(node.path);
        if (node.children) {
          for (const child of node.children) {
            if (child.type === "directory") {
              initial.add(child.path);
            }
          }
        }
      }
    }
    return initial;
  });

  const allDirPaths = useMemo(() => collectDirectoryPaths(nodes), [nodes]);

  const expandAll = useCallback(() => {
    setExpandedPaths(new Set(allDirPaths));
  }, [allDirPaths]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // When selectedPath changes, ensure all its parent directories are expanded
  const [prevSelected, setPrevSelected] = useState<string | undefined>(selectedPath);
  if (selectedPath !== prevSelected) {
    setPrevSelected(selectedPath);
    if (selectedPath) {
      const ancestors = findAncestorPaths(nodes, selectedPath);
      if (ancestors && ancestors.length > 0) {
        setExpandedPaths((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const p of ancestors) {
            if (!next.has(p)) {
              next.add(p);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    }
  }

  return (
    <div className="space-y-1 text-sm overflow-hidden">
      {showToolbar && allDirPaths.length > 0 && (
        <div className="flex items-center justify-between px-1 py-1 border-b border-border/50 mb-1 text-xs text-muted-foreground">
          <span>Tree view</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={expandAll}
              title="Expand all folders"
            >
              <UnfoldVertical className="size-3.5" />
              <span>Expand all</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={collapseAll}
              title="Collapse all folders"
            >
              <FoldVertical className="size-3.5" />
              <span>Collapse all</span>
            </Button>
          </div>
        </div>
      )}
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expandedPaths={expandedPaths}
          onToggleExpand={toggleExpand}
          depth={0}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpand,
  depth,
}: {
  node: FileTreeNode;
  selectedPath?: string;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  depth: number;
}) {
  const isDirectory = node.type === "directory";
  const expanded = isDirectory ? expandedPaths.has(node.path) : false;
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const didScrollRef = useRef(false);
  const isSelected = selectedPath === node.path;

  useEffect(() => {
    if (isSelected && !didScrollRef.current && buttonRef.current) {
      buttonRef.current.scrollIntoView({ block: "nearest" });
      didScrollRef.current = true;
    }
  }, [isSelected]);

  function isTextClipped() {
    const span = spanRef.current;
    if (!span) return false;
    return span.scrollWidth > span.clientWidth;
  }

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => {
          if (isDirectory) {
            onToggleExpand(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-accent transition-colors",
          isSelected &&
            "bg-accent text-accent-foreground font-medium ring-1 ring-inset ring-primary",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDirectory ? (
          <>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                expanded && "rotate-90",
              )}
            />
            {expanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-primary" />
            )}
          </>
        ) : (
          <>
            <span className="inline-block h-3.5 w-3.5 shrink-0" />
            {renderFileIcon(node.name, "h-4 w-4 shrink-0 text-muted-foreground")}
          </>
        )}
        <Tooltip
          open={tooltipOpen}
          onOpenChange={(open) => setTooltipOpen(open && isTextClipped())}
        >
          <TooltipTrigger asChild>
            <span ref={spanRef} className="truncate">
              {node.name}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">{node.name}</TooltipContent>
        </Tooltip>
      </button>
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
