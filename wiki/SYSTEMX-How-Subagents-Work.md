# How Subagents Work

Subagents are bounded workers or explorers. They do not own the whole mission.
They own one lane at a time and report evidence back to Agent 0.

## What a subagent should receive

Every subagent assignment should include:

- a clear lane name
- allowed files and tools
- a finite objective
- a time or token budget when appropriate
- required completion evidence
- a stop condition
- the next smallest task to start with

## What a subagent should return

Every subagent report should include:

- status: `done`, `partial`, `blocked`, or `needs-review`
- exact scope owned
- exact files changed, or `none`
- commands, tests, files, logs, or sources inspected
- blockers, or `none`
- the next smallest executable action
- mission ID and wave ID when part of parallel work

## Best uses for subagents

- parallel research on disjoint surfaces
- isolated implementation in a narrow file set
- test or verification lanes
- documentation alignment after code changes
- provider- or platform-specific investigation

## Bad uses for subagents

- broad overlapping edits across shared files
- tasks that are too small to justify extra coordination
- secret-heavy or high-risk production operations
- replacing final review or release judgment

## Message bus fit

Subagents work better with a local-first message bus because they can emit
compact packets like `start`, `checkpoint`, `handoff`, `blocked`, and
`complete`. Agent 0 can then summarize and archive those packets instead of
dragging long raw conversations forward forever.
