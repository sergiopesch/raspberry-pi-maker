# Electronics Enthusiast Lifecycle

Raspberry Pi Maker treats a project as a lifecycle, not a one-off wiring answer.
Use `pi_lifecycle_guide` for the current stage and `pi_project_plan` for a
project-specific staged plan.

## Choose

Translate the desired outcome into compute, real-time, I/O, camera/display,
network, storage, thermal, mechanical, availability, and budget requirements.
Decide whether the project needs a Linux computer, a deterministic
microcontroller, or both. Compare exact variants before buying.

Exit when the board, modules, power architecture, and critical compatibility
assumptions are backed by authoritative sources.

## Setup

Image or flash from an official source, apply updates, record versions, and
prove console or network access. Enable only the interfaces the project needs.

Exit when the board boots repeatably and baseline identity, power, storage,
network, temperature, and interface checks are recorded.

## Design

Create a power budget and pin map. Check logic levels, absolute maximum ratings,
pull resistors, current limiting, level shifting, flyback protection, driver
stages, grounding, connector orientation, and mechanical clearance.

Exit when every net has a source, destination, voltage, direction, and
protection decision, with blockers resolved before power is applied.

## Build

Wire with power removed, use clear colour conventions, add one component at a
time, and photograph or diagram the physical build before energising it.

Exit when the as-built circuit matches the reviewed pin map and passes
continuity, polarity, and short checks.

## Code

Start with a minimal probe using a maintained library. Keep pin assignments and
hardware assumptions explicit, add timeouts and cleanup paths, and avoid tight
busy loops.

Exit when each component works independently from a reproducible command with
useful diagnostic output.

## Test

Combine components incrementally. Test nominal behavior, disconnects, restarts,
bad inputs, thermal load, power recovery, and the intended runtime duration.
Record expected versus actual results.

Exit when acceptance criteria pass repeatedly and known limits are documented.

## Debug

Work from power and physical wiring upward through interface detection,
minimal probes, application code, and service configuration. Change one
variable at a time and preserve the failing evidence.

Exit when the root cause and fix are reproducible, not merely when the symptom
temporarily disappears.

## Deploy

Only promote a proven foreground command into service mode. Use explicit users,
paths, environment, permissions, restart limits, logs, safe shutdown behavior,
and a rollback path.

Exit when cold boot, restart, network loss, power recovery, and observation
paths have been tested.

## Maintain

Track OS, firmware, dependencies, pin maps, spares, backups, logs, and physical
inspection. Re-test after upgrades rather than assuming compatibility.

Exit only when the system is intentionally retired or replaced.

## Retire

Stop services, remove secrets, back up required data, shut down cleanly,
disconnect power, label reusable modules, handle storage appropriately, and
recycle failed electronics through a suitable e-waste route.

Exit when data, credentials, batteries, storage, and reusable hardware have all
been handled deliberately.
