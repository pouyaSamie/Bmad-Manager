# Bmad Manager

## Tailwind CSS

- Uses Tailwind CSS v4 with `@theme inline` in `src/app/globals.css` (no tailwind.config file)
- **Never use arbitrary bracket values** when a canonical Tailwind class exists:
  - Spacing/sizing: divide px by 4 (e.g. `160px` → `w-40`, `15px` → `mt-3.75`, `2px` → `h-0.5`)
  - Ring width: `ring-3` not `ring-[3px]`
  - Percentages: fraction notation (`top-1/2` not `top-[50%]`)
  - Rem: convert to spacing scale (`8rem` = 128px / 4 = `min-w-32`)
- Arbitrary values are OK only for: calc expressions, non-standard values, CSS variable references
- Repeated hex colors should be added as theme tokens in `globals.css` rather than as inline arbitrary values
- shadcn UI components live in `src/components/ui/` and are project-owned — they can and should follow these conventions

## Error Handling Pattern

All server actions return `ActionResult<T>`:

```typescript
type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: string }
```

Always use `sanitizeError()` from `@/lib/errors` to sanitize error messages before returning them to clients. Never expose `error.message` directly.

```typescript
import { sanitizeError } from "@/lib/errors";
// ...
} catch (error) {
  return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "DB_ERROR" };
}
```

## Server Actions Conventions

- Always validate input with Zod at the top of the action
- Use `requireAdmin()` from `@/lib/db/helpers` for admin-only actions
- Call `revalidatePath()` or `revalidateTag()` after mutations
- Return `ActionResult<T>` shape consistently
- Actions live in `src/actions/`

## BMad Method Architecture & Conventions

- **Directory Structure:**
  - Planning artifacts: `_bmad-output/planning-artifacts/` (PRDs, architecture, epics)
  - Implementation artifacts: `_bmad-output/implementation-artifacts/` (sprints, stories)
  - Vendor-installed skills: `.agents/skills/` (read-only)
  - Custom overrides & workflows: `_bmad/custom/` (committed) and `*.user.toml` (gitignored)
- **Non-Interactive CLI Installation:**
  - Always pass `--directory <projectRoot>` to `bmad-method install --yes`. Without `--directory`, the CLI prompts for interactive directory confirmation, causing background processes to hang indefinitely.
- **Zero-Manual-Typing UI Standard:**
  - Tool/IDE selection must use interactive checkboxes (no comma-separated text strings).
  - Module selection (`bmm`, `bmb`) must use checkboxes.
  - Languages, channels, and toggles must use select dropdowns or segmented buttons.
  - Text fields must have pre-filled sensible defaults (e.g. User Name = `Developer`, Output Folder = `_bmad-output`).
- **Safe Change Model for BMad Control:**
  - Web application never executes system writes or CLI operations directly on local project repositories.
  - All operations are drafted into `prisma.bmadOperation` with `status: "draft"`, previewed in the UI, approved by the user (`status: "queued"`), and executed by the separate worker (`pnpm bmad:worker`).
  - Worker output is redacted to protect sensitive tokens/paths.

## Agent & Skill Customization Lifecycle

- **Agent Customization:**
  - Persisted in `_bmad/custom/config.toml` (or `.user.toml`) under `[agents.<slug>]` with `name`, `title`, `icon`, `description`, `persona`, and `skill`.
  - Scopes: Team scope (`.toml`) is committed to Git; personal scope (`.user.toml`) is gitignored.
- **Skill Customization & Cloning:**
  - Vendor skills in `.agents/skills/` are protected. To customize, clone to a managed project skill in `.agents/skills/<slug>/SKILL.md`.
  - Newly created or cloned skills can be assigned to agents directly in the UI or written to `_bmad/custom/config.toml`.
- **Delivery Workflow & Loops:**
  - Sequence order and feedback loops are persisted in `_bmad/custom/workflow.toml`.
  - Core agent sequence: Mary (Analyst) → John (PM) → Sally (UX) → Winston (Architect) → Amelia (Dev) → Murat (QA Advisor) → Nella (Product Owner & Critic).
  - Feedback loops support triggers: `verdicts` (PO/Critic to PM), `findings` (TEA to PM), `needs_revision` (rework), and `custom`.

## Path Security & Asset Streaming

- Never access local files using unvalidated path concatenation.
- Always use `safeChild()` or security provider utilities to jail file access inside the project root and prevent path traversal (`../`) attacks.
- Serve local images and binary assets through `/api/repo/[owner]/[repo]/raw?path=<filePath>` with proper MIME types and session authorization.

## Database Migrations

- **Development:** `pnpm prisma migrate dev --name <description>`
- **Production:** `pnpm prisma migrate deploy` (never use `migrate dev` in production)
- **After schema changes:** `pnpm prisma generate` to regenerate the client

## Testing

- **Framework:** Vitest
- **Run tests:** `pnpm test`
- **Watch mode:** `pnpm test:watch`
- **Test locations:**
  - BMAD parsers: `src/lib/bmad/__tests__/`
  - Middleware: `src/middleware.test.ts`
  - Utilities: `src/lib/__tests__/`
