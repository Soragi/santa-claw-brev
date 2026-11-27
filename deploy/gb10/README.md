# Get Santa Claw running on a new GB10

Start with a Spark that has finished first-time setup and is connected to the internet. Open **Terminal on the Spark** and sign in as your regular user. Have your administrator password handy. The first install can take a while because it downloads Qwen and the software that runs it.

## 1. Download Santa Claw

Copy this into the Spark terminal:

```bash
if ! command -v git >/dev/null || ! command -v curl >/dev/null; then
  sudo apt-get update && sudo apt-get install -y git curl
fi
cd "$HOME" &&
  git clone https://github.com/Soragi/santa-claw-brev.git &&
  cd santa-claw-brev
```

## 2. Set up Qwen and Santa Claw

Choose the instructions for the memory listed on your device. Both paths run Qwen locally in vLLM and use OpenClaw. You can install and use them without an NVIDIA Build API key.

### 128 GB Spark

Paste this in the same terminal, then type **y** when asked to continue:

```bash
bash install.sh
```

The installer starts Qwen, sets up the sandbox, and starts Santa Claw. Wait for **Santa Claw is ready**.

**Pre-stage Qwen to save time.** If vLLM already serves `nvidia/Qwen3.6-35B-A3B-NVFP4` on port `8000` under that exact model ID, the installer reuses it and verifies tool calling and vision. The server must be reachable from OpenShell. If port `8000` is free, the installer starts its pinned vLLM setup and reuses the exact weights from `$HOME/.cache/huggingface/hub` and the pinned image from Docker’s local cache. The model revision and image digest are in [the installer lock](../../config/installer.json). If another service is using port `8000`, free the port before retrying.

### 64 GB Spark

First install NVIDIA NemoClaw. Paste this in the same terminal:

```bash
curl -fsSL https://www.nvidia.com/nemoclaw.sh -o "$HOME/nemoclaw-install.sh" &&
  bash "$HOME/nemoclaw-install.sh"
```

Accept the software notice. If asked to choose an agent, select **OpenClaw**. Choose **1** for automatic vLLM setup, then **Yes** for Express Install. Wait for OpenClaw to report that it is ready. [NVIDIA setup reference](https://build.nvidia.com/spark/nemoclaw/instructions#step-1-install-nemoclaw)

Now install Santa Claw and enable automatic reboot recovery for that sandbox:

```bash
bash install.sh --reuse-existing --manage-reboots --sandbox my-assistant
```

If the NVIDIA installer displayed a different sandbox name, use it in the command. Type **y** and wait for **Santa Claw is ready**. If you previously started this same workshop with `./santa-claw up`, run `./santa-claw stop` first. This stops its web app and preserves its data.

## 3. Open the Village and OpenClaw Dashboard

Look at the end of the installer output in the Spark terminal. It prints the **Santa Claw Village** link, the **OpenClaw Dashboard** link with its access token, and one SSH command that forwards both ports to your laptop. Keep the dashboard link private. To print both links again, rerun your install command from step 2.

On the Spark, open [Santa Claw Village](http://127.0.0.1:4310/santa/). Create a Claw, give it a purpose, and run its readiness checks and a real test in **Workshop**. For a first task, ask it to compute **23 × 17** and save the answer in a file. Check that the file contains **391**, then deploy the Claw to your village.

<details>
<summary>I'm using a browser on my laptop</summary>

Run the printed SSH command in a **laptop terminal**. Replace the final `username@YOUR_SPARK` with your usual Spark SSH destination or SSH alias. Leave the tunnel open and open both printed links in your laptop browser.

</details>

## After a reboot

On either path, OpenClaw and the Village start automatically after a normal Spark reboot. Give Qwen a couple of minutes to load, then reopen the links. If you use a laptop, reconnect the SSH tunnel.

<details>
<summary>Setup stopped or the village won't open</summary>

- If you closed the terminal or the download failed, reopen a terminal on the Spark, run `cd "$HOME/santa-claw-brev"`, then retry the command that stopped.
- If vLLM reports low GPU memory or repeatedly restarts, run `nvidia-smi` on the Spark. An existing model server or GPU application can consume the shared memory Qwen needs. Close workloads you own and no longer need, then rerun the installer. The 128 GB profile needs roughly 49 GiB available to CUDA at startup. [NVIDIA vLLM troubleshooting](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/local-inference/set-up-vllm)
- If NVIDIA’s installer reports an unsafe npm directory, inspect the reported path with `namei -l`. If a reported directory is yours and is a real directory, remove group and world write access from that directory with `chmod go-w PATH`. [NVIDIA permission troubleshooting](https://github.com/NVIDIA/NemoClaw/blob/main/docs/reference/troubleshooting.mdx#permission-errors-during-installation)
- On the 64 GB path, if NemoClaw is ready and Santa Claw reports a sandbox or model mismatch, use the sandbox name and exact model ID shown by `nemoclaw list` and `nemoclaw YOUR_SANDBOX status`.
- If you already run your own vLLM server or need to diagnose Docker, the GPU driver or a service, use the [GB10 operator guide](../../docs/gb10-setup.md).

</details>
