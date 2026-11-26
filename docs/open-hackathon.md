# Open Hackathon · Build an agent you can take home

Open **Open Hackathon** in Santa Claw, or go directly to the [NVIDIA NemoClaw applications catalog](https://build.nvidia.com/spark/nemoclaw-applications). The activity starts with the OpenClaw sandbox, NemoClaw CLI and local Qwen inference already set up on your DGX Spark.

1. **Pick a starter.** Choose Daily Personal News Digest, Software Development Agent, Deck Reviewer, or Calendar Negotiator. Read its **Policy setup**, **Agent prompt**, and **How to personalize** sections.
2. **Define your own job.** Give the agent a name and write a prompt for your use case. Define the input, allowed tools and sources, expected output, and any action that requires a human decision.
3. **Grant the access it needs.** Use the recipe’s OpenShell policy and file setup with sample data. Set up Telegram only if you choose a messaging workflow. The Calendar Negotiator’s propose-only mode is an option for a first test.
4. **Deploy and run it.** On Spark, find your sandbox with `nemoclaw list`. Check that `nemoclaw YOUR_SANDBOX status` reports it ready with local inference. Run `nemoclaw YOUR_SANDBOX dashboard-url --quiet` and open the private URL, or use the workshop’s **Agent Dashboard** link if available. In OpenClaw, create or select your named agent and apply your personalized prompt using the recipe’s instructions. [Named agent setup](https://docs.openclaw.ai/cli/agents)
5. **Verify one result.** Run a small case, compare the actual output with what you expected, and make one improvement. Save your prompt, skills, minimum policy, sample input and output so you can repeat it elsewhere.

Your goal is one named agent that completes a task of your own. If time allows, build a second from a different starter. Santa Claw’s **Download agent brief** saves your prompt and test notes. Keep private dashboard URLs and credentials in the native setup on your host.
