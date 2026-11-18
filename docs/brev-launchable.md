# Santa Claw Village on Brev

## Santa-themed browser onboarding (recommended)

Choose CPU hardware and VM Mode, disable Jupyter, and paste the complete [GUI setup script](../deploy/brev/gui-setup.sh) into **Run a Setup Script**. For the pinned private GitHub release, bind a Brev secret to the VM launch parameter `SANTA_RELEASE_TOKEN`. Use an expiring fine-grained GitHub token limited to **Soragi/santa-claw-brev → Contents: read**. The installer downloads only the named release asset and checks its digest before extraction. Each deployer controls their VM, so use a credential scoped for the event and its authorized attendees. Alternatively, the organizer can supply a read-only HTTPS archive URL using a Brev secret named `SANTA_SOURCE_URL`. Use the pinned archive with SHA-256 `74e3a684cd80168c1425a1193f938dfee088b6fb4c44e74649e139f1089bde8d`, or stage it as `~/.local/share/santa-claw-onboarding/source.tar.gz` in the workshop image. Add two authenticated Brev Secure Links: **Set up Santa Claw** on port **4312** as the primary call to action and **Enter Santa Claw Village** on port **4311**. Keep public TCP ports disabled. The setup page collects the runtime, model and masked API key and starts the installer on this VM.

## Alternative: collect setup values before VM launch

In the [Brev Console](https://brev.nvidia.com/), select the event organization, then **Launchables → Create Launchable**. Use these settings in NVIDIA’s [Launchable builder](https://docs.nvidia.com/brev/concepts/launchables):

| Builder section | Value |
|---|---|
| Details | **Santa Claw Village** — “Build a team of Christmas Claws on your own CPU workshop. Pick a harness, connect NVIDIA inference, then enter the village.” |
| Default hardware | **CPU**, Ubuntu x86-64 VM. Suggested starting size: 4 vCPU, 16 GiB RAM and 100 GiB disk. Brev allows hardware changes before deployment; setup rejects an NVIDIA compute/display GPU device. |
| Software | **VM Mode**, managed Jupyter off. Paste the **complete contents** of [deploy/brev/setup.sh](../deploy/brev/setup.sh) in the VM setup script. It fetches a pinned, published application commit, including the Bauble Factory. |
| Source | **I don’t have any code files**. The setup script owns the checkout and verifies its revision; no separate notebook or mutable branch is needed. |
| Network | Add **Secure Link** named **Enter Santa Claw Village**, port **4311**, as the call to action. Keep Brev authentication on. No exposed TCP/UDP ports. Port 4310 is the private application; port 4311 serves the welcome page and proxies the village, including WebSockets. |
| View access | Start with **Only my organization**. Share with event attendees after the fresh-deployment checks below. |

Define these **Launch parameters**. Descriptions are part of the attendee-facing form:

| Name | Type / default | Description |
|---|---|---|
| `SANTA_RUNTIME` | Required Choice: `hermes`, `openclaw`; default `hermes` | **1 · Choose your Claw.** Both choices run in NemoClaw/OpenShell; Hermes is the CPU workshop reference. |
| `SANTA_MODEL` | Required Text: `nvidia/nemotron-3.5-super-vl-120b-a12b` | **2 · Pick its brain.** Keep the workshop model or enter a hosted NVIDIA Build model with image input and tool calling. |
| `NVIDIA_INFERENCE_API_KEY` | Required Text; **no default** | **3 · Connect your workshop.** Select a saved Brev organization secret for your NVIDIA Build account. Do not put a shared key into the template. |

Click **Create Launchable**, then **Copy Markdown Badge**. Use the generated **Santa Claw** link for invitations; do not reuse the [VSS example](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization). The setup values are passed only during provisioning. NemoClaw manages the configured provider afterward. The enabled systemd user services start again on VM boot; the setup wrapper does not store a second persistent copy of the key. Select a new VM for a different runtime rather than replacing attendee state.

## Verify before inviting attendees

Launch a fresh CPU VM for each runtime. Check that the welcome link requires Brev sign-in, the workshop accepts a same-origin save, a real agent responds using the selected Build model, image inference works, and Mission Control connects by WebSocket. Stop/start the test VM, reopen the link and verify that the same Claw and model are present without re-entering the key. These checks require a real deployer credential; a plan preview is not a live install.

If setup fails, check the instance setup progress and the selected hardware, key and model. In the instance terminal, run `systemctl --user status santa-claw-launchable santa-claw-welcome` and `cd ~/santa-claw-launchable && ./santa-claw status --agent hermes` (substitute `openclaw` if selected). Native logs are private under `~/.local/state/santa-claw-portable-hermes/` or `~/.local/state/santa-claw-portable/`. For interrupted first onboarding, use `./santa-claw up --agent hermes --provider build --model MODEL_ID --factory --yes` in that checkout and enter the key only at the hidden prompt; then start both user services. If the app is healthy but the secure link is not, forward `4310:4310` with `brev port-forward INSTANCE -p 4310:4310` and open `http://localhost:4310/santa/` to distinguish an app issue from link routing.
If the launch parameter is missing or the download fails, Setup shows **Load the workshop files** before requesting a Build key. An organizer or attendee with release access can download the linked archive and upload it directly. Setup verifies the pinned SHA-256 and then enables model setup on the same VM.
