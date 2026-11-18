# OpenShell village control room

Santa Claw uses the official pinned NVIDIA OpenShell SDK 0.0.116 with a local mTLS gateway. This panel exposes selected native decisions in the village; `openshell term` remains the full native terminal dashboard. No browser receives gateway keys or arbitrary SDK access.

## First start

Use a dedicated sandbox for this workshop. `npm start` and the user service enable the network guard. Set `SANTA_SANDBOX` to that sandbox and, if necessary, `SANTA_OPENSHELL_GATEWAY` to its locally configured gateway name (default `nemoclaw`). The gateway metadata and client certificates must already exist under the operator's OpenShell configuration directory.

On first activation for a sandbox ID, the guard saves a mode-0600 network-policy backup under the private application data directory. It removes external bootstrap/package-install rules, preserves local inference and control-plane routes, and enables `agent_policy_proposals_enabled` with `proposal_approval_mode=manual` at sandbox scope. Filesystem rules, model processes and global settings are unchanged. Existing unrestricted package downloads will therefore need explicit native policy review. Do not run this migration against an unrelated shared sandbox.

Subsequent checks refuse new work when manual mode or the expected approved hostname rules cannot be verified. Loss of telemetry displays unavailable; it never manufactures successful requests. Native OpenShell remains the enforcement boundary.

## Try it

1. Equip a Claw with terminal/file tools, complete its Workshop test, then deploy it.
2. In the village, ask Santa: “Use curl to retrieve https://example.com/, save the actual HTTP status and a short response excerpt as external-proof.md. If blocked, return immediately and request operator approval.”
3. Its actual denied attempt creates a narrow draft and a Christmas barrier above the Claw. Click the URL label or **Open control room**.
4. Review method, hostname, all-path scope (`/**`), executable, native candidate and prover notes. Approval covers all paths and query values on that hostname for that method/program. A candidate is reviewable as soon as native preparation finishes, even while the agent is working. Unexpected changes still require a fresh review.
5. Santa waits outside the model turn for up to 15 minutes. On approval it waits for native policy reload before asking the agent to retry. A native HTTP allowance produces the animated snow globe; a matched HTTP response receipt produces Retrieved. An upstream error is shown separately.
6. Inspect the actual saved file and native activity. **Approved links → Revoke** removes the native grant; enforcement follows native policy reload, not the button animation. Stop cancels the application wait, without granting access.

## Scope and honest limits

- The village approves all paths on one public HTTP(S) hostname on port 80 or 443 for one HTTP method and executable. Nested paths and query variations reuse the approval. Redirects to another hostname, subdomains, different ports, methods or executables require their own grants.
- Query values are removed from UI/event persistence. Approval does **not** constrain query strings: different query values on the approved hostname/method may be allowed. Avoid sensitive URLs and use native policies when more constraints are needed.
- Other protocols, private/IP targets, custom ports, Telegram/WebSocket connections, package installers and broad host rules need operator review in the native terminal. They remain subject to OpenShell, but may appear only as unattributed sandbox activity rather than an exact-link village request. Enabling a tool checkbox does not open the network.
- All Claws share this installation's sandbox policy. A grant for an executable/hostname can be used by other Claws using that executable. The UI's attribution is an observation aid, not per-agent kernel isolation. Separate trust groups need separate installations/sandboxes.
- The observer correlates actual OpenClaw tool intents/session timestamps with native OpenShell network decisions. Ambiguous sessions and unrelated background traffic stay unattributed. Local inference/control-plane traffic does not trigger globes. Polling is approximately 1.5 seconds; very busy/truncated native logs can limit coverage.
- HTTP allowance proves admission. Retrieved additionally uses a tool HTTP-status receipt; it does not prove that the model understood the response. The observer does not persist raw tool commands, response bodies, credentials or URL queries.
- The globe/barrier follows the Claw in 3D and supports reduced motion and Pause. Recent completed events fade; pending blocks remain visible while awaiting review.
- Hostname scopes, drafts and native review decisions belong to this installation. Take-home archives contain no village policies, gateway mTLS material or callback; the destination OpenClaw/OpenShell operator controls network access there.

## Native dashboard and recovery

Run `openshell term` on the Spark (or `openshell -g YOUR_GATEWAY term` for another gateway). The panel also provides the command. Review broader policies there deliberately; a broad native grant makes the village guard refuse new work until the expected constrained posture is restored.

OpenShell 0.0.116 can supersede an agent-authored draft with a mechanistic endpoint draft. Santa Claw follows the explicit replacement reference, narrows only a pending host-level draft, and requires review of the resulting native candidate. Replacement cycles requeue a bounded fresh request; human rejection is preserved. Failure to prepare/load a narrow grant stops the retry rather than allowing access.

For unavailable telemetry, check the selected sandbox, local gateway/mTLS configuration and native versions. Do not disable TLS verification or paste private keys into the UI. `SANTA_NETWORK_GUARD=0` exists only for directly launched simulated development fixtures; production launchers force the guard on.

Upstream references: [policy advisor](https://docs.nvidia.com/openshell/v0.0.116/sandboxes/policy-advisor), [policy schema](https://docs.nvidia.com/openshell/v0.0.116/reference/policy-schema), [vendored SDK provenance](../vendor/README.md).

## Workshop gate exercise

The same native control room is available inside Santa’s 3D workroom. Test flight includes **A tiny trip outside**: a real model/terminal mission that fetches a public HTTP(S) URL and saves `network-check.md`. It deliberately keeps the room visible instead of opening the mission drawer over the gate. Live receipts remain available separately. The closed-gate gift animation follows blocked activity; approval opens the gate, while packet passage/globe requires actual native HTTP admission. The response label still distinguishes upstream errors from successful response receipts. A previously approved hostname/method can pass immediately; the app does not silently revoke existing permissions to stage a demonstration.

The exercise URL field rejects credentials, query/fragment values, IP/internal targets, unsupported ports and wildcard paths. Native enforcement and all shared-sandbox limitations above still apply. Standard sandbox read/write/runtime checks remain a separate action; a gate exercise is not a substitute for validating your own use case and reviewing its output.

Domain review becomes available as soon as the native draft is ready, without waiting for the blocked model turn to finish. Existing compatible native drafts are reused. SDK submission is preferred when supported; the native policy advisor is the compatibility fallback. Stale unrelated edits still require another review. Intentional conversion of a displayed legacy exact-path candidate to its documented hostname scope is verified against the expected rule before native approval.

Mutating HTTP methods display an explicit warning: the grant permits any body/query for that hostname/method/executable in this shared sandbox and can change external state. Native-approved concrete advanced rules remain authoritative only while the effective rule matches the reviewed content. The panel cannot approve those broader drafts.

Stopping a waiting mission withdraws its pending requests and rejects still-pending native drafts. Approved shared grants remain until explicitly revoked. Results include authoritative native approval/HTTP receipts; speculative model summaries cannot replace those receipts.
