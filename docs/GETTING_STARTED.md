# Getting Started

Bmad Manager is a private dashboard for importing BMad projects, reading their planning and delivery artifacts, and following work from epics to stories. It supports GitHub repositories and BMad projects stored in a local folder. Local projects can also use [BMad Control](./BMAD_CONTROL.md) to manage agents, skills, gateways, and approved operations.

## Before you begin

- **Node.js 20.19+**
- **pnpm 11+**
- **Docker Desktop** for the included PostgreSQL service
- **GitHub OAuth App** (optional; only for GitHub sign-in)
- **GitHub Personal Access Token** (optional; recommended when importing several GitHub repositories)

## 1. Get the project

```bash
git clone https://github.com/pouyaSamie/Bmad-Manager.git
cd Bmad-Manager
pnpm install
```

## 2. Create your environment file

Copy the template, then set the values needed for your installation:

```bash
cp .env.example .env
```

On macOS, Linux, or Git Bash, `bash scripts/setup.sh` can generate the authentication and revalidation secrets for you. The script uses port 3000, so change `BETTER_AUTH_URL` back to `http://localhost:3002` when using the development server.

For a standard local setup, use these values in `.env`:

```dotenv
DATABASE_URL=postgresql://bmad:bmad_dev_password@localhost:5433/bmad_dashboard
BETTER_AUTH_SECRET=replace-with-a-long-random-value
BETTER_AUTH_URL=http://localhost:3002
ALLOW_REGISTRATION=true
ENABLE_LOCAL_FS=true
```

Generate a secret with either of these commands:

```bash
openssl rand -base64 32
```

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`REVALIDATE_SECRET` is optional unless you use the cache-revalidation endpoint described in [API.md](./API.md). `AGENT_ENCRYPTION_KEY` is required only for BMad Control gateway API keys; see [BMad Control](./BMAD_CONTROL.md).

## 3. Start PostgreSQL

The Compose file contains both the application and PostgreSQL. For local development, start only the database:

```bash
docker compose up -d postgres
```

It is available on port `5433`, so it does not conflict with a PostgreSQL installation that uses the default port.

## 4. Prepare the database and start the app

```bash
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002).

## 5. Create an account

With `ALLOW_REGISTRATION=true`, create an email/password account from the sign-up page. After the first account is created, set it to `false` and restart the app if you do not want further self-registration.

Alternatively, create an account from the command line:

```bash
pnpm db:create-admin --email admin@example.com --password your_password --name Admin
```

## 6. Add your first project

1. Select **Add a project** on the dashboard.
2. Choose **GitHub** to import a repository, or **Local Folder** to import a directory on this machine.
3. For a local project, choose a folder containing `_bmad/` or `_bmad-output/`.
4. Open the project to explore its overview, epics, story-delivery board, documents, and activity.

For Docker-based local imports and Windows path mapping, continue with [Local Folder Import](./LOCAL_FOLDER.md). To configure BMad agents and an AI gateway, continue with [BMad Control](./BMAD_CONTROL.md).

## GitHub setup (optional)

To enable **Login with GitHub**, create an OAuth App at [GitHub Developer Settings](https://github.com/settings/developers) with:

| Setting | Local development value |
|---|---|
| Homepage URL | `http://localhost:3002` |
| Authorization callback URL | `http://localhost:3002/api/auth/callback/github` |

Copy its values into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. A `GITHUB_PAT` is optional, but raises GitHub API capacity from 60 to 5,000 requests per hour.

## Environment reference

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | Every installation | The included PostgreSQL defaults are shown above. |
| `BETTER_AUTH_SECRET` | Every installation | A long, random secret used to sign sessions. |
| `BETTER_AUTH_URL` | Every installation | `http://localhost:3002` for `pnpm dev`. |
| `ALLOW_REGISTRATION` | Initial account creation | Set `true` only while self-registration should be available. |
| `ENABLE_LOCAL_FS` | Local folder import | Set to `true` to expose the Local Folder option. |
| `LOCAL_WORKSPACE_PATH` | Docker local imports | Container path where the host workspace is mounted; defaults to `/workspace`. |
| `LOCAL_HOST_WORKSPACE` | Docker local imports | Matching host path; defaults to `C:/workspace`. |
| `AGENT_ENCRYPTION_KEY` | BMad Control gateways | Stable base64url key for encrypting stored gateway keys. |
| `REVALIDATE_SECRET` | `POST /api/revalidate` | Shared secret for cache invalidation. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub sign-in | OAuth App credentials. |
| `GITHUB_PAT` | Higher GitHub API limits | Needed for private imports and recommended for frequent imports. |

## Next steps

- [Local Folder Import](./LOCAL_FOLDER.md)
- [BMad Control](./BMAD_CONTROL.md)
- [API reference](./API.md)
