# DGX Spark GB10: deploy the local vLLM model

This guide follows the Build-a-Claw sequence: **prepare a separate model server → verify its exact model and inference → connect the workshop → test a real agent tool call**. Starting Santa Claw does not start vLLM, download weights or change the selected inference provider.

Primary deployment is DGX Spark GB10; begin with [GB10 setup](gb10-setup.md) and the [profile](../config/gb10.json). Cloud inference is disabled by default. Use the commands below with this repository; `./bac vllm` belongs to the reference project. Use one of the two setup paths below. Run the model, NemoClaw and Santa Claw on the same qualified GPU host for the local Settings option. CPU-only cloud demos are outside the primary GB10 deployment path. Validate the native route and tool calls on your target device; recipe inspection alone is not end-to-end qualification.

## 1. Check the host

Connect to your DGX Spark with your configured SSH alias, or open its local terminal:

```bash
ssh your-spark-ssh-alias
nvidia-smi
uname -m
python3 --version
getconf GNU_LIBC_VERSION
nemoclaw --version
openshell --version
```

The Qwen recipe in section 3 targets **Linux ARM64 DGX Spark / GB10 with compatible Blackwell NVFP4 kernels**. It is not a generic recipe for every NVIDIA GPU. Pick a different qualified model/runtime for other hardware. Account for weights, KV cache, concurrent sequences and runtime memory; an MoE model’s active parameter count is not its total memory footprint.

## 2. Choose the installation path

### A. NemoClaw-managed setup on a fresh supported GPU host

Use this when you want the native wizard to select an available validated serving profile and manage its runtime. First inspect the profiles offered by your installed version:

```bash
nemoclaw profiles list
```

Then, on a **new installation with a fresh sandbox name**, run:

```bash
NEMOCLAW_PROVIDER=install-vllm \
  nemoclaw onboard --name santa-workshop --agent openclaw
```

Review the wizard’s GPU, model, image, storage and download choices. Profile availability depends on hardware and installed NemoClaw version. This command can install a container and download weights; it is not just a UI setting. Do not run it over an existing workshop name or alongside another server already using port 8000.

After onboarding, start Santa Claw with `SANTA_SANDBOX=santa-workshop`, then use **Current NemoClaw provider** in Settings for model changes. Managed authenticated profiles can reject unauthenticated catalog discovery; their native route remains the source of truth. See [NVIDIA’s vLLM setup guide](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/local-inference/set-up-vllm) for supported profiles, listener/firewall requirements and recovery.

### B. Operator-run model server, as in Build-a-Claw

Use this when you already operate the model runtime or want the explicit Qwen recipe below. The server is independent of the workshop. You install and start it deliberately, validate it, and then select it in Santa Claw.

## 3. Install and start the Qwen NVFP4 example

### Create an isolated runtime

Run these commands from the Santa Claw repository on the qualified GPU machine. You need Python’s `venv` support. The following versions are the inspected reference recipe’s package pins; their availability was checked on 29 October 2026. Dependency metadata also resolves for Python 3.13, Linux ARM64/glibc 2.39 and the CUDA 13.0 wheel index, with source builds disabled. Use a driver compatible with those CUDA wheels. This is not a new hardware certification.

```bash
python3 -m venv .venv-tools
.venv-tools/bin/python -m pip install uv
.venv-tools/bin/uv venv .venv-vllm --python 3.13
.venv-tools/bin/uv pip install --python .venv-vllm/bin/python \
  --torch-backend=auto \
  'vllm==0.28.0' \
  'flashinfer-python==0.6.16.post3' \
  'nvidia-cutlass-dsl==4.6.2'
.venv-tools/bin/uv pip check --python .venv-vllm/bin/python
.venv-tools/bin/uv pip freeze --python .venv-vllm/bin/python \
  > vllm-resolved-requirements.txt
source .venv-vllm/bin/activate
```

`uv` can download Python when needed. Save the resolved requirements with your deployment records. If matching wheels or kernels are unavailable, stop and use a qualified runtime; do not silently fall back to another precision/backend. For another GPU/OS, follow the [official vLLM GPU installation instructions](https://docs.vllm.ai/en/stable/getting_started/installation/gpu/).

Check the Spark-specific kernel prerequisites before downloading weights:

```bash
export CUTE_DSL_ARCH=sm_121a
export MAX_JOBS=8
python - <<'PY'
import torch
from vllm.utils.flashinfer import has_flashinfer_b12x_gemm, has_flashinfer_b12x_moe
capability = torch.cuda.get_device_capability()
print('GPU capability:', capability)
assert capability == (12, 1), 'This example targets DGX Spark / GB10.'
assert has_flashinfer_b12x_gemm() and has_flashinfer_b12x_moe(), 'Required NVFP4 kernels unavailable.'
PY
```

### Launch the server

Start with a 32K context and one concurrent sequence, then increase only after checking capacity and latency. The reference’s larger context/concurrency values are not a guarantee for your machine. This command downloads the pinned model into the local cache on first launch. Review the model’s license and any remote-code requirements before running it.

```bash
export HF_HOME="$PWD/models/huggingface"

vllm serve nvidia/Qwen3.6-35B-A3B-NVFP4 \
  --revision 1355db6a052410cfd62085d94b58866fd0f2c3c5 \
  --served-model-name santa-qwen \
  --host 127.0.0.1 \
  --port 8000 \
  --tensor-parallel-size 1 \
  --moe-backend flashinfer_b12x \
  --attention-backend flashinfer \
  --kv-cache-dtype fp8 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --reasoning-parser qwen3 \
  --default-chat-template-kwargs '{"enable_thinking":false}' \
  --gpu-memory-utilization 0.6 \
  --max-model-len 32768 \
  --max-num-seqs 1 \
  --max-num-batched-tokens 8192 \
  --enable-chunked-prefill \
  --async-scheduling \
  --enable-prefix-caching \
  --load-format fastsafetensors \
  --trust-remote-code
```

The checkpoint and revision are public: [NVIDIA’s model card](https://huggingface.co/nvidia/Qwen3.6-35B-A3B-NVFP4) and [pinned files](https://huggingface.co/nvidia/Qwen3.6-35B-A3B-NVFP4/tree/1355db6a052410cfd62085d94b58866fd0f2c3c5). The launch recipe is an adaptation of the inspected workshop profile; do not assume it is the model card’s current recommended backend configuration for every GPU.

Keep this terminal running. Alternatively, start it inside your own `tmux` session and detach; do not close the process and expect the workshop to restart it. Use a dedicated service for a durable event deployment.

`qwen3_coder` is model-specific. For another model, use its supported parser and template. `--reasoning-parser` parses reasoning output; the separate template setting disables thinking for this recipe. `--max-num-batched-tokens` controls scheduling, not the OpenClaw response-token budget. See [vLLM tool calling](https://docs.vllm.ai/en/stable/features/tool_calling/).

## 4. Verify readiness, inference and tools

In another terminal on the **same GPU host**:

```bash
curl --fail --silent --show-error http://127.0.0.1:8000/health
curl --fail --silent --show-error http://127.0.0.1:8000/v1/models
```

Wait for the model to load. `/v1/models` must include `santa-qwen`, because the example sets that served alias. Do not enter the Hugging Face checkpoint name in Settings when the server exposes a different alias.

Next, test an actual Chat Completions response:

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  --data '{"model":"santa-qwen","messages":[{"role":"user","content":"Reply with exactly: Santa is ready"}],"max_tokens":128,"temperature":0,"chat_template_kwargs":{"enable_thinking":false}}'
```

Finally, test **structured** tool calling:

```bash
mkdir -p work/vllm-checks
curl --fail --silent --show-error \
  http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  --data '{"model":"santa-qwen","messages":[{"role":"user","content":"Call get_workshop_status once. Do not answer in prose."}],"tools":[{"type":"function","function":{"name":"get_workshop_status","description":"Read workshop readiness","parameters":{"type":"object","properties":{},"additionalProperties":false}}}],"tool_choice":"auto","max_tokens":512,"temperature":0,"chat_template_kwargs":{"enable_thinking":false}}' \
  > work/vllm-checks/tool-response.json
python3 - <<'PY'
import json
with open('work/vllm-checks/tool-response.json') as source:
    response = json.load(source)
calls = response['choices'][0]['message'].get('tool_calls', [])
assert any(c['function']['name'] == 'get_workshop_status' for c in calls), 'No structured tool call; check parser/template.'
for call in calls:
    json.loads(call['function']['arguments'])
print('Structured tool call returned; this probe does not execute a tool.')
PY
```

A prose description or code block mentioning a tool is not a structured tool call. Do not proceed with an agent workflow until this check passes.

## 5. Connect NemoClaw and Santa Claw

For a **new** sandbox with an already-running operator model server:

```bash
NEMOCLAW_PROVIDER=vllm \
  nemoclaw onboard --name santa-workshop --agent openclaw
export SANTA_SANDBOX=santa-workshop
npm start
```

For an **existing** Santa Claw installation, keep its sandbox and data. Wait for active jobs to finish, then open **Setup → Model & compute**:

1. Choose **Local · vLLM**.
2. Click **Discover served models**.
3. Select or enter `santa-qwen` for the example above.
4. Click **Apply provider & model** and wait for native verification to complete.
5. In Santa’s Workshop, rerun OpenShell checks and a real test before using the new model for event jobs.

The corresponding operator command for an existing sandbox is:

```bash
export SANTA_SANDBOX=your-existing-local-sandbox
nemoclaw inference set --provider vllm --model santa-qwen \
  --sandbox "$SANTA_SANDBOX"
nemoclaw inference get --json
nemoclaw "$SANTA_SANDBOX" status
```

Do not add `--no-verify`. Model listing confirms discovery; it does not prove the sandbox inference path or actual agent tools work. When switching outside the UI, rerun Workshop checks as well.

Use this real agent test with a file/terminal-enabled Claw:

> Run `node --version` inside OpenShell and save the observed output as `environment.txt`. Do not use the network. Have Snow Inspector review the saved file.

Confirm actual execution, the downloadable file, the handoff and independent review. Then try a self-contained HTML game and inspect its saved `index.html` and behavior.

## 6. Ports, network access and lifecycle

The local discovery option expects an operator-run server on `127.0.0.1:8000`. To use another supported vLLM port, set `NEMOCLAW_VLLM_PORT` consistently in the server launch, NemoClaw commands and Santa Claw’s service environment, then restart the app only when idle. Changing only your interactive shell does not change an already-running systemd service.

Do not expose an unauthenticated server on `0.0.0.0`, a public Brev port or a management network. This example deliberately uses loopback. NemoClaw must establish and validate the sandbox-facing inference route; the sandbox’s `localhost` is not the host’s localhost. Follow the installed native provider’s authenticated proxy/bridge setup rather than opening an unrestricted port to work around a failed probe.

For a key-protected server, use native NemoClaw onboarding to configure its credentials, then select **Current NemoClaw provider** for model changes. Santa Claw does not collect local-server keys for raw model discovery. Follow [NVIDIA’s compatible-endpoint guide](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/custom-endpoints/set-up-openai-compatible-endpoint) when that route is appropriate.

On a different GPU machine, configure an authenticated private endpoint through native NemoClaw and use Current provider. The local selector does not turn a laptop or remote server into `127.0.0.1` on the workshop host.

Stop a foreground server with Ctrl-C in the terminal that launched it. Stopping/restarting Santa Claw does not stop/restart an operator-run model server. Inspect the exact process/container/service owner before recovery; do not use broad process-name kills or restart NemoClaw’s managed gateway to recover a model.

## Troubleshooting

- **No model catalog:** the server is still loading, exited, requires authentication, or listens on another host/port. Inspect its startup log first.
- **Model not found:** use the exact ID in `/v1/models`; this example serves `santa-qwen`.
- **Tool names appear in prose:** check automatic tool choice, the model-specific parser, template and Chat Completions endpoint.
- **Long reasoning / no final answer:** check `enable_thinking:false` for this Qwen profile, then inspect the agent’s separate output budget and timeout.
- **Out of memory:** reduce context/concurrency, inspect competing GPU use and choose a qualified smaller model or a different GPU. Do not assume lowering one setting guarantees the model fits.
- **Missing FlashInfer/NVFP4 kernels:** the pinned build and hardware do not meet this recipe; choose a supported profile instead of changing arbitrary kernel flags.
- **Host curl passes but native verification fails:** inspect `nemoclaw "$SANTA_SANDBOX" status` and `doctor`; repair the native proxy/bridge route. Do not disable verification or expose port 8000 publicly.
- **Port already occupied:** inspect the listener and reuse a verified matching server, or stop only the server you own. Never overwrite an unrelated model service.

## Qualification

This manual recipe is an alternative to the managed installer. Dependency compatibility does not prove kernel support, memory fit or throughput. Verify the exact endpoint/model, native inference route, structured tool calls and complete agent workflow on the target GB10 before an event.
