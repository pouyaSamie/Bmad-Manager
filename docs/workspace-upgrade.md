# Workspace upgrade

Run production schema migrations with `pnpm prisma migrate deploy`, regenerate the client, and run `pnpm db:migrate-workspace` once to preserve existing routes and convert workflow designs. The conversion is idempotent and does not modify project folders. Legacy connections remain unverified until catalog discovery and a test conversation succeed.

## Host CLI bridges

For bridges running entirely in Docker, see [Docker CLI setup](cli-bridges.md). Host bridges remain available for local development.

Set a random `CLI_BRIDGE_TOKEN` of at least 32 characters in the host environment. Run `pnpm codex:gateway` or `pnpm agy:gateway` on the logged-in host. Add that token as the connection's bridge access token. The default binding is loopback; Docker users can explicitly set `CLI_BRIDGE_HOST=0.0.0.0` and firewall access to the local Docker host. Never expose a bridge to the public internet.

Codex uses the signed-in account through app-server, an ephemeral thread, read-only sandbox, disabled shell/patch features, disabled configured MCP servers, and rejected approval/tool requests. `CODEX_BIN` can point to a native executable.

AGY refuses to start a test request unless `~/.gemini/antigravity-cli/settings.json` has these explicit `permissions.deny` entries: `read_file(*)`, `write_file(*)`, `command(*)`, `unsandboxed(*)`, `mcp(*)`, `read_url(*)`, `execute_url(*)`. This intentionally restricts the CLI session; use a dedicated host profile if you also use AGY interactively. The app never changes global permission settings. `AGY_BIN` can point to the installed native executable.

Both bridges authenticate every request, reject browser-origin requests, run outside project repositories, enforce request size/time limits, and terminate child processes on disconnect. Model catalogs come from the actual CLI. Missing login, binaries, restrictions, or tokens are reported as unavailable.

## Worker

Continue to run `pnpm bmad:worker` independently. Installation, customization, skill copies, workflow files, and full uninstall require draft review and approval. Import and dashboard unlink do not write project folders.

Work management, ticket creation, delivery execution, and releases are deferred.
