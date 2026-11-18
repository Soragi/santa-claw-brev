# Security policy — local GB10 deployment

Santa Claw’s primary target is a trusted private Linux ARM64 DGX Spark / GB10 workshop. Inference dispatch is local-only by default: cloud setup and cloud/unknown native routes are rejected. This is not an OS-level air-gap guarantee. Keep it on loopback or behind an authenticated reverse proxy. Set `SANTA_PUBLIC_ORIGIN` for a remote proxy. Do not deploy an unprotected public instance or mix untrusted attendees in one installation.

## Boundaries

- Host API: fixed loopback listener, explicit Host allowlist, same-origin JSON mutations, no CORS, rate/body limits and defensive response headers. The application has no separate user accounts; your OS account or authenticated proxy is the access boundary.
- Agent execution: native NemoClaw/OpenShell, with selected agent tools and a private installation’s sandbox. Workspaces/role instructions are not independent OS identities. A terminal-enabled agent has broader sandbox authority. Use separate installations/gateways for separate trust groups.
- Network approval: host-only mTLS SDK access to one configured loopback OpenShell gateway. First start backs up and removes external installation rules from the selected sandbox, preserving native local inference routes. Hostname-scoped HTTP grants require an attributed native denial, explicit operator approval and the rendered native review token. Changed candidates require fresh review. The application does not grant arbitrary host-level proposals. Policies are shared across this installation; separate Claws are not network tenants. All paths and query variations on an approved hostname/method/executable are allowed; subdomains and other hostnames require separate approval. Query values are hidden. See [operator guide](docs/openshell-village.md).
- Credentials: native OpenShell credential management and the pinned reviewed NVIDIA localhost form. The application never accepts inference keys in JSON, persists them in its database, exposes them to agents or includes them in exports. Keep SSH-forwarded form URLs private while setup is open. Finish/cancel setup before restarting the service.
- Local discovery: operator-configured loopback endpoints only, no arbitrary URL input, redirects rejected, bounded response/time. Local servers/weights must already exist. Native inference verification remains enabled.
- Artifacts: bounded allowlisted outputs; opened-file identity, hardlink, symlink and root checks; exclusive handoff writes. Common recognizable credential forms are rejected. This is defense in depth, not a guarantee that arbitrary user text is free of secrets.
- HTML previews: sandboxed iframe and opaque origin, inline scripts allowed, network/forms blocked. Downloads are attachments. Downloaded code runs with your local browser/process permissions; review it before running.
- Export: fresh sandbox/agent guards, integrity verification and no event UI or credential bundle. SHA-256 checksums detect corruption, not a trusted publisher. Read exported scripts before executing them.

## Report an issue

Do not put keys, tokens, reference knowledge or private workshop data in public issues. For a private repository, contact its owner through an existing private channel. If public vulnerability reporting is enabled later, use GitHub’s private vulnerability-reporting feature. The repository does not automatically enable that feature or promise a response SLA.

Native NemoClaw, OpenShell, model-server and OS security remain dependencies; this repository is not an audit or certification of those upstream systems.

- Post Office learning: owner-only binary review records and explicit Deploy Agent authorize autonomous **simulated** delivery after a real model check. Ten reviewed examples are prompt memory, not model weight training. Model tools cannot submit labels or deploy themselves. Source checks, duplicate protection, attempt capabilities, configuration fingerprints and the 700-arrival failure boundary remain enforced. Exports include reviewed examples but never the local sending grant or live tokens.

## Optional Bauble Factory

Factory MCP capabilities are scoped to an agent, role and attempt. Connected Hermes factory roles use only their scoped factory tools; terminal-enabled native runtimes still share the installation's sandbox and are not separate security tenants. Use one trusted team per installation. The operator-installed OpenShell connector rule permits only the private host bridge MCP endpoint, not general host API access. Reset revokes the attempt's capabilities and pending approvals.

Agent-authored CAD executes in bounded offline, nonroot Docker workers with a read-only root, dropped capabilities, no Docker socket or credentials, and private job directories. Printer profiles and slicer adapters are trusted organizer configuration. Only the paired Telegram owner may approve the exact inspected revision; changed geometry or printer configuration invalidates approval. Agents submit packages to a queue and cannot start physical printers. Upstream optional skills are references, not additional permissions or verified services.
