"use client";

import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useState } from "react";
import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { WorkItemBadge } from "@/components/shared/work-item-badge";
import type { StoryDetail } from "@/lib/bmad/types";
import { getStoryShortId } from "@/lib/bmad/utils";

const columns: ColumnDef<StoryDetail>[] = [
  { id: "type", header: "Work item type", cell: () => <WorkItemBadge type="story" />, size: 115, enableSorting: false },
  { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("id")}</span>, size: 60, enableSorting: false },
  { accessorKey: "title", header: ({ column }) => <DataGridColumnHeader column={column} title="Title" />, cell: ({ row }) => <span className="block truncate font-medium text-foreground hover:text-primary transition-colors">{row.getValue("title")}</span> },
  { accessorKey: "status", header: ({ column }) => <DataGridColumnHeader column={column} title="State" />, cell: ({ row }) => <StatusBadge status={row.getValue("status")} compact />, size: 105 },
  { accessorKey: "agent", header: "Agent", cell: ({ row }) => { const agent = row.original.agent; if (!agent) return <span className="text-muted-foreground">—</span>; return <span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">{agent.icon || "🤖"}</span><span className="truncate">{agent.name}</span></span>; }, size: 120, enableSorting: false },
  { accessorKey: "epicTitle", header: ({ column }) => <DataGridColumnHeader column={column} title="Epic" />, cell: ({ row }) => <span className="block truncate text-sm text-muted-foreground">{row.getValue("epicTitle") || "—"}</span>, size: 190 },
  { accessorKey: "totalTasks", header: "Tasks", cell: ({ row }) => { const story = row.original; return story.totalTasks > 0 ? <span className="text-sm tabular-nums text-muted-foreground">{story.completedTasks}/{story.totalTasks}</span> : <span className="text-muted-foreground">—</span>; }, size: 70, enableSorting: false },
];

interface StoriesTableProps {
  stories: StoryDetail[];
  onSelectStory?: (story: StoryDetail) => void;
}

export function StoriesTable({ stories, onSelectStory }: StoriesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({ data: stories, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), onSortingChange: setSorting, state: { sorting }, initialState: { pagination: { pageSize: 20 } } });

  return (
    <DataGrid
      table={table}
      recordCount={stories.length}
      onRowClick={onSelectStory}
      tableLayout={{ dense: true, headerSticky: true, headerBackground: true, headerBorder: true, rowBorder: true }}
      tableClassNames={{ headerRow: "bg-muted/55", bodyRow: "hover:bg-info/5 cursor-pointer" }}
    >
      <DataGridContainer className="rounded-md bg-card shadow-sm">
        <DataGridTable />
      </DataGridContainer>
      {table.getPageCount() > 1 && <DataGridPagination sizes={[10, 20, 50]} info="{from} - {to} of {count}" />}
    </DataGrid>
  );
}