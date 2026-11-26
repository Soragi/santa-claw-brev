# Deploy Santa Claw on a clean GB10

Run **Qwen in vLLM → OpenClaw in NemoClaw/OpenShell → Santa Claw Village** on the same Spark. The workshop uses the local inference route. The first installation needs internet access for software, model weights and container images.

## 1. Prepare the Spark

1. Finish first boot. Create your Linux user, connect to the network, and apply supported OS updates. Use the [DGX Spark first-boot guide](https://docs.nvidia.com/dgx/dgx-spark/first-boot.html), or the equivalent guide for your GB10 vendor.
2. Open a terminal on the Spark. A local keyboard and display, NVIDIA Sync, or an SSH login all work. Run the installation as your regular user with sudo available. Record the SSH username and address you used if you will open the workshop from a laptop.
3. Check the platform, GPU, memory and storage.

   ```bash
   uname -m
   nvidia-smi --query-gpu=name,driver_version,compute_cap --format=csv,noheader
   free -h
   df -h "$HOME"
   ```

   Expect Linux ARM64 (`aarch64`) and a GB10 GPU with compute capability `12.1`. Available unified memory is shared across the model, GPU caches, and other applications. Check free disk space where Docker and Hugging Face will store their images and weights, as well as in your home directory.

4. On DGX OS or supported Ubuntu, install the basic command-line tools if needed. Check Docker as the account that will run the workshop.

   ```bash
   sudo apt-get update
   sudo apt-get install -y ca-certificates curl git python3
   docker info --format '{{.ServerVersion}}'
   systemctl --user show-environment >/dev/null
   ```

   DGX OS ships with the NVIDIA container runtime. On an OEM GB10, use the vendor’s supported Ubuntu, driver, Docker and NVIDIA Container Toolkit setup. If Docker works with sudo but your user gets permission denied, an administrator can add your workshop account to the Docker group. This grants administrative access to the Docker host. Run `sudo usermod -aG docker "$(id -un)"` as that account if you administer the device, then sign out and reconnect before retrying `docker info`. [NVIDIA Spark container runtime guide](https://docs.nvidia.com/dgx/dgx-spark/nvidia-container-runtime-for-docker.html)

## 2. Start Qwen in vLLM

Choose one path. In all cases, wait for the local model and native sandbox checks before using the village.

### Recommended on a clean device: managed Qwen

Managed vLLM sets up the OpenShell bridge and local model together. NemoClaw can reach the model from inside its sandbox and Santa Claw uses that same native inference route. The managed endpoint may require native authentication. Use sandbox status to verify it.

- **128 GB-class GB10:** Run the [pinned managed installer](../../docs/one-command-install.md) on a clean host with ports 8000 and 4310 free. It starts Qwen3.6 in vLLM during NemoClaw onboarding, then builds Santa Claw and installs its app service. Skip step 3 when it prints that the village is ready.
- **64 GB-class GB10:** Follow NVIDIA’s [NemoClaw local LLM setup](https://build.nvidia.com/spark/nemoclaw/instructions) on the Spark with a release that supports the 64 GB Qwen vLLM profile. Choose **OpenClaw**, **managed vLLM with automatic serving-profile selection**, and **Qwen3.6 35B-A3B NVFP4** when prompted for the model. Use a sandbox name such as `santa-claw-portable`. Allow the model download and sandbox setup to finish. Check `nemoclaw list` and `nemoclaw YOUR_SANDBOX status` for the recorded model and a healthy local inference route. Continue with the existing-sandbox command in step 3. NVIDIA lists 64 GB support from NemoClaw 0.0.139. [NemoClaw 0.0.139 release notes](https://github.com/NVIDIA/NemoClaw/releases/tag/v0.0.139)

### Alternative: start an operator-run Qwen server

Use this path if you want to run vLLM separately from the workshop and can configure its private sandbox route. Before starting vLLM, plan for host access on loopback and sandbox access through OpenShell’s private Docker bridge. The NVIDIA Sync scripts below bind to loopback for host checks. A loopback-only listener may be unreachable from the sandbox. Follow NVIDIA’s existing-server network instructions on your device before attaching it. If a serving configuration binds to all interfaces, apply the documented default-deny host firewall first. Permit the model port only on loopback and from the OpenShell Docker subnet to its gateway address. Keep it closed on LAN and public interfaces. If you have no private bridge route yet, use managed vLLM above. [NemoClaw vLLM network and existing-server instructions](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/local-inference/set-up-vllm)

Choose the Qwen recipe for your **actual memory size**. NVIDIA provides separate launch scripts for 64 GB and 128 GB. They select the model’s tool-call parser and the device-specific runtime settings. Qwen3.8 27B supports text and images. You will verify both tool calls and image inference on your device in step 3. [Single-device vLLM playbook](https://build.nvidia.com/spark/vllm/intermediate) · [Qwen model card](https://huggingface.co/nvidia/Qwen3.8-27B-NVFP4#input)

| Unified memory | Container image | NVIDIA launch script |
| --- | --- | --- |
| 64 GB | `vllm/vllm-openai:v0.28.0` | [64 GB Qwen launcher](https://raw.githubusercontent.com/NVIDIA/dgx-spark-playbooks/refs/heads/main/nvidia/playbook-vllm/assets/sync-vllm-spark-64gb-qwen38-27b.sh) |
| 128 GB | `nvcr.io/nvidia/vllm:26.10.pre1-py3` | [128 GB Qwen launcher](https://raw.githubusercontent.com/NVIDIA/dgx-spark-playbooks/refs/heads/main/nvidia/playbook-vllm/assets/sync-vllm-spark-128gb-qwen38-27b.sh) |

1. In a Spark terminal, check `hf --help`. Follow the [Hugging Face CLI installation guide](https://huggingface.co/docs/huggingface_hub/guides/cli) if needed.
2. Pull the container image from your row using `docker pull IMAGE`. Download the main model and its companion draft model for the NVIDIA script.

   ```bash
   hf download nvidia/Qwen3.8-27B-NVFP4
   hf download z-lab/Qwen3.8-27B-DFlash2
   ```

3. Start the matching script using the NVIDIA Sync steps in the playbook. For a direct Spark terminal, save the matching script on the Spark as `start-qwen.sh`, review it, then run `bash start-qwen.sh`. Use the recipe on a clean model host with port 8000 free. The provided scripts replace any container with their recipe-specific name.

Keep the vLLM launch running. The NVIDIA Sync example stops the server when you close its app. On the Spark, wait until the endpoint responds and note the exact served model ID.

```bash
curl -fsS --max-time 10 http://127.0.0.1:8000/health
curl -fsS --max-time 10 http://127.0.0.1:8000/v1/models | python3 -m json.tool
```

Check that `data` includes the expected model. Use the `id` field in the next step, including any prefix or alias. If the model is still loading, inspect the vLLM logs and retry after it reports ready. Run one model server on port 8000. Keep the API private and follow NemoClaw’s guidance for connecting the sandbox through its OpenShell bridge. [NemoClaw existing vLLM setup](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/local-inference/set-up-vllm#use-an-existing-server)

## 3. Install Santa Claw and connect to vLLM

Run these commands on the Spark. The checkout needs to stay in the same directory after installation. If access to the GitHub repository is restricted, authenticate to GitHub with the workshop account first.

```bash
git clone https://github.com/Soragi/santa-claw-brev.git
cd santa-claw-brev
```

For a separately started vLLM server and a fresh native install, run the launcher with the exact ID from step 2. This example uses the NVIDIA Qwen3.8 recipe’s ID. Keep vLLM running and review the plan before proceeding.

```bash
santa_model='nvidia/Qwen3.8-27B-NVFP4'
./santa-claw up --plan --agent openclaw --provider vllm \
  --model "$santa_model" --vllm-port 8000
./santa-claw up --agent openclaw --provider vllm \
  --model "$santa_model" --vllm-port 8000
```

The launcher prompts before downloading software and images. It installs the pinned NemoClaw/OpenShell tools if missing, creates the `santa-claw-portable` sandbox, and builds Santa Claw. Follow any sudo prompt on the Spark. No NVIDIA Build API key is needed for this local provider.

For the 64 GB managed path or another existing NemoClaw sandbox, choose the actual sandbox and local model reported by `nemoclaw list` and `nemoclaw YOUR_SANDBOX status`. The example below uses the managed Qwen3.6 model and the suggested sandbox name. See the [portable launcher operations guide](../../docs/portable-install.md#manage-and-resume).

```bash
santa_sandbox='santa-claw-portable'
santa_model='nvidia/Qwen3.6-35B-A3B-NVFP4'
./santa-claw up --agent openclaw --reuse-native --sandbox "$santa_sandbox" \
  --provider vllm --model "$santa_model" --vllm-port 8000
```

A successful run checks real sandbox execution, a structured model tool call, image inference, and the Santa Claw readiness endpoint. It prints the village address and a private native dashboard URL. Verify again from the Spark if needed:

```bash
./santa-claw check --agent openclaw
curl -fsS --max-time 45 http://127.0.0.1:4310/santa/api/ready
```

Look for `"ok":true` and passing checks for the database, local model and OpenShell. A model listed in `/v1/models` is a host-side check. The full preflight also exercises the native route your workshop uses.

## 4. Open the village

- **Browser on the Spark:** Open [Santa Claw Village](http://127.0.0.1:4310/santa/).
- **Browser on your laptop:** In a new laptop terminal, forward the port with your Spark username and hostname, IP address or configured SSH alias. Keep that terminal open, then open the same [Santa Claw Village address](http://127.0.0.1:4310/santa/) in the laptop browser.

  ```bash
  ssh -N -L 4310:127.0.0.1:4310 your-user@your-spark
  ```

For the **OpenClaw dashboard**, run `nemoclaw santa-claw-portable dashboard-url --quiet` on the Spark. Replace the sandbox name if you used a different one. Keep the returned URL private because it can include an authentication token. If the URL is on Spark loopback and you use a laptop, forward the dashboard’s printed port before opening the URL locally. Substitute the same printed port for both occurrences of `DASHBOARD_PORT`. [NemoClaw dashboard command reference](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/reference/commands#nemoclaw-name-dashboard-url)

```bash
ssh -N -L DASHBOARD_PORT:127.0.0.1:DASHBOARD_PORT your-user@your-spark
```

## 5. Run an end-to-end test

1. In the village UI, design and name a Claw. Give it a short purpose and accept the design.
2. In **Workshop**, enable file and terminal tools, run the OpenShell checks, then complete the external-request test. Verify the block before approving the intended request. Retry it and verify the result.
3. Run a task such as “Use Node.js to compute 23 × 17. Save the expression and result in `math-check.txt` and tell me the filename.” Confirm the downloadable file contains `391`, then deploy the Claw and check that it appears in the village.
4. If the workshop will use the camera challenge, check a real camera in your browser. The startup image probe validates the model route. Browser camera permission and the physical camera are separate checks.

## Recovery and restart

| Symptom | Check |
| --- | --- |
| vLLM is loading or the model catalog is empty | Inspect the model log and verify the container is using the correct GPU and mounted cache. Wait for the catalog before starting Santa Claw. |
| Host model responds but the sandbox check fails | Inspect `nemoclaw santa-claw-portable status` using the actual sandbox name. Check that the model ID and port match and that the native route can reach the endpoint through the authorized bridge. Keep the model off public interfaces. |
| Tools are returned as prose or the vision probe fails | Check the recipe’s tool parser and image support. Qualify the route with `./santa-claw check --agent openclaw`. |
| Port 8000 or 4310 is already occupied | On the Spark, use `ss -ltn` to see existing listeners and identify the owning app before changing anything. An existing model and an existing Santa Claw UI have separate lifecycles. |
| Setup was interrupted | Keep the same checkout, model, runtime and sandbox name. Start vLLM if needed and rerun the original launcher command. An existing owned launch can resume. |
| Village fails to open on the laptop | First test `/santa/api/ready` on the Spark. If it responds, check that the SSH tunnel remains open on the laptop and browse the loopback address. |

The portable launcher writes data and logs under `$XDG_STATE_HOME/santa-claw-portable`, or `~/.local/state/santa-claw-portable` by default. `./santa-claw logs --agent openclaw` follows application logs. `./santa-claw stop --agent openclaw` stops the UI while preserving its data, native sandbox and model. After a reboot, start your model server first and rerun the same launch command. The portable launcher keeps the native service available after logout and requires you to start the village again after a reboot. For systemd service management and existing installations, see [GB10 operations](../../docs/gb10-setup.md). Keep the installation private and omit credentials from exports.
