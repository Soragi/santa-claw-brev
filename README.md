# Santa Claw

## Launch on NVIDIA Brev (CPU, hosted inference)

1. Open your organizer’s **Santa Claw Village** Launchable in Brev. Keep **CPU** selected (suggested: 4 vCPU, 16 GiB RAM). Each attendee deploys their own VM.
2. In **Setup values**, choose **Hermes** or **OpenClaw**, select your saved [NVIDIA Build](https://build.nvidia.com/) API key, and keep the recommended `nvidia/nemotron-3.5-super-vl-120b-a12b` or enter another hosted model ID that supports tool calls and images.
3. Click **Deploy**. When setup finishes, open the authenticated **Enter Santa Claw Village** link, then **Enter Santa Claw Village →**. No local model, GPU, notebook commands or laptop installation required.

Organizers: [Create the Santa Claw Launchable, configure its secure link, and verify a new deployment](docs/brev-launchable.md). The VSS reference Launchable deploys a different application.

Choose **OpenClaw or Hermes** with the [portable launcher](docs/portable-install.md), using existing vLLM or NVIDIA-hosted inference. The core Hermes workflow is validated on Linux CPU with hosted inference; full event acceptance on each target platform remains required.

A local-first, Christmas-themed agent workshop for **NVIDIA DGX Spark GB10**. Design a printable 3D Claw, give it tools and skills, then deploy it in Santa’s village. Santa coordinates native OpenClaw agents inside a NemoClaw-managed OpenShell sandbox; inference runs locally.

## Install on a GB10

Requires a supported 128 GB-class GB10, Linux ARM64 with working NVIDIA drivers, Python 3, Docker support and a systemd user session. Initial software, image and model downloads require internet access and can require sudo. Authenticate to GitHub first if the repository is private.

```bash
git clone https://github.com/Soragi/santa-claw.git
cd santa-claw
bash install.sh --plan
bash install.sh
```

The installer provisions pinned native tools, managed local vLLM, browser dependencies and the application service. It refuses to replace an unowned existing workshop. No cloud inference key is needed. See [installation and recovery](docs/one-command-install.md) for prerequisites, reuse, resumable setup and qualification limits.

Open **http://127.0.0.1:4310/santa/**. From a laptop, forward the app port:

```bash
ssh -N -L 4310:127.0.0.1:4310 your-user@your-spark
```

## Workshop

1. **Design:** name and customize a Santa-hat lobster in 3D.
2. **Santa’s Workshop:** write its purpose, select tools and skills, and test native execution and OpenShell network requests. Telegram is optional for the workshop exercises. Before village deployment, complete four independent checks: save the design/configuration, pass OpenShell checks, run the external-access exercise (a confirmed block → owner approval → successful HTTP retry), and complete a real agent test. The external exercise runs a bounded request directly inside OpenShell without a model turn. If its hostname is already allowed, revoke that grant in OpenShell or choose another public hostname to practise the block.
3. **Village:** talk to Santa or individual agents, assign real work and inspect sessions, traces and saved outputs. Santa routes jobs to suitable workers and Snow Inspector reviews results.

Each challenge uses a dedicated new agent. Easy and Technical modes teach the same workflow with different configuration exercises:

- **Post Office:** configure MCP access, review ten incoming replies and deploy an agent to clear the mailbox. [Challenge guide](docs/post-office-challenge.md).
- **Contain the Grinch:** inspect network activity, apply an OpenShell policy and verify that sabotage probes are blocked.
- **Gift scanner:** test the local vision model, scan five objects, confirm labels and recipients, and package them for the sleigh. Camera snapshots use only the selected square. Browser face effects run locally.

After all three challenges, start delivery to celebrate. Santa and the agents remain available for further work. **Open Hackathon** is available immediately and opens Santa’s Bauble Factory with MCP, custom skills, local agents and Telegram human approval. [Sprint setup](docs/open-hackathon.md).

## Export and reset

Export remains available during challenges. Multiple Claws download into separate named folders with configuration, selected knowledge/outputs, GLB and printable STL assets. Exports exclude event credentials, village UI, live approvals and runtime/model weights. Use the included instructions to create a fresh native sandbox or import an authored profile into an existing OpenClaw/Hermes installation; destination policies remain its operator’s responsibility.

**Settings → RESET ALL** returns the village and every challenge to a fresh state with only Santa. It removes workshop agents and progress, preserves the installed model/native connection and saves a private local recovery backup. [Reset details](docs/reset-all.md).

## Operations and development

- [Existing GB10 setup and maintenance](docs/gb10-setup.md)
- [Model profile](docs/gb10-models.md) and [manual vLLM setup](docs/vllm-setup.md)
- [OpenShell approvals](docs/openshell-village.md)
- [Health checks, updates and data](docs/operations-and-organizers.md)
- [Security boundaries](SECURITY.md) and [third-party notices](NOTICE.md)

Node.js 22.19+ is required for development:

```bash
npm ci --ignore-scripts
npm test
npm run build
node deploy/check-repository-hygiene.mjs
```

`npm run dev` serves the frontend; `npm start` requires a qualified GB10/native runtime. A frontend build alone does not verify native execution. Fresh-device installation and model capacity must be validated on the target hardware.

Keep local databases, credentials, conversations, generated outputs, screenshots, development notes and audit evidence outside Git. Runtime agent instructions, synthetic exercise data, tests and dependency provenance are maintained source files. This application assumes one trusted private installation; use separate installations for separate trust groups.

## Santa’s Bauble Factory

The final Open Hackathon turns a customer brief into a reviewed ornament print package through Designer, CAD Builder and Print Inspector Claws. Install the offline CAD worker with `./santa-claw up --factory` on Linux; keep your existing runtime/provider/model arguments. See [deployment and event instructions](docs/open-hackathon.md) and [organizer printer qualification](docs/factory/printer-profile.md). A qualified event printer profile is required for print submission; development exports remain available.
