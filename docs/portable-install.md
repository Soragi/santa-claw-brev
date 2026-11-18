# Portable one-command launcher

Run from a permanent checkout on Linux ARM64/x86_64 (GB10 or Brev), or an Apple Silicon Mac. The original `bash install.sh` remains the GB10 managed-model installer. This launcher attaches inference you already have; it does not download vLLM weights or install GPU drivers.

```bash
# NVIDIA-hosted model: exact model ID must support both tools and images.
./santa-claw up --provider build --model YOUR_MODEL_ID

# Existing host-local vLLM; no model server is created or stopped.
./santa-claw up --provider vllm --model YOUR_SERVED_MODEL_ID --vllm-port 8000
```

Without `--model`, an interactive run asks for it. Without `--provider`, NVIDIA-hosted inference is selected. Keys are entered through a hidden terminal prompt, passed only to native onboarding and never saved in launcher receipts or application exports. Unattended setup may supply `NVIDIA_INFERENCE_API_KEY` in its environment; do not put a key in command arguments, checked-in files or shell history. `--yes` accepts software/image downloads, not destructive replacement of existing systems.

Use `./santa-claw models` to list the current NVIDIA-hosted catalog before choosing a cloud model. Startup checks catalog membership before requesting credentials. A downloadable NIM can remain available after its free hosted endpoint is retired; a catalog listing can also lag retirement. The subsequent real inference probes must still pass. HTTP 410 from native endpoint validation means that route cannot qualify the deployment; select a current model instead of repeating the same request.

## Prerequisites

Python 3 and Git must be available. On macOS, install developer tools and start Docker Desktop or Colima first. Intel Macs are refused. On Linux, native installation may require administrator access for missing Docker/system dependencies. Host vLLM needs a working driver and its own suitable hardware; cloud inference does not require a local NVIDIA GPU. Docker must have enough CPU, RAM and disk for OpenShell image provisioning. Internet access and model/API entitlement are required.

Native gateway storage requires trusted home/config/state ancestors. The launcher removes group/world write access from the current user's relevant directories, preserves owner access, and refuses symlinks or unsafe ownership. On Linux with the native systemd user gateway, it verifies user lingering so the gateway survives SSH logout. It enables lingering for the current user when permitted, otherwise prints the exact administrator command. This does not register the Santa UI as a boot service.

One selected model must pass both structured-tool and actual-image probes. A text-only endpoint is not enough for the complete workshop. Remote custom vLLM endpoints, separate text/vision providers, automatically installing macOS Docker, system boot service registration and automatic public/Tailscale exposure are not included in this launcher. Use an existing host-local vLLM service or NVIDIA-hosted inference. Camera use across machines needs authenticated HTTPS; loopback is browser-secure by default.

## What starts

1. Inspect platform, port ownership and existing native installation.
2. Fetch the pinned NemoClaw commit in `config/installer.json`; use its installer to provision NemoClaw, OpenShell and an OpenClaw sandbox.
3. Install locked app dependencies, prepare the isolated browser image, and build the UI.
4. Require real sandbox execution, structured model tool calling and an image-color inference test through the managed route.
5. Start the host UI on loopback, wait for native OpenShell/model readiness, and print the actual native dashboard URL. Its allocated port is discovered, never assumed to be 18789.

OpenShell's manual/default-deny controls remain enforced. Explicit cloud mode changes inference selection, not task network permissions. Challenge Three displays whether selected crops are sent to a cloud provider. Inference follows the selected native connection: current sandbox-scoped NVIDIA and local providers use supervisor-issued opaque references; legacy managed routes use `inference.local`. Real API keys remain with the native provider. The guard preserves only the exact credential-bound NVIDIA model API policy; other external access still needs approval. A failed connection stops qualification.

## Manage and resume

```bash
./santa-claw up --plan --provider build --model YOUR_MODEL_ID
./santa-claw status
./santa-claw check
./santa-claw logs
./santa-claw stop
./santa-claw up
```

`--plan` makes no installation writes. Private receipts, data and logs live in `$XDG_STATE_HOME/santa-claw-portable` (default `~/.local/state/santa-claw-portable`). `stop` stops only the launcher-owned UI: it preserves agents, data, the native runtime and model service. Rerunning resumes from the owned receipt. Do not move the checkout after installation. UI updates use stop/up; dependency installation occurs on restart. The launcher does not register an OS boot service.

Native installation/onboarding diagnostics are kept in private `native-install.log` and `native-onboard.log` files beside the receipt. Known provider keys and authentication query tokens are redacted from those files. A deferred installation starts a new onboarding session; an interrupted one is resumed. Before any sandbox is registered, explicitly changing the selected model/provider starts a fresh native onboarding attempt. Other registered sandboxes are preserved.

Existing native installations are preserved and refused by default. Explicit adoption requires:

```bash
./santa-claw up --reuse-native --sandbox EXISTING_NAME --provider vllm --model EXISTING_MODEL
```

The named sandbox and model/provider must match. Adoption does not create, reconfigure or replace an unrelated sandbox. Use a separate machine/account for a genuinely fresh workshop. Saved UI progress is retained; new installs begin with fresh data. API/Telegram credentials and transcripts never ship in repository or agent packages.

## Qualification limits

The core Hermes workflow is validated on a Linux CPU Brev instance with NVIDIA-hosted Nemotron inference: native execution, an actual Hermes response, structured tool calls, image inference, agent creation/deployment, individual chat, game generation and feedback repair, native URL denial/approval/retrieval, and export/import. The production build and automated suite pass. This is not full event acceptance: all three complete challenges, live Telegram, cancellation/reset, and fresh-device redeployment must still be exercised on each event image. GB10 and Apple Silicon clean-machine qualification remain pending for this launcher. The SDK/native policy protocol stays pinned; newer native releases need compatibility testing.

References: [NemoClaw prerequisites](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/prerequisites), [native quickstart](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/quickstart).

## Choose OpenClaw or Hermes

The interactive first run asks which runtime to use. Scripted examples:

```bash
./santa-claw up --agent openclaw --provider build --model YOUR_MODEL_ID
./santa-claw up --agent hermes --provider build --model YOUR_MODEL_ID
```

The selected model must support both tools and images. `--agent hermes` uses a separate default sandbox (`santa-claw-hermes`) and state directory (`santa-claw-portable-hermes`). Keep passing `--agent hermes` for `status`, `logs`, `check` and `stop`. If another workshop uses port 4310, choose `--port 4311`. Existing OpenClaw sandboxes are never converted to Hermes or destroyed. Changing the runtime of a saved installation is refused.

Hermes qualification requires its installed Python SDK, actual agent response, sandbox filesystem checks, structured tool calling and image inference. Compatible native builds must include Node, `/opt/hermes/.venv/bin/python`, Hermes `AIAgent` with Chat Completions support, and a working native inference connection. The adapter checks these contracts and fails rather than falling back to unrestricted tools or another runtime.

Santa retains control of orchestration, challenge scoring and Telegram approvals. Individual Hermes workers have separate homes and histories under `/sandbox/.hermes/santa-claw`. The adapter filters model-visible tools and guards native dispatch: read-only workers cannot acquire write, terminal, browser, management or delegation tools. Terminal-enabled workers deliberately retain sandbox command capability; OpenShell remains the execution/network boundary. Untrusted content cannot approve network or Telegram requests. Library and custom skills are loaded as authored context. MCP simulation tools still enforce their server-side scopes.

Use Santa Claw for the workshop roster, individual chats and job traces. These application-owned SDK worker sessions are separate from the default native Hermes dashboard's session database. Native messaging/profile orchestration is not substituted for the workshop's approval bot. Hermes exports include native onboarding and authored-profile import helpers, plus explicit destination permission intent; owners must configure their own integrations and permissions. Export does not copy active authorizations.

**Validation:** The Linux CPU/cloud acceptance run created and deployed Hermes Claws, executed a real command, saved files, built a game, repaired it through user feedback, and verified real click/scoring/Restart behavior at desktop/mobile sizes. Native OpenShell blocked a URL, accepted owner approval and confirmed retrieval; subsequent work remained available. Export checks covered per-agent folders, SVG/JSON architecture, GLB/STL, checksums and credential exclusion. An exported profile was imported into native Hermes, an overwrite attempt was refused, and the temporary profile was removed. These checks supplement the simulated lifecycle/negative-permission regressions. Treat Hermes as experimental until the complete event qualification above passes on your hardware.
