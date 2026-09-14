"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Columns3, LayoutList } from "lucide-react";
import { StoryFilters, createFilter, type Filter } from "./story-filters";
import { StoriesTable } from "./stories-table";
import { KanbanBoard } from "./kanban-board";
import { StoryDetailView } from "@/components/epics/story-detail-view";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import type { StoryDetail, Epic } from "@/lib/bmad/types";

interface StoriesViewProps {
  stories: StoryDetail[];
  epics: Epic[];
  initialView?: "table" | "kanban";
  initialEpic?: string;
}

export function StoriesView({
  stories,
  epics,
  initialView,
  initialEpic,
}: StoriesViewProps) {
  // Identify active epic (in-progress epic, or first non-completed epic, or first epic)
  const activeEpic = useMemo(() => {
    return (
      epics.find((e) => e.status === "in-progress") ??
      epics.find((e) => e.status !== "done") ??
      epics[0]
    );
  }, [epics]);

  // Default view is "kanban" (Board)
  const [view, setView] = useState<"table" | "kanban">(() => {
    if (initialView) return initialView;
    return "kanban";
  });

  // Default filter is active epic unless explicitly "all"
  const [filters, setFilters] = useState<Filter<string>[]>(() => {
    if (initialEpic === "all") return [];
    const targetEpicId = initialEpic || activeEpic?.id;
    if (targetEpicId) {
      return [createFilter("epicId", "is", [targetEpicId])];
    }
    return [];
  });

  const [search, setSearch] = useState("");
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const selectedStory = useMemo(
    () => (selectedStoryId ? stories.find((s) => s.id === selectedStoryId) ?? null : null),
    [stories, selectedStoryId]
  );
  const handleSelectStory = useCallback((story: StoryDetail) => {
    setSelectedStoryId(story.id);
  }, []);
  const isInitialMount = useRef(true);

  // Sync with localStorage on client if no explicit server view in URL
  useEffect(() => {
    if (!initialView) {
      try {
        const savedView = localStorage.getItem("bmad_stories_view");
        if (savedView === "table" || savedView === "kanban") {
          const timeoutId = window.setTimeout(() => setView(savedView), 0);
          return () => window.clearTimeout(timeoutId);
        }
      } catch {}
    }
  }, [initialView]);

  // Update browser URL query params without reloading
  const updateUrl = useCallback((currentView: "table" | "kanban", currentFilters: Filter<string>[]) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", currentView === "table" ? "backlog" : "board");

    const epicFilter = currentFilters.find((f) => f.field === "epicId");
    if (epicFilter && epicFilter.values.length > 0) {
      url.searchParams.set("epic", epicFilter.values[0]);
    } else {
      url.searchParams.set("epic", "all");
    }

    window.history.replaceState(null, "", url.toString());
  }, []);

  // Synchronize URL on mount and whenever view or filters change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      updateUrl(view, filters);
      return;
    }
    updateUrl(view, filters);
  }, [view, filters, updateUrl]);

  const handleViewChange = useCallback((newView: "table" | "kanban") => {
    setView(newView);
    try {
      localStorage.setItem("bmad_stories_view", newView);
    } catch {}
  }, []);

  const applyFilters = useCallback(
    (story: StoryDetail) => {
      for (const filter of filters) {
        if (filter.field === "status" && filter.values.length > 0) {
          const match =
            filter.operator === "is_not" || filter.operator === "is_not_any_of"
              ? !filter.values.includes(story.status)
              : filter.values.includes(story.status);
          if (!match) return false;
        }
        if (filter.field === "epicId" && filter.values.length > 0) {
          const match =
            filter.operator === "is_not" || filter.operator === "is_not_any_of"
              ? !filter.values.includes(story.epicId)
              : filter.values.includes(story.epicId);
          if (!match) return false;
        }
      }
      return true;
    },
    [filters]
  );

  const filtered = useMemo(
    () =>
      stories.filter(
        (story) =>
          (!search ||
            story.title.toLowerCase().includes(search.toLowerCase()) ||
            story.id.toLowerCase().includes(search.toLowerCase())) &&
          applyFilters(story)
      ),
    [stories, search, applyFilters]
  );

  return (
    <>
      <StaggeredList
      className="space-y-4"
      role="region"
      aria-label="Stories list"
      staggerDelay={0.1}
    >
      <StaggeredItem className="flex flex-col gap-3 rounded-md border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
        <StoryFilters
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          epics={epics}
        />
        <div
          className="flex rounded-md border bg-muted/40 p-1"
          role="group"
          aria-label="Display mode"
        >
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("table")}
            className="gap-1.5"
            aria-label="List view"
          >
            <LayoutList className="h-4 w-4" />
            <span className="hidden sm:inline">Backlog</span>
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("kanban")}
            className="gap-1.5"
            aria-label="Board view"
          >
            <Columns3 className="h-4 w-4" />
            <span className="hidden sm:inline">Board</span>
          </Button>
        </div>
      </StaggeredItem>
      <StaggeredItem>
        {view === "table" ? (
          <StoriesTable stories={filtered} onSelectStory={handleSelectStory} />
        ) : (
          <KanbanBoard stories={filtered} onSelectStory={handleSelectStory} />
        )}
      </StaggeredItem>
    </StaggeredList>

    <Sheet
      open={!!selectedStory}
      onOpenChange={(open) => {
        if (!open) setSelectedStoryId(null);
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader className="border-b pb-4 pr-10">
          <SheetTitle className="text-base font-semibold">
            Story Details
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {selectedStory ? `Details and tasks for story ${selectedStory.id}` : "Story details"}
          </SheetDescription>
        </SheetHeader>
        {selectedStory && (
          <div className="p-4 pt-2">
            <StoryDetailView story={selectedStory} />
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}
