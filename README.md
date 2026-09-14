# Bmad Manager

> A self-hosted command center for [BMad](https://github.com/bmad-method/bmad-method) projects—turning planning files into a clear view of delivery, progress, and controlled project operations.

BMad Manager is for teams using BMad who want to spend less time opening Markdown and YAML files to answer basic questions: *What are we building? What is in progress? What is blocked? What should happen next?* Connect a GitHub repository or a local BMad folder and get one shared workspace for epics, stories, sprint progress, documentation, and carefully reviewed operations.

## What it helps you do

- **See the whole portfolio:** compare project health, completed work, active work, and story counts from one dashboard.
- **Keep delivery understandable:** move from an epic to its stories and their current state without manually reconciling planning artifacts.
- **Find the source material quickly:** browse project planning and implementation files beside the delivery view.
- **Operate local projects carefully:** use BMad Control to inspect agents and skills, preview changes, and send only approved work to a separate worker.

## See it in action

### Start with a portfolio view

The dashboard is the fastest answer to “what is happening across our BMad projects?” It shows active projects, total epics and stories, completed work, and current work in progress before you drill into an individual project.

![Bmad Manager portfolio dashboard](./docs/screen1.png)

### Understand one project at a glance

Open a project to see its sprint progress, velocity, blockers, key planning files, and epic status in one view. This is the page to use during a stand-up or delivery review.

![Atlas Platform project overview](./docs/screen2.png)

### Follow work from epic to outcome

The epic timeline makes progress visible across the plan: completed epics, active epics, and work that has not started yet. Each epic links directly to its work items.

![Epic delivery timeline](./docs/screen3.png)

### Spot delivery flow on the story board

Use the story board to see which work is ready, active, blocked, or complete. Filters let a team focus on a specific epic when planning the next move.

![Story delivery board](./docs/screen4.png)

### Keep planning files close to the work

The library provides a safe in-app browser for BMad planning and implementation artifacts, so you can read the source documents without losing the delivery context.

![Project documentation library](./docs/screen5.png)

### Use BMad Control for reviewed local operations

BMad Control is for local projects that need a deliberate operating surface. It brings agents, skills, workflow stages, model routes, conversations, and the approval queue together; the web app previews and queues approved operations while a separate worker performs them.

![BMad Control workspace](./docs/screen6.png)

## Key capabilities

- Import BMad projects from GitHub or, in self-hosted environments, directly from local folders.
- Track epics, stories, sprint status, velocity, and supporting planning documents.
- Read both a single `epics.md` file and split epic files in an `epics/` directory.
- Manage repository branches and access with email/password or optional GitHub OAuth.
- Run multi-user installations with roles, Docker, PostgreSQL, and Traefik.

## Stack

| Area | Technology |
| --- | --- |
| Application | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui |
| Data | PostgreSQL, Prisma |
| Authentication | Better Auth |
| Repository access | GitHub API via Octokit |
| Testing | Vitest |
| Deployment | Docker and Traefik |

## Get started

### Use your own project locally

**Requirements:** Node.js 20+, pnpm 10+, Docker, and Docker Compose.

```bash
git clone https://github.com/pouyaSamie/Bmad-Manager.git
cd Bmad-Manager
pnpm install

# Copy .env.example to .env and fill in the required values.
docker compose up -d
pnpm db:migrate
pnpm db:create-admin --email you@example.com --password your-password --name Admin
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002), sign in, then add a GitHub repository or local BMad folder. For environment variables and detailed setup, read [Getting Started](./docs/GETTING_STARTED.md).

## How to use Bmad Manager

### 1. Add a BMad project

Select **Add project** in the sidebar. Import a GitHub repository if your BMad artifacts are stored remotely, or choose a local folder in a self-hosted installation. For a local project, the folder must contain `_bmad/` or `_bmad-output/`.

### 2. Start each review from the dashboard

Use the dashboard to see every imported project’s delivery state. The summary cards show project count, epics, stories, completed work, and work in progress; select a project card to investigate it.

### 3. Review delivery at the right level

- **Overview** is the project health page: sprint progress, velocity, blockers, key files, and epic status.
- **Epics** shows the plan in sequence, from completed work to upcoming outcomes.
- **Stories** provides a board or backlog view. Filter by epic when planning the next delivery slice.

### 4. Read the source artifacts without leaving the workspace

Open **Library** to browse the BMad planning and implementation files behind the dashboard. The library is read-only, so it is safe to use for review and discovery.

### 5. Use BMad Control only for deliberate local-project changes

For a local project, open **BMad Control** to inspect the BMad agent workflow, skills, and feedback loops. Draft an operation to see its preview, approve it after review, and run `pnpm bmad:worker` separately to process approved work. The web app never executes queued operations directly.

### Run the BMad Control worker

BMad Control is available for imported local projects. It uses encrypted gateway credentials and a dedicated worker, so the web application does not execute queued operations itself.

Add a stable 32-byte base64url `AGENT_ENCRYPTION_KEY` to `.env`, then run the application and worker in separate terminals:

```bash
pnpm dev
pnpm bmad:worker
```

Operations are previewed before approval, limited to allowlisted project actions, and recorded with redacted output. Read the [BMad Control guide](./docs/BMAD_CONTROL.md) before enabling it.

## Development commands

```bash
pnpm dev              # Start the development server on port 3002
pnpm build            # Create a production build
pnpm start            # Run the production server
pnpm lint             # Run ESLint
pnpm test             # Run the Vitest suite
pnpm test:watch       # Run Vitest in watch mode
pnpm db:generate      # Generate the Prisma client
pnpm db:migrate       # Create and apply a development migration
pnpm db:push          # Push the schema without creating a migration
pnpm db:studio        # Open Prisma Studio
pnpm db:create-admin  # Create an administrator account
pnpm bmad:worker      # Process approved BMad Control operations
```

## BMad project conventions

Bmad Manager supports numeric and alphanumeric epic identifiers.

| Artifact | Example | Detected ID |
| --- | --- | --- |
| Epic heading | `## Epic 1: Foundation` | `1` |
| Epic heading | `## Epic DevOps/Infra: Pipeline` | `devops-infra` |
| Epic file | `planning-artifacts/epics/epic-housekeeping.md` | `housekeeping` |
| Story file | `implementation-artifacts/1-2-setup.md` | `1.2` |
| Story file | `implementation-artifacts/DI-1-pipeline.md` | `di.1` |

For alphanumeric epic headings, use the `Epic` keyword so ordinary headings are not mistakenly treated as epics.

## Deploying

The included production setup runs the application, PostgreSQL, and Traefik with automatic TLS. Follow the [production deployment guide](./docker/DEPLOY.md) for the required environment variables and commands.

## Documentation

- [Getting Started](./docs/GETTING_STARTED.md) — local setup and configuration
- [Local Folder Import](./docs/LOCAL_FOLDER.md) — importing projects from the filesystem
- [BMad Control](./docs/BMAD_CONTROL.md) — controlled local-project operations
- [API Reference](./docs/API.md) — health and cache-revalidation endpoints

## License

Distributed under the [MIT License](./LICENSE).
