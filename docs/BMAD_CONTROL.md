# BMad Control

BMad Control is the project workspace for managing a locally imported BMad installation. It scans installed agents and skills, lets you shape a delivery workflow, and makes every project change a reviewable operation.

It is available only for [local-folder projects](./LOCAL_FOLDER.md), not GitHub-only imports.

## One-time setup

Enable local projects and add a stable encryption key to `.env`:

```dotenv
ENABLE_LOCAL_FS=true
AGENT_ENCRYPTION_KEY=replace-with-a-32-byte-base64url-key
```

Generate the key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Keep this value stable. It encrypts gateway API keys in PostgreSQL; changing it without migrating the stored values makes those keys unreadable.

During local development, run the web application and worker in separate terminals:

```bash
pnpm dev
```

```bash
pnpm bmad:worker
```

The worker is the only process that applies approved BMad operations.

## Use BMad Control

1. Import a local BMad project, open it, and choose **BMad Control**.
2. In **Overview**, select **Scan** to discover installed agents and skills.
3. Add the project gateway URL, model, and optional API key. You can also give individual agents their own OpenAI, OpenRouter, Ollama, LM Studio, or custom OpenAI-compatible route.
4. Build or adjust the **Agent workflow**. The discovered standard BMad agents are arranged as a delivery pipeline when available: Analyst → PM → UX → Architect → Developer → TEA → Product Owner.
5. Add feedback loops and quality gates. The default BMad loop sends Product Owner verdicts and TEA findings back to the PM for revision and triage; adapt it to the agents installed in your project.
6. Draft the workflow change, inspect it in **Activity & approvals**, and approve it. The worker writes the workflow override only after approval.

The agent names can differ between BMad installations. The workflow starts with whichever matching discovered agents are present, and you can reorder, add, or remove them before drafting.

## What each area does

| Area | Purpose |
|---|---|
| **Overview** | Scan the project, configure the project gateway, and build the workflow and feedback loops. |
| **Installation** | Draft a BMad install or update using the official stable installer and selected tool IDs. |
| **Agents** | Inspect discovered personas, set a per-agent model route, or draft a team/personal customization. |
| **Skills** | Search discovered skills, edit managed skills, or clone an installer-owned skill before changing it. |
| **Chat** | Talk to a selected agent through the configured gateway. Chats can explain and propose changes but cannot write files or run commands. |
| **Activity & approvals** | Review previews, approve drafts, and inspect completed or failed operation output. |

## Safe change model

Changes never apply as soon as they are drafted. The sequence is:

1. Draft an install, update, override, agent, skill, or workflow operation.
2. Review the command and file preview in **Activity & approvals**.
3. Approve the draft.
4. Let `pnpm bmad:worker` process the queued operation.
5. Review the recorded, redacted result and rescan if needed.

Installer-owned configuration remains protected. Project customizations are written under `_bmad/custom/`; personal customizations use the `.user.toml` layer. Editing an installer-owned skill creates a managed copy in `.agents/skills/` instead of changing the original.

## Docker note

When Bmad Manager runs in Docker, the project folder must be mounted writable for BMad Control operations. See the Docker section in [Local Folder Import](./LOCAL_FOLDER.md) before approving any operation.
