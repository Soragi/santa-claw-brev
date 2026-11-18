# GB10 model profile

The primary reference is the public `nvidia/Qwen3.6-35B-A3B-NVFP4` checkpoint at revision `1355db6a052410cfd62085d94b58866fd0f2c3c5`. Machine-readable assumptions and runtime versions are in [config/gb10.json](../config/gb10.json). The manual launcher uses the same pinned checkpoint and conservative serving parameters.

- Linux ARM64 DGX Spark / GB10, compute capability 12.1.
- A compatible CUDA driver and NVFP4/FlashInfer build. The documented Python 3.13 / vLLM 0.28.0 / FlashInfer 0.6.16.post3 / CUTLASS 4.6.2 dependencies were metadata-resolved for Linux ARM64/glibc 2.39 and CUDA 13.0; that does not prove runtime kernels or throughput.
- Default alias `santa-qwen`, 32,768-token context, one sequence, thinking disabled. These are starting settings, not a guaranteed memory/latency budget.
- Reference memory class: nominal 128 GB unified memory. The available model budget is smaller after OS, containers and other workloads. The active MoE parameter count does not size the entire weight allocation.

An existing server may serve the same checkpoint under its full repository ID. Set `SANTA_LOCAL_MODEL` to its exact `/v1/models` ID instead of renaming or restarting it. A first profile launch can download weights; the app and `prepare:gb10` do not.

A smaller-memory Spark needs a capacity-qualified native profile or different model/settings. Do not assume that the same context, backend or quantization works on all NVIDIA GPUs. Native NemoClaw’s current hardware-qualified serving catalog is a separate maintained option.

## Alternative local models

Ollama and other native local models remain optional. Configure the model with the native toolchain and validate its exact ID, actual memory use, structured tool calls, saved-file workflow and independent review. Local model discovery alone does not qualify an alternative for the agent team.

The reference qualification focuses on vLLM/Qwen. For an already selected native Ollama route, runtime preflight uses its loopback port and exact recorded model rather than requiring Qwen. Its full qualification still requires its own endpoint/model checks; do not report the vLLM profile’s test result as Ollama validation. No local model failure silently switches to NVIDIA Build or another cloud service.

See [vLLM installation](vllm-setup.md), [GB10 setup](gb10-setup.md).

## Code generation and output limits

Context length and per-response output capacity are separate limits. Truncated tool arguments can prevent a file from being saved.

During Workshop configuration, Santa Claw adjusts only the known reference Qwen model/alias to a 12,288-token model output capacity when its declared context is at least 32K. Workers request up to 10,000 tokens, additionally bounded by one third of the declared context; coordinators stay smaller. Unknown models retain their native output capacity. This changes neither the local endpoint nor model weights, server context or concurrency.

Workers are also instructed to write larger implementations in several compact steps. The runtime reports a recognized incomplete/truncated tool call explicitly, preserving any existing saved work. A higher cap does not guarantee that a model will follow instructions or implement every game mechanic correctly. Native model switching may restore its own metadata; the next Santa Claw configuration reconciles the known profile again.

For a take-home deployment, inspect the destination model’s own output capacity and validate it there; the export does not reconfigure an existing OpenClaw provider. OpenClaw documents the distinction between context and output capacity in its [model-provider rules](https://docs.openclaw.ai/concepts/model-providers/quick-rules).
