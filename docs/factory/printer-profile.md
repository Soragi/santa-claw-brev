# Organizer printer qualification

CAD development works without a printer profile. Print-qualified submission does not.

Create a private profile directory outside the repository. Set `SANTA_FACTORY_PROFILE` to its `event.json` before launching the app. Include `slicer-profile.ini` beside it. A profile declares:

- `version: 1`, an `id`, printer name, material and nozzle diameter.
- `minFeatureMm`, `maxBodyMm` (at most 60), `maxPrintMinutes`, `maxMaterialGrams`.
- `supports`: `none` or `profile`, and one to four `colors` in `#RRGGBB` format.
- `loop`: `{ "outerRadius": 5, "innerRadius": 2.5, "depth": 4, "offset": 3 }`.
- `cadWorkerImage`: the exact worker image ID from `docker image inspect santa-claw-factory:1 --format "{{.Id}}"`; changing the worker requires requalification.
- `slicerProfileSha256`: SHA-256 of the exact INI bytes.
- `slicerImage`: organizer-built adapter image pinned as `registry/image@sha256:...`.
- `qualified`: false until representative physical prints pass, plus `qualificationEvidence` identifying the operator's qualification record.

The organizer's trusted slicer image is the hardware-specific adapter, not agent-authored code. It receives read-only `/input` (CAD, STL, interchange 3MF and design parameters), read-only `/profile/slicer.ini`, and writable `/job` (including `profile.json`). It runs offline, nonroot with no capabilities, no Docker socket and bounded resources. Its entrypoint must:

1. Import the actual geometry and material regions using the chosen slicer. Preserve dimensions and the fixed hanging loop.
2. Assign each region to the declared material slot. Generic vertex/triangle colors alone do not prove extruder assignment.
3. Save `/job/print-project.3mf`, slice `/job/print.gcode`, and verify both in the target slicer.
4. Write `/job/slice-result.json`: `profileHash` (SHA-256 of parsed profile serialized with JavaScript JSON.stringify), `geometryHash` (SHA-256 of input model.step), positive `printMinutes` and `materialGrams`, `materialAssignmentsVerified: true`, and `supportPolicy` matching the profile.

The host checks the receipt, limits, material mappings, output files and hashes. Keep `qualified: false` if any assignment, unsupported overhang, internal support, thin feature or printer setting is unresolved. The adapter is trusted organizer software; its receipt is not an independent physical certification.

**No universal slicer adapter is enabled.** The event printer has not been selected. Supply and qualify an adapter for that exact printer before accepting submissions. A 3MF interchange file is intentionally labelled differently from the target-slicer project. STL contains no colors. No agent can change the profile or invoke physical printing.

Pause the factory before release or scoring to freeze the reviewed revision. Use `python3 deploy/factory/operator.py --data /PRIVATE/DATA queue` to list submissions. `release --submission UUID --confirm 'PRINT HANDOFF'` records an operator handoff; it does not start a printer. The operator must check that the package and printer profile remain appropriate before printing. `score --engineering 25 --workflow 28 --design 22 --security 15` records the rubric for a qualifying submission.
