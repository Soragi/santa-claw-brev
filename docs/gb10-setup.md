# DGX Spark GB10 installation and operations

The supported production target is Linux ARM64 on GB10 with local inference. This guide assumes a trusted private workshop on one Spark; it does not turn the shared sandbox into multi-tenant hosting.

## Host and native prerequisites

- DGX Spark / GB10, compute capability 12.1; the baseline profile is a 128 GB-class device. Unified memory is shared with the OS, containers, application and model/KV cache. GPU `memory.total` can be unavailable; use host memory information and real load tests.
- Node.js 22.19+ and working Docker access. App preparation uses `npm ci --ignore-scripts` and builds ARM64 dependencies on the device.
- NemoClaw 0.0.137+ with JSON inventory, sandbox `exec` and native `inference set`; OpenShell 0.0.116+. These are the minimum reference toolchain versions used by this app, not a demand to upgrade a shared system without planning.
- A healthy local vLLM model with structured tool calling. Use the pinned [GB10 model guide](vllm-setup.md), or a native managed serving profile qualified for your device.

Start with `npm run check:gb10`. Before a sandbox exists, inspect the host/server stages directly:

```bash
node deploy/check-gb10.mjs --stage host
node deploy/check-gb10.mjs --stage server --smoke
```

The checker is read-only. Failed native prerequisites remain failed even when hardware/model checks succeed. The model smoke probe requests a function call; it does not execute a command or create an agent.

Use the maintained installer rather than assuming the reference CLI is published as an npm package. For fresh native installation, follow the [official NVIDIA Spark playbook](https://build.nvidia.com/spark/nemoclaw/instructions). Keep the native gateway under NemoClaw’s lifecycle. Do not manually replace system binaries, register a new global gateway over another workshop, or stop another project’s model just to make a check green.

For a gateway upgraded from an older installation, inspect its native provider-composition setting before onboarding:

```bash
openshell settings get -g nemoclaw --global
```

Native local inference in the pinned reference release requires `providers_v2_enabled=true`. After reviewing the gateway’s existing providers and backing up its state, its operator can enable this with:

```bash
openshell settings set -g nemoclaw --global --key providers_v2_enabled --value true --yes
```

Use the actual gateway name if it differs. This changes gateway-wide behavior; do it as an explicit migration step. If an interrupted onboarding reports a missing recorded local-provider attachment, follow the native CLI’s supported recreation procedure for that sandbox. A resumed session that skips an incomplete inference step is not evidence of a working route.

When a system-installed legacy CLI coexists with a user-local upgrade, confirm resolution before running these commands:

```bash
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
command -v nemoclaw
nemoclaw --version
openshell --version
```

The service installer preserves the selected native tool directories ahead of older system binaries, validates the generated systemd unit and waits for the app’s local HTTP health endpoint. A successful install message requires that endpoint to respond in local-only GB10 mode.

An older `nemoclaw help` showing only `connect`, `status` and legacy setup commands cannot run this adapter. Back up and schedule its supported upgrade, or provision a separate qualified native environment. A successful `nvidia-smi` or `/v1/models` response does not fix that incompatibility.

## Existing models and sandboxes

Do not start another model when port 8000 is occupied. Verify its identity and tools, then set the actual served ID:

```bash
export SANTA_LOCAL_MODEL=nvidia/Qwen3.6-35B-A3B-NVFP4
export SANTA_SANDBOX=your-existing-local-sandbox
npm run verify:gb10
```

That model ID is an example of an existing server that uses the repository name; a new reference launch serves `santa-qwen` instead. Discovery must match the selected sandbox’s recorded model. The app reads the named sandbox’s provider/model; cloud-backed or unknown routes are rejected in local-only mode.

For a fresh sandbox, use `npm run onboard:gb10` with a fresh `SANTA_SANDBOX`. It invokes local-vLLM onboarding and refuses an existing name. Native setup may download sandbox images. Model installation/download is a separate explicit step, not something ordinary app startup does.

Keep vLLM local. The packaged launcher binds `127.0.0.1`; a native managed profile may additionally use an authenticated private OpenShell bridge binding. An existing wildcard listener is not evidence of safe exposure. Inspect its authentication/firewall and ownership before any change, especially when another workshop uses it.

## Service and data

`npm start` runs the full GB10 preflight, chooses the configured registered sandbox, then launches the loopback app. `npm run service:install` verifies readiness and generates a user unit and owner-only non-secret configuration:

- Unit: `~/.config/systemd/user/santa-claw-gb10.service`.
- Environment: `~/.config/santa-claw-gb10/workshop.env`.
- Data: `data/` inside the checkout unless `SANTA_DATA` chooses another private directory.

The unit resolves your Node/native tool paths and does not assume an Ubuntu cloud username. The app service does not own the model server or native gateway. Plan OS login/lingering behavior separately if boot-time startup is required.

After an update, with jobs/configuration idle:

```bash
git pull --ff-only
npm ci --ignore-scripts
npm run build
npm run verify:gb10
systemctl --user restart santa-claw-gb10
```

Keep the existing `SANTA_DATA` path. Back up SQLite using a consistent backup, or stop the app cleanly before copying its database and WAL files; never commit data/backups. Do not restart during a model switch or credential handoff.

Readiness failures stop production startup. For development/UI inspection only, `node server/private-index.mjs` can run on an unqualified host; its native readiness must remain false and it is not an end-to-end qualification.

## Local inference versus offline operation

Local-only mode prevents app inference dispatch through cloud/unknown native routes and blocks NVIDIA cloud setup by default. It is an application route guard, not an OS firewall or proof that an arbitrary localhost proxy never forwards traffic. Keep native providers under trusted operator control.

First installation needs access to package/model/image sources. Runtime web tools and Telegram require external access when deliberately enabled. Fully disconnected deployment also requires pre-staged assets, appropriate native network policy and separate validation. No cloud fallback is used to recover from an unavailable local model.

## Advanced compatibility

`SANTA_ALLOW_CLOUD_INFERENCE=1` explicitly enables the earlier cloud provider UI/API for compatibility or development. That setting does not pass the GB10 local-route qualification and is not the supported local deployment. Production `npm start` still runs the GB10/local-route preflight. Use a separate trusted development environment for a cloud demo; do not label its results as local GB10 evidence.

Portable OpenClaw imports are separate from the primary GB10 installation and preserve destination policy. Exported packages contain agent configuration and character assets, not the destination model runtime or weights.
