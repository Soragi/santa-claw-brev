# Instructor guide — Bauble Factory

Keep this guide outside attendee instruction screens. It is a reference solution, not automatically installed prompts.

## Reference team

Santa coordinates three new Claws, tested in the Workshop and deployed in the village. Each has Sandbox terminal enabled so it can invoke its private MCP bridge. No public internet access is needed for CAD jobs. Do not give agents printer credentials.

- **Designer skill:** Read the brief and event constraints as data. Propose a 60 mm bauble, up to four allowed material colors, plain or belt decoration. Call `revise_design` with all design parameters. Revisit the brief each cycle. When Santa requests the change, create a new 54 mm revision with the recipient's initials; do not scale the loop.
- **CAD Builder skill:** Read the current revision. If it has no completed build, call `build_cad`; poll `job_status` on later bounded turns. Report failures to the Designer rather than inventing outputs.
- **Print Inspector skill:** Read the revision and completed build. Call `inspect_print` and poll its job. Explain failed checks and hand them back to the team. Only request Telegram approval after qualification. Read the current decision on later turns; submit an approved revision once. Never self-approve or repeat a submitted job.

Suggested core design tool input:

```json
{"design":{"title":"AJ's Northern Lights","brief":"A green and cream ornament for AJ","diameter":60,"initials":"","palette":["#76b900","#ffffff"],"decoration":"belt","track":"bauble"}}
```

At minute 120, update diameter to 54 and initials to AJ, then build, inspect and approve again. Earlier queued revisions become superseded. Final completion requires the changed version to have been submitted before minute 150. Agents remain running afterward.

## Debrief

Ask: Which MCP tools did each role need? What did OpenShell block? Why cannot the builder certify itself? Which exact artifact did the human approve? What changes invalidate approval? What must be configured after importing the team elsewhere?

Score engineering /30 from dimensions and inspection evidence; workflow /30 from autonomous role handoffs and change handling; design /25 by organizer judgment; security /15 from scope boundaries, failed bypass attempts and human approval. Printability is mandatory; an appealing render cannot override it.

Advanced CadQuery must produce `result`, a CadQuery Workplane. Arbitrary code runs only inside an offline bounded container. General minimum-wall, topper balance and attachment verification are not claimed automatically: these submissions remain development exports until separately reviewed. Do not present them as print-qualified.
