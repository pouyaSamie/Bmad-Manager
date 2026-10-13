export function redact(value: string): string {
  return value
    .replace(
      /((?:api[_-]?key|access[_-]?token|authorization|cli_bridge_token)["']?\s*[:=]\s*["']?)[^"'\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(/Bearer\s+[a-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\b[A-Z]:[\\/][^\s"'<>]+/gi, "[path]")
    .replace(/\/(?:workspace|Users|home|tmp)\/[^\s"'<>]+/g, "[path]")
    .slice(-32000);
}
