# Santa Claw Village on Brev

## Santa-themed browser onboarding (recommended)

Choose CPU hardware and VM Mode, disable Jupyter, and paste the complete [GUI setup script](../deploy/brev/gui-setup.sh) into **Run a Setup Script**. The GUI installer automatically downloads and verifies the pinned public workshop release. No GitHub credential or source parameter is required. Add three authenticated Brev Secure Links: **Set up Santa Claw** on port **4312** as the primary call to action, **Enter Santa Claw Village** on port **4311**, and **Agent Dashboard** on port **4313**. Keep public TCP ports disabled. The setup page collects the runtime, model and masked API key and starts the installer on this VM.

## Open the native agent dashboard

Once setup finishes, open **Agent Dashboard**. The relay looks up the dashboard port for the sandbox selected during setup and opens its OpenClaw or Hermes UI. In the Brev instance terminal, read the per-VM dashboard access code:

```sh
cat ~/.config/santa-claw-launchable/dashboard-code
```

Enter the code on your authenticated Brev dashboard link. This protects the relay even when the upstream Hermes dashboard relies on loopback access. The code stays on the VM and is separate from the NVIDIA Build key. Complete any native dashboard sign-in or pairing as prompted. For OpenClaw, retrieve the private gateway token with `nemoclaw santa-claw-portable gateway-token --quiet` and enter it in the Control UI. Keep both credentials private.

The relay is installed by the updated setup script. It is available after setup on new VMs. A Secure Link alone cannot add the relay to an older VM. If the link reports an upstream error after setup, check `systemctl --user status santa-claw-dashboard.service` and inspect the dashboard status for the selected sandbox. The 4313 link goes through Brev's authenticated HTTP proxy. Do not add 4313 or the native dashboard port under public TCP ports.

## Alternative: collect setup values before VM launch

In the [Brev Console](https://brev.nvidia.com/), select the event organization, then **Launchables → Create Launchable**. Use these settings in NVIDIA’s [Launchable builder](https://docs.nvidia.com/brev/concepts/launchables):

| Builder section | Value |
|---|---|
| Details | **Santa Claw Village** — “Build a team of Christmas Claws on your own CPU workshop. Pick a harness, connect NVIDIA inference, then enter the village.” |
| Default hardware | **CPU**, Ubuntu x86-64 VM. Suggested starting size: 4 vCPU, 16 GiB RAM and 100 GiB disk. Brev allows hardware changes before deployment; setup rejects an NVIDIA compute/display GPU device. |
| Software | **VM Mode**, managed Jupyter off. Paste the **complete contents** of [deploy/brev/setup.sh](../deploy/brev/setup.sh) in the VM setup script. It fetches a pinned, published application commit, including the Bauble Factory. |
| Source | **I don’t have any code files**. The setup script owns the checkout and verifies its revision; no separate notebook or mutable branch is needed. |
| Network | Add **Secure Link** named **Enter Santa Claw Village**, port **4311**, as the call to action. Keep Brev authentication on. No exposed TCP/UDP ports. Add an authenticated **Agent Dashboard** Secure Link on port **4313** as well. Port 4310 is the private application; port 4311 serves the welcome page and proxies the village, including WebSockets. |
| View access | Start with **Only my organization**. Share with event attendees after the fresh-deployment checks below. |

Define these **Launch parameters**. Descriptions are part of the attendee-facing form:

| Name | Type / default | Description |
|---|---|---|
| `SANTA_RUNTIME` | Required Choice: `hermes`, `openclaw`; default `hermes` | **1 · Choose your Claw.** Both choices run in NemoClaw/OpenShell; Hermes is the CPU workshop reference. |
| `SANTA_MODEL` | Required Text: `nvidia/nemotron-3.5-super-vl-120b-a12b` | **2 · Pick its brain.** Keep the workshop model or enter a hosted NVIDIA Build model with image input and tool calling. |
| `NVIDIA_INFERENCE_API_KEY` | Required Text; **no default** | **3 · Connect your workshop.** Select a saved Brev organization secret for your NVIDIA Build account. Do not put a shared key into the template. |

Click **Create Launchable**, then **Copy Markdown Badge**. Use the generated **Santa Claw** link for invitations; do not reuse the [VSS example](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization). The setup values are passed only during provisioning. NemoClaw manages the configured provider afterward. The enabled systemd user services start again on VM boot; the setup wrapper does not store a second persistent copy of the key. Select a new VM for a different runtime rather than replacing attendee state.

## Verify before inviting attendees

Launch a fresh CPU VM for each runtime. Check that the welcome link requires Brev sign-in, the workshop accepts a same-origin save, a real agent responds using the selected Build model, image inference works, Mission Control connects by WebSocket, and Agent Dashboard opens the selected native UI after unlocking. Stop/start the test VM, reopen the link and verify that the same Claw and model are present without re-entering the key. These checks require a real deployer credential; a plan preview is not a live install.

If setup fails, check the instance setup progress and the selected hardware, key and model. In the instance terminal, run `systemctl --user status santa-claw-launchable santa-claw-welcome` and `cd ~/santa-claw-launchable && ./santa-claw status --agent hermes` (substitute `openclaw` if selected). Native logs are private under `~/.local/state/santa-claw-portable-hermes/` or `~/.local/state/santa-claw-portable/`. For interrupted first onboarding, use `./santa-claw up --agent hermes --provider build --model MODEL_ID --factory --yes` in that checkout and enter the key only at the hidden prompt; then start both user services. If the app is healthy but the secure link is not, forward `4310:4310` with `brev port-forward INSTANCE -p 4310:4310` and open `http://localhost:4310/santa/` to distinguish an app issue from link routing.
If the download fails, Setup shows **Load the workshop files** before requesting a Build key. An organizer or attendee with release access can download the linked archive and upload it directly. Setup verifies the pinned SHA-256 and then enables model setup on the same VM.
