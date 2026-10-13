# Reliability and compatibility upgrade

Apply the new Prisma migration with pnpm prisma migrate deploy and regenerate the client before starting the updated application or worker. Restart the host bridges to enable their version/login diagnostics. No automatic project-file or credential conversion is performed.

## Agent settings

The inspector edits supported role, identity, communication style, principles, persistent facts, activation hooks, and menu actions independently. It writes only changed fields. Installed/team/personal layers remain distinct. Reset removes an override rather than copying a default into a file. Legacy Manager persona bindings stay visible in previews; their conversion is an explicit draft with file diffs.

Test chat is a configuration preview. File references, hooks, menu actions, and workflow skills are not executed. Provider history is bounded, current oversized messages are rejected rather than silently truncated, and a response needs a provider completion marker to succeed. History pages use message IDs and check both conversation and agent ownership.

## Repository worker

The worker executes serially and acquires a database lease keyed by the canonical physical workspace. Other workers cannot apply changes to that folder at the same time. The heartbeat expires after 60 seconds; interrupted operations become failed and remain quarantined. Stop the previous worker, inspect partial files, then use Release abandoned project lock in Settings. Create a fresh reviewed draft to retry; operations are never automatically replayed.

Draft previews include affected file contents and fingerprints. Approval and worker execution both check fingerprints. Changed files require a fresh draft. Uninstall and skill copying also fingerprint folder contents. Installer output and errors redact common credentials and host paths.

Local imports inspect existing folders and never create directories or run installation. Missing BMad produces a draft only. Installed folders skip installation forms; duplicates open their existing project.

## Supported installation profiles

Stable legacy installs use the pinned bmad-method@6.12.0 CLI with explicit noninteractive directory and action arguments. Updates preserve detected modules, tools, languages, paths, and remembered settings rather than substituting defaults. Unknown versions or incomplete profiles cannot be automatically updated.

V7 Skills CLI/plugin installs are detected through real bmod.toml records. Their module version may start with six; the installation method determines the profile. Use the official installed bmad setup or plugin update flow, then inspect/import the folder. Manager reads these capabilities and supported overrides but does not run setup agents, change installation generations, or execute autonomous work.

All four central TOML layers and all three skill customization layers are supported, including .cursor/skills. Artifact output uses the effective output_folder and active_initiative. TOML parsing handles UTF-8 BOMs and converts tables to plain objects for client serialization.

## Journeys and diagnostics

Overview provides a setup checklist. Workflows start empty until an agent or preset is selected. Nodes show effective model assignments. Unsaved model, persona, skill, and graph edits prompt before leaving. Library filters include initiative and document purpose and prioritize product/design artifacts over internal memory logs.

Connections retain separate catalog, authentication, and per-model conversation evidence with timestamps. Catalog access alone is not authentication. Diagnostics shows the worker heartbeat, host prerequisite versions, CLI bridge version/login/restrictions, and failures with next steps. Missing providers remain unverified.

Unit tests include actual upstream stable and preview schemas with pinned provenance under src/lib/__tests__/fixtures. The Docker journey covers read-only imports, histories, truncated/failed/cancelled streams, stale approvals, physical workspace locks, abandoned operation recovery, protected resources, and both themes at three widths. Mutations use isolated fixtures only.
