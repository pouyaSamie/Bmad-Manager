# Local Folder Import

When self-hosting MyBMAD on the same machine where your BMAD projects live, you can import them directly from the filesystem — no GitHub needed.

## Enabling

Set the following in your `.env`:

```
ENABLE_LOCAL_FS=true
```

Restart the dev server after changing this value.

## How it works

1. Click **"Add a project"** in the dashboard
2. A **"Local Folder"** tab appears alongside the GitHub tab
3. Enter the **absolute path** to your project folder (e.g. `/home/user/my-project`)
4. The system validates that the folder contains a `_bmad/` or `_bmad-output/` directory
5. The project is imported and appears in your dashboard just like a GitHub repo

Once imported, you can browse epics, stories, and docs exactly as you would with a GitHub project. Use the **Refresh** action to re-scan the folder when files change.

## Security

The local provider includes multiple safety guards:
- **Path traversal protection** — rejects `..`, null bytes, and special characters
- **No symlink access** — symbolic links are skipped at every level
- **File size limit** — 10 MB per file (prevents memory exhaustion)
- **File count limit** — 10,000 files max per project
- **Depth limit** — 20 directory levels max

## Limitations

- Only works when the Next.js server runs on the **same machine** as the project files
- No branch/version support — local folders are a live snapshot
- If you move or rename the folder, you need to re-import it
