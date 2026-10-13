# CLI bridges in Docker

Run Codex and Antigravity in separate containers alongside BMad Manager. Windows-host CLIs are optional. Each bridge has its own persistent login volume and runtime secret, no published ports, and no project folder mounts. Both are for configuration test conversations; workflow execution remains deferred.

## Start the services

From the repository root:

```bash
pnpm cli:setup
docker compose --profile cli up -d --build codex-bridge agy-bridge
```

`cli:setup` creates random, separate tokens in `.secrets/codex-bridge-token` and `.secrets/agy-bridge-token`. It keeps existing tokens and does not print their values. These files are ignored by Git and excluded from Docker builds. Compose mounts them as secrets at runtime; they are not image build arguments or environment values.

To start only one provider, use `--profile codex` with `codex-bridge`, or `--profile agy` with `agy-bridge`.

The images use Node.js 22, Codex CLI 0.162.1, and AGY 1.3.4. The AGY download is verified against the SHA-512 checksum in Google's official release manifest. Linux amd64 and arm64 downloads are supported; account access depends on the provider.

## Sign in once inside each container

### Codex

```bash
docker compose --profile codex run --rm codex-bridge codex login --device-auth
```

Follow the displayed URL and device code in your browser. Device authentication must be enabled for your account. Check the saved login with:

```bash
docker compose --profile codex run --rm codex-bridge codex login status
```

The named `codex_login` volume persists the container profile. This login is independent of any Windows-host Codex login. See [Codex authentication](https://developers.openai.com/codex/auth).

### Antigravity

```bash
docker compose --profile agy run --rm -e SSH_CONNECTION="container-login" agy-bridge agy
```

AGY's remote login flow displays an authorization URL. Complete it in your browser and paste the returned code into the terminal. Exit the CLI when sign-in finishes. The named `agy_login` volume persists the container profile. See [Antigravity installation and authentication](https://www.antigravity.google/docs/cli/install/).

The container initializes a dedicated AGY settings file with deny rules for files, commands, MCP, and web tools. It preserves existing settings and login state in that volume. It does not change your host's AGY configuration. The bridge still refuses requests if it cannot verify the restrictions.

## Connect from BMad Manager

Open **Connections → Add connection**, choose the CLI provider, and select **Docker Compose service** under **Bridge location**.

| Provider | Endpoint | Bridge access token file |
| --- | --- | --- |
| Codex CLI | `http://codex-bridge:3006/v1` | `.secrets/codex-bridge-token` |
| Antigravity CLI | `http://agy-bridge:3005/v1` | `.secrets/agy-bridge-token` |

Paste the matching file's contents into **Bridge access token**, then select **Save and discover models**. Assign a discovered model to an agent and complete **Test chat** to verify model access. Container health means the bridge is running; it does not prove login or inference works.

These service addresses work from the web container on the same Compose network. A development web app running outside Docker should use a host bridge instead. Production deployments using another Compose file must add the bridge services to the web app's network.

## Maintenance and troubleshooting

```bash
docker compose --profile cli ps
docker compose --profile cli logs --tail 50 codex-bridge agy-bridge
docker compose --profile cli stop codex-bridge agy-bridge
```

With both services running, use `pnpm test:cli-containers` to check request authentication, filesystem isolation, AGY restrictions, and that bridge ports are not published. This check does not submit model prompts or verify your login.

- **Unauthorized:** verify the provider's token matches its private file. Rotating a token requires restarting that bridge and updating the connection credential.
- **Catalog unavailable:** verify container login, outbound internet access, and provider account access. A catalog is not a guarantee that every model is available to your account.
- **Download denied:** check access to the official npm and Google release endpoints; do not disable download checksum verification.
- **Login fails:** check the provider's account/device-login requirements and follow its remote authentication instructions. No login is supplied by the image.
- **Lost login after cleanup:** `docker compose down` preserves named volumes; `down -v` removes them along with the application's database volume. Do not use `down -v` just to restart a bridge.

Keep `.secrets/`, exported login files, and volume backups private. Never commit authentication state or publish a credential-bearing container. The bridge services run as a non-root user with a read-only image filesystem, dropped capabilities, and a writable temporary directory and dedicated profile volume.
