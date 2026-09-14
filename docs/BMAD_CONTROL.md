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

## Customizing Agents, Skills & Workflows

BMad Manager aligns with the official [BMad Customization Specification](https://docs.bmad-method.org/customize/customize-bmad/) and [Team Adoption Recipes](https://docs.bmad-method.org/customize/adopt-bmad-across-a-team/).

### 1. Customizing an Agent

Every agent in BMad (Analyst, PM, UX, Architect, Dev, TEA, PO) is an agent skill. You can customize persona attributes without modifying vendor-installed files:

- **What you can customize:**
  - **Identity & Communication Style:** Name, role, title, emoji icon, and tone.
  - **Persona & Principles:** Directives the agent follows during conversations and operations.
  - **Persistent Facts:** Organization-wide context and rules (e.g. AWS vs GCP, compliance mandates, external library docs).
  - **Activation Hooks:** Pre-greeting setup (`activation_steps_prepend`) and post-greeting context loading (`activation_steps_append`).
  - **Menu Actions:** Custom menu entries that dispatch specific skills or prompts.
- **Scope Options:**
  - **Team Scope (`_bmad/custom/config.toml` or `_bmad/custom/<skill>.toml`):** Committed to Git so all developers inherit the rules.
  - **Personal Scope (`.user.toml`):** Gitignored for individual preferences, local tool paths, or private models.
- **In the UI:** Open the **Agents** tab, select **Customize** on any agent, adjust the fields, and click **Draft agent customization**.

### 2. Customizing & Cloning Skills

Vendor-installed skills in `.agents/skills/` are read-only and overwritten during updates. BMad Manager protects them by using a safe clone-and-override model:

- **Clone an Existing Skill:** Open the **Skills** tab, find an installed skill (e.g. `bmad-agent-dev` or `bmad-code-review`), and click **Clone**. This copies the instructions to a managed folder in `.agents/skills/<slug>/SKILL.md`.
- **Author a New Managed Skill:** Click **New managed skill** in the Skills tab, define the directory slug, display name, description, and markdown instructions.
- **Review & Apply:** Drafted skills appear in **Activity & approvals**. Once approved, `pnpm bmad:worker` writes the portable markdown skill files.

### 3. Assigning Skills to Agents

An agent dispatches a skill to perform its work. You can assign any installed, cloned, or newly created skill to an agent:

- **From Agent Customization:** In **Agents** → **Customize**, choose any available skill from the **Assigned Skill** dropdown.
- **From Skill Cloning:** When clicking **Clone** on a skill, select the agent to receive this skill copy in the **Assign to agent** dropdown.
- **When Creating a New Agent:** In **New managed agent**, either pick an existing skill or let BMad Manager auto-generate a matching skill in `.agents/skills/<slug>/`.
- **Under the Hood:** BMad Manager persists `skill = "<skill_name>"` inside the agent's table in `_bmad/custom/config.toml` (or `.user.toml`), linking the agent runtime to that skill.

### 4. Adding Agents to the Delivery Workflow

Once you have created or customized an agent, you can add it to the project delivery pipeline:

1. Go to the **Overview** (Workflow) tab.
2. In the **Add an agent to the workflow…** selector, choose your customized or custom agent.
3. Click **Add to pipeline** to append the agent to the active sequence.
4. **Visual Reordering:** Drag and drop the agent card using its grab handle or click the arrow buttons to position it in your ideal delivery pipeline (e.g. inserting a Security Reviewer between Developer and TEA Quality Advisor).
5. **Configurable Feedback Loops:** Click **Add custom loop** to route review findings, PO critic verdicts, or rework requests between any agents (e.g. Nella → John, or Murat → Amelia).
6. Click **Save Workflow Sequence & Loops**, review the draft in **Activity & approvals**, and approve. The worker updates `_bmad/custom/workflow.toml`.

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
