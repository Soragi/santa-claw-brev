# Workshop operations

## Health and service

`GET /santa/api/health` is a shallow liveness check. `GET /santa/api/ready` checks the database, local model and OpenShell and returns 503 when a dependency is unavailable. Run `npm run verify:gb10` for native readiness and a structured tool-call probe.

The generated user service is `santa-claw-gb10`. Inspect it with `systemctl --user status santa-claw-gb10`. Configuration lives in `~/.config/santa-claw-gb10/workshop.env`; the installer defaults data to `~/.local/share/santa-claw/data`. Keep the same `SANTA_DATA` directory across updates. See [installation](one-command-install.md) and [existing-host setup](gb10-setup.md).

## Updates

Wait for jobs and credential setup to finish before restarting the app. From the existing checkout:

```bash
git pull --ff-only
npm ci --ignore-scripts
npm test
npm run build
npm run verify:gb10
npm run service:reload
```

For a staged release from a separate checkout, `bash deploy/release.sh` previews operations and `--apply` builds, tests, backs up the configured database, syncs and performs an idle-checked restart. Set `SANTA_LIVE` and `SANTA_DATA` to the actual installation before using it. Do not use the fresh-device installer to update an existing service. Model and native gateway lifecycles are separate from the application service.

Back up SQLite with its backup API or a consistent `VACUUM INTO`; do not copy a live database without its WAL state. Protect backups as private data and keep them outside Git. The release helper retains three release directories and prunes old upgrade backups under its documented retention rules; inspect its dry run before applying.

## Agent jobs

Select Santa or an individual Claw to open a conversation. Work requests route through Santa; sessions and job traces persist locally. Browser builds save bounded source stages and verify startup. **Retry task** can resume saved stages; inspect the actual output and controls before accepting a game. Verification is bounded and cannot guarantee every requested behavior.

Network permissions are controlled by [OpenShell](openshell-village.md). Tool selection alone does not grant external access. Keep native dashboard authentication URLs and secure setup forms private.

## Between attendees

Challenge checkpoint reset restores its saved agent configuration for another attempt. **Settings → RESET ALL** clears all workshop progress and custom agents, while preserving the installed runtime. Check [reset behavior](reset-all.md) before using it. Exports remain available throughout the workshop; download anything attendees want to keep before resetting.

## Fresh redeployment

The Git repository contains source, lockfiles, model/native version pins, installers and factory worker code. It intentionally excludes village databases, challenge checkpoints, conversations, generated files, credentials and machine-specific services. A fresh deployment starts with an empty village; it does not restore a running machine snapshot.

Before removing an installation, confirm that the required source commit is on GitHub and that no edits exist only on that host. Authenticate to GitHub before cloning this private repository. Follow the GB10 [fresh-device installer](one-command-install.md) for a clean supported Spark, or the [portable launcher](portable-install.md) for an existing inference service. The optional factory worker needs `--factory` and a separately qualified private printer/slicer profile for submission.

Deleting the checkout alone does not uninstall native sandboxes, the model service, user services or launcher receipts. The installers refuse conflicting unowned installations. Stop the application using its owning service/launcher before removing its files; choose documented explicit reuse for an existing native sandbox rather than deleting unrelated services. Model/API credentials, Telegram pairing, HTTPS/Tailscale settings and printer qualification must be retained privately or configured again. They must never be committed to GitHub. Full fresh-device qualification still requires running the native and model checks on the target machine.
