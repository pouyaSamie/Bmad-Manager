const ERROR_MESSAGES: Record<string, string> = {
  DB_ERROR: "An error occurred. Please try again.",
  GITHUB_ERROR: "Unable to communicate with GitHub.",
  FS_ERROR: "Unable to read the file system.",
  LOCAL_DISABLED: "Local mode is not enabled on this server.",
  PATH_NOT_FOUND:
    "This path does not exist on the server. Local folders require a self-hosted deployment.",
  PATH_STALE: "This local folder no longer exists or has been moved.",
  REGISTRATION_DISABLED: "Registration is disabled on this server.",
};

export function sanitizeError(error: unknown, code: string): string {
  console.error(`[${code}]`, error);
  return ERROR_MESSAGES[code] ?? "An unexpected error occurred.";
}
