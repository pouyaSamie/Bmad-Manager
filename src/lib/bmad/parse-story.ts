import matter from "gray-matter";
import { StoryDetail, StoryTask } from "./types";
import { normalizeAlphanumericId, normalizeStoryStatus } from "./utils";

function normalizeStoryIdentifier(raw: string): string {
  return /[A-Za-z]/.test(raw) ? raw.toLowerCase() : raw;
}

export function parseStory(
  content: string,
  filename: string
): StoryDetail | null {
  try {
    // Try to extract ID from filename first
    // Pattern 1: Numeric story with 2 numbers: "(spec-|story-|task-)?N-N-title.md" or "(spec-|story-|task-)?N.N-title.md"
    // e.g. "1-1-project-initialization.md", "spec-5-1-advantage.md", "story-1.2.md"
    const numericMatch = filename.match(
      /^(?:(?:spec|story|task)[_-])?(\d+)[._-](\d+)(?:[._-]|$)/i
    );
    // Pattern 2: Alphanumeric prefix: "di-1-title.md" or "spec-di-1-title.md"
    const alphaMatch =
      !numericMatch && !/^story[_-]?\d/i.test(filename)
        ? filename.match(
            /^(?:(?:spec|task)[_-])?([A-Za-z][A-Za-z0-9_-]*?)-(\d+)(?:[._-]|$)/i
          )
        : null;
    // Pattern 3: Legacy pattern: "story-N.md" or "story_N.md"
    const legacyMatch =
      !numericMatch && !alphaMatch
        ? filename.match(/story[_-]?(\d+(?:[._-]\d+)?)/i)
        : null;

    let id: string;
    let epicId: string;

    if (numericMatch) {
      id = `${numericMatch[1]}.${numericMatch[2]}`;
      epicId = numericMatch[1];
    } else if (alphaMatch) {
      const prefix = normalizeAlphanumericId(alphaMatch[1]);
      id = `${prefix}.${alphaMatch[2]}`;
      epicId = prefix;
    } else if (legacyMatch) {
      id = legacyMatch[1].replace(/[._-]/, ".");
      epicId = id.includes(".") ? id.split(".")[0] : "";
    } else {
      id = filename.replace(/\.md$/i, "");
      epicId = "";
    }

    // Check if content has frontmatter
    const hasFrontmatter = content.trimStart().startsWith("---");
    let body: string;
    let frontmatterStatus: string | undefined;
    let frontmatterTitle: string | undefined;
    let frontmatterEpicId: string | undefined;

    if (hasFrontmatter) {
      const parsed = matter(content);
      body = parsed.content;
      frontmatterStatus = parsed.data.status || parsed.data.state;
      frontmatterTitle = parsed.data.title;
      frontmatterEpicId = parsed.data.epic_id
        ? String(parsed.data.epic_id)
        : parsed.data.epic
          ? String(parsed.data.epic)
          : undefined;

      const rawFmId = parsed.data.id || parsed.data.story_id;
      if (rawFmId) {
        id = normalizeStoryIdentifier(String(rawFmId));
      } else if (parsed.data.story_key) {
        const keyMatch = String(parsed.data.story_key).match(
          /^(?:(?:spec|story|task)[_-])?(\d+)[._-](\d+)(?:[._-]|$)/i
        );
        if (keyMatch) {
          id = `${keyMatch[1]}.${keyMatch[2]}`;
          if (!epicId || epicId === "spec") epicId = keyMatch[1];
        }
      }

      if (frontmatterEpicId) epicId = normalizeAlphanumericId(frontmatterEpicId);
    } else {
      body = content;
    }

    // Extract title and potential story ID from heading:
    // "# Story 1.1: Title", "# Story DI.1: Title", "# Story 5: Title", or "# Title"
    const headingMatch = body.match(/^#\s+(?:Story\s+((?:[A-Za-z0-9_-]+[._])?\d+)[:\s]+)?(.+)/m);
    const headingStoryId = headingMatch?.[1]?.trim();
    if (
      headingStoryId &&
      (!numericMatch || id === filename.replace(/\.md$/i, "") || id.startsWith("spec."))
    ) {
      id = headingStoryId.toLowerCase();
      if (id.includes(".") && (!epicId || epicId === "spec")) {
        epicId = id.split(".")[0];
      }
    }
    const title = frontmatterTitle || headingMatch?.[2]?.trim() || `Story ${id}`;

    // Extract status from "Status: done" line (plain text, not frontmatter)
    const statusLineMatch = body.match(/^Status:\s*(.+)/im);
    const rawStatus = frontmatterStatus || statusLineMatch?.[1]?.trim();
    const statusExplicit = Boolean(rawStatus);
    const status = normalizeStoryStatus(rawStatus);

    // Extract agent from frontmatter or inline line
    const agentLineMatch = body.match(
      /^\s*(?:\*{1,2})?(?:Agent|Assigned to|Assignee|Developer|Owner)(?:\*{1,2})?:\s*(.+)/im
    );
    const rawAgent =
      (hasFrontmatter
        ? (matter(content).data.agent ||
          matter(content).data.assignee ||
          matter(content).data.assigned_to ||
          matter(content).data.developer ||
          matter(content).data.owner)
        : undefined) || agentLineMatch?.[1]?.trim();

    let agent: StoryDetail["agent"] = undefined;
    if (rawAgent) {
      if (typeof rawAgent === "object" && rawAgent !== null) {
        const obj = rawAgent as Record<string, unknown>;
        agent = {
          name: String(obj.name || obj.slug || "").replace(/^[*_`\s]+|[*_`\s]+$/g, ""),
          title: obj.title ? String(obj.title).trim() : undefined,
          icon: obj.icon ? String(obj.icon).trim() : undefined,
          slug: obj.slug ? String(obj.slug).trim() : undefined,
        };
      } else {
        const str = String(rawAgent).replace(/^[*_`\s]+|[*_`\s]+$/g, "").trim();
        const emojiMatch = str.match(/^(\p{Extended_Pictographic}|\p{Emoji})\s+(.+)$/u);
        if (emojiMatch) {
          agent = { icon: emojiMatch[1], name: emojiMatch[2].trim() };
        } else {
          agent = { name: str };
        }
      }
    }

    // Extract acceptance criteria
    const acceptanceCriteria: string[] = [];
    const acSection = body.match(
      /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|\n$|$)/i
    );
    if (acSection) {
      // Match numbered items (1. ..., 2. ...) and bullet items (- ..., * ...)
      const items = acSection[1].match(/(?:^|\n)\s*(?:\d+\.\s+|\*\*(?:Given|And|Then)\*\*|[-*]\s+)(.+)/g);
      if (items) {
        for (const item of items) {
          acceptanceCriteria.push(item.replace(/^\s*(?:\d+\.\s+|[-*]\s+)/, "").trim());
        }
      }
    }

    // Extract tasks from checkboxes
    const tasks: StoryTask[] = [];
    const taskMatches = body.matchAll(/- \[([ xX])\]\s+(.+)/g);
    for (const m of taskMatches) {
      tasks.push({
        completed: m[1].toLowerCase() === "x",
        description: m[2].trim(),
      });
    }

    return {
      id,
      title: String(title),
      status,
      statusExplicit,
      epicId,
      description: body.trim().slice(0, 1000),
      acceptanceCriteria,
      tasks,
      completedTasks: tasks.filter((t) => t.completed).length,
      totalTasks: tasks.length,
      agent,
    };
  } catch (e) {
    console.error(`Failed to parse story ${filename}:`, e);
    return null;
  }
}
