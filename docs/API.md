# API Reference

The application does not expose a general public project-management API. Its routes support health checks, cache invalidation, authenticated project file access, and the BMad Control chat interface.

## `GET /api/health`

Use this endpoint for Docker health checks, load balancers, and uptime monitors. It verifies the database connection.

| Status | Response |
|---|---|
| `200 OK` | `{ "status": "ok", "db": "connected" }` |
| `503 Service Unavailable` | `{ "status": "error", "db": "disconnected" }` |

## `POST /api/revalidate`

Invalidates one cached tag. Configure `REVALIDATE_SECRET` first, then send the matching value in `x-revalidate-secret`.

```bash
curl -X POST https://bmad-manager.example.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: your_secret_here" \
  -d '{"tag":"repo-owner-name"}'
```

The body must contain one non-empty `tag` string, up to 256 characters.

| Status | Meaning |
|---|---|
| `200 OK` | `{ "revalidated": true, "tag": "repo-owner-name" }` |
| `400 Bad Request` | Invalid JSON or request body. |
| `401 Unauthorized` | Missing or incorrect secret. |
| `429 Too Many Requests` | More than 30 authenticated requests in one minute. |
| `503 Service Unavailable` | `REVALIDATE_SECRET` is not configured. |

## `GET /api/repo/:owner/:repo/raw?path=...`

Returns one file from an imported project. This is an authenticated, private route: the current session must own the project. For GitHub projects, the server uses the owner’s saved GitHub token; for local projects, it reads the mounted local folder.

```text
/api/repo/acme/roadmap/raw?path=_bmad-output/planning-artifacts/prd.md
```

The `path` query parameter is required. Paths outside the local project are rejected. The route returns the file with an appropriate content type and a private five-minute cache header.

| Status | Meaning |
|---|---|
| `200 OK` | File contents. |
| `400 Bad Request` | Missing or invalid `path`. |
| `401 Unauthorized` | No valid session, or a GitHub token is required but unavailable. |
| `403 Forbidden` | Path traversal attempt. |
| `404 Not Found` | Project or file does not exist. |
| `500 Internal Server Error` | The file could not be read. |

## `POST /api/bmad/chat`

Streams an OpenAI-compatible chat response for one BMad Control agent. It requires an authenticated session, an owned local project, and a configured project or agent gateway. The response is server-sent events (SSE); the `x-bmad-conversation` response header identifies the saved conversation.

```json
{
  "owner": "local",
  "name": "my-project",
  "agentId": "agent-id-from-bmad-control",
  "message": "Review the current workflow and suggest its next quality gate."
}
```

`conversationId` is optional. Include it to continue an existing conversation. Messages are limited to 16,000 characters.

| Status | Meaning |
|---|---|
| `200 OK` | Streaming SSE response. |
| `400 Bad Request` | Invalid chat payload. |
| `401 Unauthorized` | No valid session. |
| `404 Not Found` | The owned local project or requested conversation was not found. |
| `409 Conflict` | No usable gateway or model is configured. |
| `502 Bad Gateway` | The configured gateway did not return a usable response. |

The Better Auth routes under `/api/auth/*` are consumed by the sign-in experience and are not a stable integration API.
