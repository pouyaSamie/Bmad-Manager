# Bmad Manager

## Product Scope & Interface

- Retain Next.js, React, Prisma, Better Auth, and existing project/artifact capabilities.
- Mantine is the interface and theme authority; React Flow is the workflow editor. Shared workspace components live in `src/components/workspace/`.
- Use Mantine navigation, forms, dialogs, drawers, and shared controls. Do not reintroduce shadcn, Radix, or ReUI presentation frameworks. The remaining `src/components/ui/` files are compatibility adapters for document rendering.
- Global navigation: **Projects, Connections**. Project navigation: **Overview, Agents, Workflow, Library, Epics, Stories, Settings**. Preserve project context, pending-change indicators, old URL redirects, and document links.
- Use the shared agent inspector for **Model, Persona, Skills, Test chat** from both Agents and Workflow. Show inherited settings, unsaved previews, and unapplied repository drafts clearly.
- Keep neutral surfaces, a restrained indigo accent, consistent light/dark themes, visible keyboard focus, reduced motion, and WCAG AA contrast. Ordinary text is 14–16px, secondary labels at least 12px, and touch targets at least 44px.
- Verify layouts at 390px, 768px, and 1440px in both themes. Use a mobile navigation drawer and full-screen mobile inspectors; horizontal scrolling belongs only inside deliberate graph/table containers.
- Workflow execution, work management integrations, ticket backends, autonomous feedback loops, merges, and releases are deferred. Do not label design settings as running or completed work.

## Tailwind CSS

- Uses Tailwind CSS v4 with `@theme inline` in `src/app/globals.css` (no tailwind.config file)
- **Never use arbitrary bracket values** when a canonical Tailwind class exists:
  - Spacing/sizing: divide px by 4 (e.g. `160px` → `w-40`, `15px` → `mt-3.75`, `2px` → `h-0.5`)
  - Ring width: `ring-3` not `ring-[3px]`
  - Percentages: fraction notation (`top-1/2` not `top-[50%]`)
  - Rem: convert to spacing scale (`8rem` = 128px / 4 = `min-w-32`)
- Arbitrary values are OK only for: calc expressions, non-standard values, CSS variable references
- Repeated hex colors should be added as theme tokens in `globals.css` rather than as inline arbitrary values
- Map shared Tailwind colors to Mantine theme variables. Where Tailwind remains, follow these conventions rather than introducing another theme system.

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
  - Vendor-installed skills are read-only; discover installed metadata and supported tool-specific directories (`.agents/skills/`, `.agent/skills/`, `.claude/skills/`, `.cline/skills/`, `.bob/skills/`, `.adal/skills/`).
  - Custom overrides & workflows: `_bmad/custom/` (committed) and `*.user.toml` (gitignored)
- **Non-Interactive CLI Installation:**
  - Always pass `--directory <projectRoot>` to `bmad-method install --yes`. Without `--directory`, the CLI prompts for interactive directory confirmation, causing background processes to hang indefinitely.
- **Zero-Manual-Typing UI Standard:**
  - Tool/IDE selection must use interactive checkboxes (no comma-separated text strings).
  - Module selection (`bmm`, `bmb`) must use checkboxes.
  - Languages, channels, and toggles must use select dropdowns or segmented buttons.
  - Text fields must have pre-filled sensible defaults (e.g. User Name = `Developer`, Output Folder = `_bmad-output`).
  - Model selection must use searchable discovered catalogs; never require users to enter model IDs for normal assignment.
- **Safe Change Model for BMad Control:**
  - Web application never executes system writes or CLI operations directly on local project repositories.
  - All operations are drafted into `prisma.bmadOperation` with `status: "draft"`, previewed in the UI, approved by the user (`status: "queued"`), and executed by the separate worker (`pnpm bmad:worker`).
  - Worker output is redacted to protect sensitive tokens/paths.
  - Claim queued operations atomically. Validate payloads and paths again in the worker, write configuration files atomically, and restore previous customization files if the installed resolver rejects a change.
  - Approval previews must explain affected agents, files, and before/after changes using human-readable names. Queued does not mean applied.
- **Project Lifecycle & Safe Deletion Model:**
  - **Unlink from Dashboard (Safe Default):** Removes project record from database and dashboard only. Local source code, filesystem folders, BMAD artifacts (`_bmad/`, `_bmad-output/`, `.agents/skills/`), and git history remain 100% untouched.
  - **Full Uninstall (Local Projects Only):** Removes project from dashboard AND purges BMAD assets (`_bmad/`, `_bmad-output/`, `.agents/skills/`) from the local folder, while preserving the user's source code and git repository.
  - **Import Deduplication:** `importLocalFolder` and `getAuthenticatedRepos` enforce deduplication guards by checking path normalization and project name to prevent duplicate project entries for the same physical workspace folder.
  - **Import Journey:** Choose a folder, inspect its installation, configure installation only when needed, and review the import. Existing installations must not be reinstalled. Missing installations create a draft for later approval; already imported folders offer **Open project**.

## Agent & Skill Customization Lifecycle

- **Agent Customization:**
  - Central roster descriptors live in `_bmad/custom/config.toml` (or `config.user.toml`) under `[agents.<slug>]` with `name`, `title`, `icon`, `description`, and `skill`.
  - Supported behavior overrides live in `_bmad/custom/<skill>.toml` (or `<skill>.user.toml`), validated against installed `customize.toml` schemas and the installed resolver when present. The inspector's persona maps to the supported agent identity field.
  - Use proper TOML parsing/serialization (`smol-toml`), not regular-expression editing. Preserve native/team/personal override semantics and legacy Manager bindings; preview legacy file conversions before worker execution.
  - Scopes: Team scope (`.toml`) is committed to Git; personal scope (`.user.toml`) is gitignored.
  - Reconcile rescans by stable identity. Preserve model routes, conversations, and workflow references; mark missing capabilities unavailable instead of deleting their history.
- **Skill Customization & Cloning:**
  - Vendor skills in `.agents/skills/` are protected. To customize, clone to a managed project skill in `.agents/skills/<slug>/SKILL.md`.
  - Newly created or cloned skills can be assigned to agents directly in the UI or written to `_bmad/custom/config.toml`.
  - Use a unique managed destination, never overwrite installed assets, preserve supporting skill resources, and reject symlink escapes.
- **Delivery Workflow & Loops:**
  - Designs are persisted in `_bmad/custom/workflow.toml`, explicitly identified as Manager configuration. Use the versioned graph in `src/lib/workflow-graph.ts`: stable node IDs, agent slugs, positions, forward/parallel connections, and feedback edges.
  - Persist feedback source/target, trigger, description, payload description, and iteration limit. Validate missing references, duplicate IDs/edges, and forward cycles.
  - Canvas, accessible list, summaries, and approval previews must derive from the same graph. Provide a searchable palette, fit-to-view, auto-layout, undo/redo, and keyboard-accessible editing.
  - **Manager Seven-Agent Preset (5-Phase, 2-Tier DAG):** These are intended handoffs and outputs, not automatic execution. Distinguish official installed capabilities, extensions, Manager presets, and custom agents; do not claim all seven are the official BMad core roster.
    - **Phase 1: Discovery & Needs:** Mary (Business Analyst) — Input: Project Brief/Domain Context → Output: PRD (`_bmad-output/planning-artifacts/`).
    - **Phase 2: Definition & Epics:** John (Product Manager) — Input: PRD, Feedback → Output: Epics, Stories, Gherkin Acceptance Criteria. Sally (UX Designer) — Input: PRD, Personas → Output: UI Specs, Component Tokens.
    - **Phase 3: System Architecture:** Winston (System Architect) — Input: Stories, Stack Constraints → Output: `architecture.md`, Schema, API Specs.
    - **Phase 4: Dev & QA Loop:** Amelia (Senior Software Engineer) — Input: Story, Architecture Specs → Output: Code, Git Branch, PR. Murat (Test Architect & QA) — Input: Code, PR → Output: Vitest Traces, Defect Reports.
    - **Phase 5: PO Acceptance Gate:** Nella (Product Owner & Critic) — Input: Sprint Delivery, Stories, Code → Output: PO Verdict, Quality Score (>= 9.0).
    - **Release Gate:** Final delivery milestone.
  - **Persona Standard — End-User Advocate Critic:** Nella must not merely inspect static code or developer markup. The persona is strictly defined to adopt the authentic perspective of a real end-user interacting with the product (evaluating ergonomic friction, journey clarity, cognitive load, intuitive UX, and status feedback). If end-users would feel lost or confused, Nella issues critique verdicts requiring revision.
  - **Collision-Free Feedback Loop Geometry:**
    - Feedback loops connect backward through dedicated curved SVG paths that bypass intermediate nodes:
      - **PO Critic Verdict Loop (`verdicts`):** Arches overhead above the top tier to clear intermediate agents back to John (PM).
      - **QA Defect Loop (`findings`):** Arches underneath the lower tier back to Amelia (Dev) or John (PM).
      - Derive clearance from current node positions rather than fixed legacy coordinates. Keep labels clear of nodes when dragging or auto-layout changes positions.
      - Supports triggers: `verdicts` (PO/Critic to PM), `findings` (QA to PM/Dev), `needs_revision` (rework), and `custom`.
  - **Interactive Canvas & In-Canvas Node Configuration:**
    - Zoom/pan navigation (50% to 180%), drag-and-drop node positioning, and auto-layout reset.
    - Double-click or **Configure** opens the shared agent inspector to configure model routes, persona definitions, skill bindings, and live `/api/bmad/chat` test conversations.

## AI Models & Gateway Architecture

- **Reusable Connections & Catalogs:**
  - `prisma.bmadConnection` stores account-owned connections for `agy`, `codex-cli`, `gemini`, `openai`, `openrouter`, `ollama`, `lm-studio`, and `custom`. Codex CLI is distinct from OpenAI API access.
  - Discover real model catalogs; expose stale/unavailable states rather than invented model availability or automatic authentication claims.
  - Connection states: `unverified` (saved only), `reachable` (catalog responded), `authenticated` (catalog responded using a credential), `tested` (real conversation completed), and `unavailable` (latest check failed).
- **Connection/Model Routing:**
  - Agent override (`connectionId`, `modelId`) takes precedence over the project runtime default pair. Resolve endpoint, model, provider, and credentials together in `src/lib/model-routing.ts`; never inherit a key from a different provider.
  - Require an owned connection and a discovered model for test chat. Legacy gateway fields remain migration compatibility data, not a verified automatic AGY fallback.
  - Model routing saves immediately to the database. Repository persona/skill/workflow customization follows the reviewed worker lifecycle.
- **Separate Host CLI Bridges:**
  - Implementation: `scripts/cli-gateway.ts`; `scripts/agy-gateway.ts` is a compatibility entry point. Start with `pnpm codex:gateway` (port 3006) or `pnpm agy:gateway` (port 3005).
  - Use `http://localhost:<port>/v1` from the host or `http://host.docker.internal:<port>/v1` from Docker. Loopback is the default binding; configure `CLI_BRIDGE_HOST` explicitly when necessary for Docker networking.
  - Require a random `CLI_BRIDGE_TOKEN` of at least 32 characters. CLI subscription login does not replace bridge request authentication. Keep `.env.bridge.local` ignored and never expose a bridge publicly.
  - Codex uses the existing signed-in account through app-server with ephemeral read-only sessions, disabled shell/patch/MCP tools, and rejected tool/approval requests. Keep CLI launches outside the web process and project repositories.
  - AGY requires verified deny rules for file, command, MCP, and web tools; refuse tests when restrictions cannot be verified. Never use unrestricted permission flags or silently change global CLI settings. Exact rules and host setup are in `docs/workspace-upgrade.md`.
  - Model catalogs come from the actual CLI. Do not hard-code a default model or imply that a provider is authenticated/tested without evidence.
- **Test Conversations:**
  - `/api/bmad/chat` checks project ownership, agent availability, connection ownership, and conversation/agent binding. Keep recent history bounded.
  - Normalize streaming into metadata/text/completion/error events; buffer split SSE/UTF-8 chunks and support cancellation/timeouts. Retain partial output and distinguish failed/cancelled turns from completed turns.
  - Test edited model/persona/skill settings without saving them, clearly identifying preview settings. Report adapter-selected provider/model/latency rather than relying on a model to identify itself.
  - Sanitize errors and redact secrets/paths. Decrypt credentials only in internal server code; never expose secret-bearing routing helpers as public server actions.
- **Secret Encryption:**
  - Gateway API keys are encrypted at rest using `encryptSecret()` with `AGENT_ENCRYPTION_KEY` (AES-256-GCM) and decrypted on demand via `decryptSecret()` before calling inference providers.

## Path Security & Asset Streaming

- Never access local files using unvalidated path concatenation.
- Always use `safeChild()` or security provider utilities to jail file access inside the project root and prevent path traversal (`../`) attacks.
- Check real paths to reject symlink/junction escapes as well as lexical traversal.
- Serve local images and binary assets through `/api/repo/[owner]/[repo]/raw?path=<filePath>` with proper MIME types and session authorization.

## Database Migrations

- **Development:** `pnpm prisma migrate dev --name <description>`
- **Production:** `pnpm prisma migrate deploy` (never use `migrate dev` in production)
- **After schema changes:** `pnpm prisma generate` to regenerate the client
- **Legacy workspace conversion:** `pnpm db:migrate-workspace` after schema migrations. Preserve owner-scoped routes without merging ambiguous credentials, graph references, existing files, and history. Conversion must be idempotent.

## Development & Runtime Commands

- `pnpm dev` — Start the Next.js development server (port 3002)
- `pnpm bmad:worker` — Run the BMad Control background operation worker
- `pnpm agy:gateway` — Launch the Antigravity (AGY) session gateway bridge (port 3005)
- `pnpm codex:gateway` — Launch the signed-in Codex host bridge (port 3006)
- `pnpm build` — Production build and type checking
- `pnpm lint` — ESLint
- `pnpm test` — Run the Vitest test suite
- `pnpm test:watch` — Run Vitest in watch mode
- `pnpm db:migrate` — Create and apply Prisma development migrations
- `pnpm db:push` — Push schema changes without creating a migration
- `pnpm db:create-admin` — Seed an initial administrator user
- `pnpm test:journey` — Playwright verification against the running app using isolated mutable fixtures
- `pnpm exec tsx scripts/capture-readme.ts` — Refresh README screenshots from real screens without applying changes; requires `QA_EMAIL`, `QA_PASSWORD`, and `QA_PROJECT_PATH`

## Testing

- **Frameworks:** Vitest for unit tests; Playwright for browser journeys and README captures
- **Run tests:** `pnpm test`
- **Watch mode:** `pnpm test:watch`
- **Test locations:**
  - BMAD parsers: `src/lib/bmad/__tests__/`
  - Middleware: `src/middleware.test.ts`
  - Utilities: `src/lib/__tests__/`
- Cover stable scan identity, credential isolation, ownership, TOML round trips, protected assets, graph validation, migration behavior, streaming failures, cancellation, and worker rejection/rollback.
- Browser verification must follow import → configure → test → design → review → approve → worker application using isolated fixtures. Never mutate existing user projects to create test data.
- Check 390px, 768px, and 1440px in both themes, including overflow and browser errors. Keep generated verification artifacts in ignored `.qa-results/`.
- Each configured provider needs a real smoke conversation. Missing providers remain explicitly unverified. CLI safety tests must prove test chat cannot modify project files.
- For journey configuration and fixture requirements, see `README.md`. Replace README images with real Playwright captures when the interface changes; do not use simulated screenshots.
