# Local Folder Import

Local Folder Import lets a self-hosted Bmad Manager read BMad artifacts directly from a project on the same machine. It is the required project type for [BMad Control](./BMAD_CONTROL.md).

## Enable it

Set this in `.env`, then restart the application:

```dotenv
ENABLE_LOCAL_FS=true
```

Select **Add a project** on the dashboard, open **Local Folder**, and choose or enter a project folder. If the folder already contains `_bmad/` or `_bmad-output/`, it is imported immediately. If BMAD is not yet installed, BMad Manager prompts you with a zero-typing graphical installation wizard to configure and install BMAD non-interactively. After import, use **Refresh** when its files change.

## Running the app directly on your machine

Enter an absolute path the server can read:

| System | Example |
|---|---|
| Windows | `C:\workspace\my-project` |
| macOS / Linux | `/Users/you/workspace/my-project` or `/home/you/workspace/my-project` |

The server reads the folder as it exists at that path. Moving or renaming it means importing the folder again.

## Running the app in Docker

The container cannot see host folders unless they are mounted. The included Compose file maps `C:/workspace` on Windows to `/workspace` in the container and sets the matching defaults:

```dotenv
LOCAL_WORKSPACE_PATH=/workspace
LOCAL_HOST_WORKSPACE=C:/workspace
```

Place local projects beneath `C:\workspace`, then select one from the local-folder picker. Bmad Manager maps the displayed Windows path to its mounted container path.

For another host directory, update all three values consistently in your Compose configuration:

```yaml
services:
  web:
    environment:
      LOCAL_WORKSPACE_PATH: /workspace
      LOCAL_HOST_WORKSPACE: C:/your/projects
    volumes:
      - C:/your/projects:/workspace:ro
```

Use a read-only mount (`:ro`) when you only need dashboards and document browsing. BMad Control needs a writable mount because approved operations can write project customizations, agents, and skills.

## What Bmad Manager reads

The local content provider limits artifact discovery and reading to `_bmad/`, `_bmad-output/`, and any valid custom BMad output directory declared by the project. This keeps unrelated project source code out of the dashboard browser.

## Safety limits

- Paths are jailed inside the imported project; traversal and null bytes are rejected.
- Symbolic links are skipped.
- Only BMad directories can be read by the content provider.
- Files larger than 10 MB are not read.
- Scans stop after 10,000 files or 20 nested directory levels.

## Limits to keep in mind

- The application must run on the same host as the folder, or have that folder mounted into its container.
- Local folders are live files, not Git branches or versioned snapshots.
- BMad Control is available only to the account that imported the local project.
