# Managed Qwen and Santa Claw installation on a 128 GB GB10

This installer targets a **128 GB-class GB10 running supported DGX OS/OEM Ubuntu**, with a working NVIDIA driver. It installs the application, pinned user tools, native NemoClaw/OpenShell, a managed local vLLM model, the isolated browser image and the background application service. Complete first boot and apply any supported driver or firmware updates before running it. See the [clean GB10 deployment README](../deploy/gb10/README.md) for the 64 GB managed option, the operator-run model option, and the common browser and agent tests.

## Download and install on the Spark

Run these commands in a Spark terminal as your regular account. Authenticate to GitHub normally first if the repository is private. Keep the checkout in its permanent directory after installation.

```bash
git clone https://github.com/Soragi/santa-claw-brev.git
cd santa-claw-brev
bash install.sh --plan
bash install.sh
```

No Node installation is needed before starting. Python 3, a regular login with a systemd user session, internet access and sudo access for missing system prerequisites are needed. The installer asks once before downloading/installing software; standard sudo password prompts can still appear. `--yes` accepts the software and model downloads for unattended setup. It does not accept a hardware mismatch or replace an existing workshop.

Inspect an existing installation without writing to it:

```bash
bash install.sh --check --sandbox santa-claw-gb10
```

`--plan` prints the steps. `--check` runs read-only host, native local-route and model tool-call checks; it fails when prerequisites are not installed yet. A first run can download tens of gigabytes. At least 100 GiB of free checkout storage is required; native provisioning also checks its own model-cache/image storage locations. No fixed installation-time promise is made.

## What is pinned

See `config/installer.json` for the exact identities:

- Node 22.23.3 ARM64 archive, verified against its SHA-256.
- NemoClaw 0.0.137 source commit `f00fb1dafe2113940b89bcd82f0561adf2696a7b` and its OpenShell dependency.
- That source's managed Qwen NVFP4 model revision and immutable ARM64 vLLM image.
- Context limited to 32K, one concurrent sequence and 0.4 memory utilization.
- Application dependencies through the committed npm lockfile and the pinned browser image.

The managed model snapshot is `491c2f1ea524c639598bf8fa787a93fed5a6fbce`, as declared by the pinned NemoClaw catalog. This differs from the older operator-run Python recipe in `docs/vllm-setup.md`; they are separate, explicit deployment paths. Docker and platform utilities come from the supported OS repositories; their package versions remain under platform maintenance rather than this application's lock.

NemoClaw controls its model container and native gateway lifecycle. Santa remains a user service on the host, where its native terminal, Docker integration and private MCP bridge work without nested Docker or mounting the host Docker socket into an application container.

## Existing installations and resuming

Fresh installation stops when an unowned NemoClaw/OpenShell installation or Santa service is found. It never stops/replaces an occupied model port or an existing application. Docker GPU-runtime reconfiguration is refused while containers are running.

To explicitly use an already qualified local sandbox:

```bash
bash install.sh --reuse-existing --sandbox your-sandbox
```

This skips native installation/upgrades and validates that exact sandbox. It still refuses to overwrite an existing unowned Santa application service. For an already running workshop, use `--check`; do not use this bootstrap as an update mechanism.

Interrupted owned installation: rerun the same command from the same release path. A private receipt records its checkout, sandbox and last phase. Native onboarding uses resume rather than destructive fresh/recreate operations. The installer lock prevents concurrent runs. If the owned app is already running, rerunning verifies it without rebuilding or restarting it. A failed image probe never becomes a successful full-workshop qualification on rerun.

Software notices and model terms must be accepted. Managed download failures, insufficient storage, unavailable permissions and unsupported hardware stop visibly; no cloud model fallback is selected.

## Data, startup and credentials

Application data defaults to `~/.local/share/santa-claw/data`; installation receipts use `~/.local/state/santa-claw/`. Both honor the XDG base directories. Keep the release checkout in place because the service uses it. The service is enabled for this user; lingering lets it continue after SSH logout and start at boot. It retries failed startup every ten seconds while the native gateway/model warms up, rather than exhausting a short restart limit before model loading finishes. Model/gateway lifecycle remains native-owned.

The final checks require actual native command execution, a local structured model tool call, application readiness, and a synthetic image correctly recognized by the local VLM. Authenticated managed models use the verified local native inference route; keys are never copied into Santa configuration or exported agents.

Open `http://127.0.0.1:4310/santa/` on the Spark. For a laptop browser, run this in a laptop terminal and keep the tunnel open:

```bash
ssh -N -L 4310:127.0.0.1:4310 your-user@your-spark
```

Then open the same address on the laptop. For camera access, loopback is a secure browser context. Other remote access needs the existing authenticated HTTPS proxy arrangement.

Every new device starts with fresh Santa workshop data and generates its own native credentials. Configure a dedicated Telegram approval bot through the secure UI; never reuse one bot's polling connection across separate workshop machines. Exported agents can be imported separately. No private database, history, credentials or earlier customer runs are shipped.

For events, run the installer before attendees arrive to warm the native image/model caches. This is an online installer with reusable caches, not a verified air-gapped installation bundle.

## Validation limits

The installer flow and refusal paths are regression tested, and read-only checks and local image inference can be tested on an existing Spark. A genuinely clean-device installation, including first downloads and managed runtime startup, needs a fresh supported GB10. An existing running workshop is not evidence of that first-install qualification.

References: [NVIDIA Spark setup](https://build.nvidia.com/spark/nemoclaw/instructions), [managed local vLLM](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/local-inference/set-up-vllm), [Node release checksums](https://nodejs.org/dist/v22.23.3/SHASUMS256.txt).
