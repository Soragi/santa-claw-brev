# RESET ALL — start a fresh Santa Claw workshop

Open **Settings** at the bottom of the left menu. Choose **RESET ALL**, read the deletion summary, then type `RESET ALL` exactly and confirm. The confirmation can be cancelled without changing workshop data.

The reset stops queued and active application jobs and revokes challenge access before removing custom native agents. It clears custom designs, hidden/exported/deleted local project records, workshop chat sessions, job traces, saved outputs, checks, qualifications, challenge history, assessments, MCP quiz selections, checkpoint snapshots, approval callbacks and dedicated Post Office approval-bot pairing. Native custom Claws and their workspaces are removed from the reserved `sc-*` workshop namespace. Santa’s application-owned helper workspace files are cleared and the default coordinator profiles are reapplied. The village returns to its default scenery with only Santa as its visible agent and chat contact. New challenges start with the current rules.

OpenShell pending proposals are rejected, approved proposals are revoked and external workshop URL permissions are removed. Local inference and policy transport rules remain available. Old network events and proposal history are excluded from the fresh UI, including after reconnecting.

The installed vLLM/Ollama model, NemoClaw/OpenShell services, provider credentials and native channel connection data are preserved. Native profiles outside the workshop namespace, external installations, downloaded exports and messages already sent outside this simulation are not erased. This is an installation workshop reset, not a device wipe or secure erasure of storage.

Before cleanup, the app creates `data/reset-backups/RESET_ID.sqlite` under the private data directory (directory mode 0700, file mode 0600). That recovery copy is not an active checkpoint and cannot be restored through challenge reset. Protect backups as private data.

Progress appears in Settings and survives page reconnection. The app blocks new workshop writes while resetting. If a native deletion, job cancellation or network-policy operation fails, the reset remains locked with its stopped phase and a retry control. Native cleanup is idempotent; retry resumes with the original private backup. A process interrupted mid-reset returns to this retry state rather than silently declaring completion. Pairing/agent database leases may require native operator maintenance before retrying. Avoid manually clearing the workshop database while cleanup is incomplete.

The API uses `POST /santa/api/installation/reset` with `{"confirm":"RESET ALL"}` and returns 202 plus the reset job status. `GET` on the same path reports progress. It retains the installation’s loopback/Host, JSON content-type and same-origin protections. The model has no reset tool or approval authority.
