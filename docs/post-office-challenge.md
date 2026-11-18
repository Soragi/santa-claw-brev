# Challenge One: Santa’s Post Office

Create a dedicated new agent and follow four stages. Easy mode uses guided controls; Technical mode requires authoring the connector configuration and integration checks.

## Configure and connect

Write the agent’s system instructions yourself. Select MCP permissions in the access quiz; answers can be corrected to earn the score. Explanation fields are optional, with bonus points for correct answers and no minimum word count. Tool access and human review are enforced separately from the model’s prompt.

The mailbox clock starts when the attempt starts, including entering the agent name or resetting its checkpoint. Randomized letters arrive every five seconds. Reaching 700 letters before deployment fails the attempt. Pause stops the clock.

## Review ten replies

The first ten incoming letters arrive one at a time, every five seconds. Approve five correct replies and reject five incorrect replies. Compare the child’s name, requested gift and other facts with the original letter. Optional reasons provide additional assessment evidence. Review using the UI buttons or a paired Telegram approval bot; numeric replies are not required.

Reviewed examples become inference memory, not model weight training. The local model is checked before deployment; more than four correct cases out of six is sufficient. An imperfect passing result is shown as room for improvement rather than a guarantee of general email accuracy.

## Deploy and finish

**Deploy Agent** stops new arrivals and starts autonomous processing of the fixed backlog. Envelope flights in the village follow delivery receipts. **Bulk send** can finish the remaining backlog without waiting for individual animations. Completion requires sent replyable letters and resolved hold cases.

The Post Office is a simulation: customer mail is synthetic. Local model calls, MCP tools and human approval transport execute through the configured runtime. Telegram requires its own dedicated approval bot and private pairing; configure credentials through secure setup rather than prompts or repository files.

## Export and reset

Export includes the portable playbook, reviewed examples and selected agent instructions, without live sending grants, bot credentials or attempt capabilities. Destination integrations must be configured separately.

**Reset checkpoint** restarts the attempt clock and restores its original agent checkpoint. It does not retract external Telegram messages. **Settings → RESET ALL** clears attempts, checkpoints, review memory and all custom workshop agents. See [reset details](reset-all.md).
