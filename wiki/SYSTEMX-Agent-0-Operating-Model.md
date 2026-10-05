# Agent 0 Operating Model

Agent 0 is a coordination pattern, not a privileged autonomous runtime. One
accountable lead—human or a supervised primary agent—holds the wide system
view, sets the mission, assigns waves, approves lane boundaries, and decides
what may be merged or deployed.

## Agent 0 responsibilities

- Read the current mission map, queue, active work, and completed work.
- Break work into bounded lanes with explicit scope.
- Set mission IDs, wave IDs, checkpoints, and stop conditions.
- Decide when to widen a lane, split it, re-ping it, or close it.
- Review shared-surface risk before concurrent edits touch manifests, routing,
  generated files, deploy config, or status boards.
- Keep the durable record in `.SYSTEMX/status/`, runbooks, and bus summaries.

## Start-of-wave duties

At the start of a wave, Agent 0 should:

1. Set the mission target in `.SYSTEMX/Unified-Setup-Process/intake/07-MASTER-PLAN.md`
   or the active `.SYSTEMX/status/IN_PROGRESS.md` entry.
2. Define the current wave and exit condition.
3. Claim or refresh lanes in `.SYSTEMX/AI/AGENT-MESH-STANDARD.md` and
   `.SYSTEMX/status/IN_PROGRESS.md`.
4. Assign each worker a bounded objective, file/tool scope, and evidence rule.
5. Require each worker to emit a `start` packet before meaningful edits.

## In-wave duties

During the wave, Agent 0 should:

- Watch for quiet lanes, blockers, and overlapping file ownership.
- Prefer the smallest next action over broad speculative expansion.
- Keep subagents inside their assigned lane until a checkpoint says otherwise.
- Use the message bus and status files to keep compact, durable state.

## End-of-wave duties

At the end of a wave, Agent 0 should:

1. Collect every lane outcome as `done`, `partial`, `blocked`, or
   `needs-review`.
2. Merge durable outcomes into `.SYSTEMX/status/` and relevant docs.
3. Archive wave traffic into compact summaries.
4. Open the next wave only if a real follow-on task remains.

## Guardrails

- Agent 0 does not treat subagent output as self-validating truth.
- Agent 0 does not let the message bus become a secret store.
- Agent 0 does not let live chat history replace source-controlled status.
- Agent 0 does not give away release authority just because a tool can deploy.
