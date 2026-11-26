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

### 64 GB Spark

First install NVIDIA NemoClaw. Paste this in the same terminal:

```bash
curl -fsSL https://www.nvidia.com/nemoclaw.sh -o "$HOME/nemoclaw-install.sh" &&
  bash "$HOME/nemoclaw-install.sh"
```

Accept the software notice. If asked to choose an agent, select **OpenClaw**. Choose **1** for automatic vLLM setup, then **Yes** for Express Install. Wait for OpenClaw to report that it is ready. [NVIDIA setup reference](https://build.nvidia.com/spark/nemoclaw/instructions#step-1-install-nemoclaw)

Now start Santa Claw using the default sandbox and the local Qwen model:

```bash
./santa-claw up --agent openclaw --reuse-native --sandbox my-assistant \
  --provider vllm --model nvidia/Qwen3.6-35B-A3B-NVFP4 --vllm-port 8000
```

If the NVIDIA installer displayed a different sandbox name or local Qwen model ID, use those values in the command. When prompted to install Santa Claw, type **y** and wait for **Workshop ready**.

## 3. Open your village

On the Spark, open [Santa Claw Village](http://127.0.0.1:4310/santa/). Create a Claw, give it a purpose, and run its readiness checks and a real test in **Workshop**. For a first task, ask it to compute **23 × 17** and save the answer in a file. Check that the file contains **391**, then deploy the Claw to your village.

<details>
<summary>I'm using a browser on my laptop</summary>

In a **laptop terminal**, open a tunnel using the same username and address or SSH alias you use to sign in to the Spark:

```bash
ssh -N -L 4310:127.0.0.1:4310 your-user@your-spark
```

Leave that terminal open and go to [Santa Claw Village](http://127.0.0.1:4310/santa/) in the laptop browser.

</details>

<details>
<summary>Setup stopped or the village won't open</summary>

- If you closed the terminal or the download failed, reopen a terminal on the Spark, run `cd "$HOME/santa-claw-brev"`, then retry the command that stopped.
- If vLLM reports low GPU memory or repeatedly restarts, run `nvidia-smi` on the Spark. An existing model server or GPU application can consume the shared memory Qwen needs. Close workloads you own and no longer need, then rerun the installer. The 128 GB profile needs roughly 49 GiB available to CUDA at startup. [NVIDIA vLLM troubleshooting](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/inference/local-inference/set-up-vllm)
- If NVIDIA’s installer reports an unsafe npm directory, inspect the reported path with `namei -l`. If a reported directory is yours and is a real directory, remove group and world write access from that directory with `chmod go-w PATH`. [NVIDIA permission troubleshooting](https://github.com/NVIDIA/NemoClaw/blob/main/docs/reference/troubleshooting.mdx#permission-errors-during-installation)
- On the 64 GB path, if NemoClaw is ready and Santa Claw reports a sandbox or model mismatch, use the sandbox name and exact model ID shown by `nemoclaw list` and `nemoclaw YOUR_SANDBOX status`.
- After restarting the Spark, the 128 GB installer’s workshop service starts automatically. On the 64 GB path, wait for NemoClaw and vLLM, then run the same Santa Claw launch command again.
- If you already run your own vLLM server or need to diagnose Docker, the GPU driver or a service, use the [GB10 operator guide](../../docs/gb10-setup.md).

</details>
