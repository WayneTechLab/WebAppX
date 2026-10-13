# Platform Matrix — unified template 3.4.0

This table separates the intended platform contract from actual validation.
Consult the [3.4.0 validation receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.4.0.md)
for current source/local results. The historical 3.2.0 acceptance ran on macOS
Apple Silicon; its [receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.2.0.md)
retains that earlier scope.
The repository does not ship a GitHub Actions platform-runner matrix; runner
availability or a launcher's presence is not evidence that every platform passed.

| Platform | Current entry points | Acceptance boundary |
| --- | --- | --- |
| macOS Apple Silicon | Node app/LAN/HR commands, Bash managed/WSG launchers, Python tools | Record current checks in the 3.4.0 receipt; historical 3.2.0 checks are separate evidence |
| Windows 11 x64 | Node app/LAN commands; `.SYSTEMX/SYSTEMX.ps1` managed launcher | Target platform; native Windows execution needs its own validation |
| Windows 11 ARM64 | Same entry points; native vendor tools where supplied | Target platform; record any x64 vendor-tool emulation and verify separately |
| Ubuntu/Linux | Node app/LAN, Python managed tools and inspected Bash flows | Experimental/compatibility path; this release has no native Linux acceptance receipt |
| WSL2 | Linux-side Node/Python/Bash with an explicitly chosen workspace | Experimental; validate Windows-host/browser/port boundaries separately |
| Other architectures | Inspect tooling/platform assumptions before adoption | No release acceptance inferred from this Mac run |

## Shared prerequisites and shell boundaries

Use the documented Node.js 24 baseline, npm and Git. The host import/mirror
scripts need Python 3.12 or newer. Firebase emulator sessions also need their
vendor CLI/runtime prerequisites. Optional cloud, browser and payment tools
are separately configured and verified.

The managed PowerShell launcher chooses `py -3`, `python3` or `python`.
The legacy WSG menu and `ci:all` gate use Bash; on Windows use an inspected
Git Bash/WSL path for those scripts while keeping the project scope explicit.
The Node session supervisor can run separately from that menu.

With managed dotSYSTEMX 1.9.0-alpha.6, native Windows Agent Y setup, provider
detection, preparation/run previews and job inspection remain available.
`agent-y run --apply` is unavailable on Windows x64 and ARM64 pending verified
descendant-process termination. Read [Agent Y setup](Agent-Y-New-App-Setup.md)
before preparing a host-bound CLI handoff.

The synthetic HR preview uses the Node/Vite webapp path. Genuine SDK directory
fixtures at `/hr/demo/sdk` are available only in Vite development, not Hosting
or `npm run preview`. Connected portals and the optional Firebase module require
separate adoption and service verification; local mock tests do not establish
cross-platform browser coverage, full SDK workflows or live payroll acceptance.
Read [Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md).

Case-insensitive platforms must retain `.SYSTEMX` casing and use
`webapp-version/`, distinct from the standalone `VERSION` file. Research byte
preservation and immutable snapshot integrity are verified by the template gates.
Five case-sensitive path tests were skipped on the historical 3.2.0 validation Mac;
run those on a case-sensitive filesystem before claiming that lane is verified.

Read [Windows Setup](Windows-Setup.md), [Linux Setup](Linux-Setup.md),
[Quick Start](Quick-Start.md), and [Testing & QA](Testing-and-QA.md).
