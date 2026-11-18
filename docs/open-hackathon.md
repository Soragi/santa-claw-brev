# Open Hackathon — Santa’s Bauble Factory

Open Hackathon is available immediately, including on a fresh installation or after RESET ALL. Completing the workshop challenges and celebration is optional. Connect the model, MCP connector and Telegram approval owner before starting the sprint. This replaces the Northstar Gifts retail sprint. Each team uses its own installation; no shared attendee tenancy is introduced.

## Deploy

On Linux ARM64 (GB10) or x86-64 (Brev), with your existing local vLLM model:

```sh
./santa-claw up --agent openclaw --provider vllm --model YOUR_MODEL_ID --factory
```

For CPU Brev, use `--provider build --model YOUR_CURRENT_TOOL_CAPABLE_MODEL_ID`. Choose `--agent hermes` for a separate Hermes installation. `./santa-claw up --plan --factory` previews the installation. Factory services are never deployed on a Mac; access your Linux instance from a browser.

The launcher builds a pinned CadQuery worker image and verifies its dependencies, alongside the existing native NemoClaw/OpenShell runtime. It preserves model services and unrelated native sandboxes. Allocate sufficient RAM/disk for CAD and inference; the CAD worker itself is limited to one job, 1.5 CPUs and 3 GiB RAM. ARM64 and GPU visualization require live qualification on that hardware.

Without `--factory`, the page explains that CAD setup is needed. A printer profile is not required to develop, but is required to submit a print-qualified design. See [organizer printer qualification](factory/printer-profile.md).

## The 150-minute assignment

Build a reusable agent team: customer brief → Santa → Designer → CAD Builder → Print Inspector → Telegram approval → print package. Create three new Claws, author their prompts, enable Sandbox terminal, select their role-specific MCP permissions and add at least one custom skill. Test and deploy the Claws through the existing Workshop/Village flow. Connecting installs FACTORY_CONNECTOR.md and a private MCP bridge; capabilities stay outside exported workspaces.

The supplied tools read briefs, revise designs, queue real CAD builds, inspect results, request Telegram approval and submit approved packages. Core designs use a 60 mm body and a fixed 5/2.5 mm radius, 4 mm deep hanging loop. The template must be physically qualified by the organizer; it is not advertised as universally print-safe. Up to four colors are allowed. First build the 60 mm design before minute 120. At minute 120, add AJ for the fictional example recipient Alex Jensen and reduce the body to 54 mm without scaling the loop. The timer closes judged submissions at minute 150; agents and exports continue working.

Four previews come from the exported STEP geometry. Print inspection reimports that STEP in a separate trusted container. Arbitrary CadQuery Python and tree toppers are optional development tracks and require additional organizer geometry/attachment review.

## Safety, approvals and exports

MCP capabilities are role/agent/attempt-scoped. Only the local `/mcp` connector endpoint is installed in OpenShell; public network access remains governed by native policy. CAD containers have no network, credentials, privileges or Docker socket. Briefs and authored code are untrusted.

Use the existing dedicated Telegram approval bot and its single poller. The paired owner receives four actual views, dimensions, materials, estimate and exact package digest. Revised geometry, a changed printer profile, reset, expiry or a used approval prevents submission. No agent can approve or start physical printing.

The factory's download includes CAD source/parameters, STEP/STL/GLB/interchange 3MF, four renders, validation reports, target-slicer outputs when available, agents with authored skills, and the custom SVG/JSON team diagram. Development packages remain downloadable even without print qualification. Destination installations need fresh model/MCP credentials and approval setup; exports never reconnect to the village.

Restore checkpoint cancels jobs, revokes approvals and restores pre-factory agent configurations. Export first: new factory Claws leave the roster. RESET ALL clears workshop/factory checkpoints and challenges. Historical artifacts remain private on the host and are not automatically included in agent exports. Reset cannot recall a print already handed to an operator.

## NVIDIA skills

Two optional upstream packages are vendored at the immutable revision recorded in `vendor/nvidia-factory-skills/SOURCE.json`, with their licenses and references. The factory MCP reference reader makes their pinned instructions and reference files available to connected agents; they are not silently added to every agent's authority. CAD-to-SimReady supports USD preparation, and Omniverse Realtime Viewer supports verified GPU viewer deployments. They do not replace manufacturing inspection. CPU CAD previews never report Omniverse as verified. Organizers must preprovision and qualify GPU endpoints separately; no GPU service or credential is automatically installed.

See the separate [instructor guide](factory/instructor-guide.md) for a reference solution and judging rubric. Attendee UI contains the brief, tool contracts and progress, not solution prompts.
