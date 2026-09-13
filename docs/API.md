# API Endpoints

## POST `/api/revalidate`

Triggers cache revalidation for a specific tag. Requires authentication via the `x-revalidate-secret` header.

**Headers:**
- `x-revalidate-secret` (required): Must match the `REVALIDATE_SECRET` environment variable

**Body (JSON):**
```json
{ "tag": "repo-owner-name" }
```

**Example:**
```bash
curl -X POST https://mybmad.example.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: your_secret_here" \
  -d '{"tag": "repo-owner-name"}'
```

**Responses:**
- `200 OK` — `{ "revalidated": true, "now": <timestamp> }`
- `401 Unauthorized` — Invalid or missing secret
- `503 Service Unavailable` — Revalidation is disabled (no secret configured)

## GET `/api/health`

Health check endpoint for monitoring and load balancers.

**Responses:**
- `200 OK` — `{ "status": "ok" }`
- `503 Service Unavailable` — `{ "status": "error" }`
