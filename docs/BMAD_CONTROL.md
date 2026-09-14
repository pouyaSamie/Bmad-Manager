# BMad Control

Bmad Manager can manage BMad for imported **local** projects. Open a project and select **BMad Control** to scan its installed agents and skills.

## Required runtime setup

Add a stable 32-byte base64url value to `AGENT_ENCRYPTION_KEY`. Bmad Manager uses it to encrypt each project gateway API key in PostgreSQL. Do not rotate it without first re-encrypting stored keys.

Run the web app and approved-operation worker separately during development:

```bash
pnpm dev
pnpm bmad:worker
```

## Safe operation flow

1. Configure the OpenAI-compatible gateway endpoint, model, and API key in the project control page.
2. Scan the project to discover `_bmad/config.toml` agents and `.agents/skills` skills.
3. Draft an install, update, override, managed-skill, or managed-agent operation.
4. Inspect the command/file preview and approve it.
5. The worker processes only queued, allowlisted project operations and records redacted output.

Installer-owned files such as `_bmad/config.toml` and `customize.toml` remain read-only. Team customizations belong in `_bmad/custom/*.toml`; personal customizations use the `.user.toml` layer.