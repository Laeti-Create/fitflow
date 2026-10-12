# Hybrid integration: audit and staged implementation

Audit baseline: `develop` at `9df56d17a88ca0f256142a72f8ba4d0b768f77bd`.
Working branch: `feature/glute-10k-hybrid`.

## Existing architecture

The app is a static HTML/CSS/native JavaScript-module PWA. Firebase Auth and
Firestore are imported from the CDN. There is no application build step or
backend. Preserve this architecture, the current palette, cards and navigation.

- `app.js`: profile, walking, weight, strength summaries and measurements.
- `nutrition.js` and `nutrition-store.js`: food journal and shared nutrition state.
- Nutrition extensions: search, barcode scanning, favorites, meal templates,
  date controls, hydration and weekly trends.
- `running.js`: recorded runs.
- `running-plan.js`, `running-plan-link.js`, `running-guided.js`: existing fixed
  plan, run links and guided timer. Running is already implemented in part.
- `running-integration.js`, `dashboard-day-summary.js`, `home-coach.js`:
  cross-module summaries and deterministic coaching messages.
- `app-shell.js`, `service-worker.js`: feature loading and PWA updates.

The current running plan is fixed to July/August 2026. Strength records are
summaries, without exercise-level logs. Recovery has no dedicated journal.
Nutrition targets and energy estimates are computed by several scripts.

## Data and hosting constraints

The test deployment copies the same Firebase configuration as the stable app.
It also assembles both stable and test into one Pages deployment. A push to
`develop` is therefore a deployment action, not just a source update.

The checked-in Firestore rules restrict access to the authenticated owner but
do not validate record fields. Live deployed rules were not inspected.
Development and tests must use a demo-project emulator or a dedicated test
project before interactive writes. Do not deploy rules or migrations as part of
this work without the separately required production approval.

## Lot 0: implemented reliability fixes

1. Explicit app-shell loading on the first visit, independent of worker injection.
2. Running deletion by document ID rather than an index of a separately sorted list.
3. One running/integration event binding across authentication callbacks; one
   home-coach focus handler referencing the current user.
4. Failed remote history edits/deletes keep in-memory records; successful
   operations resolve the original record again after asynchronous work.
5. Demo data stays out of authenticated empty history collections.
6. Guided timer keeps separate session and phase pause counters.
7. A changed nutrition target refreshes the budget's base target.
8. Food/favorite unit and portion strings are escaped in the main journal renderer.
9. Service-worker activation and cache repair clean only their own scope, using
   unambiguous new names and recognition of legacy versioned names.
10. A pending running save blocks concurrent submissions.

Application version on this branch: `0.53.0-develop.4`.
Firebase configuration and Firestore rules are unchanged. No data migration.

## Lot 1: shared runtime and repositories

Add shared modules for Firebase initialization/authentication, local dates,
observable state, field validation and record repositories. Move consumers
incrementally behind these adapters, without a framework conversion.

- Explicit production, development-emulator and demo environments. Refuse to
  silently use production credentials from a development environment.
- Separate local draft keys by environment and user; retain existing keys through
  a compatibility reader rather than deleting them.
- Capture the user/environment at operation start; ignore stale results after
  account changes and cancel subscriptions on logout.
- Distinguish pending local drafts, acknowledged saves and failures.
- Stable operation IDs prevent duplicate retries. Detect revision conflicts.
- Limit reads to date windows and paginate history. Share loaded data rather than
  independently downloading complete collections for each card.
- Use local calendar dates consistently. Retain existing recorded dates.

## Compatible schema

All private records remain under `users/{uid}`. New records carry `schemaVersion`,
`createdAt`, `updatedAt`, a revision and stable identifiers.

| Collection | Change |
|---|---|
| `profile`, `walks`, `weights`, `measurements`, `nutritionEntries`, `foodFavorites`, `mealTemplates`, `waterEntries` | Preserve existing records and compatible readers. |
| `strengthSessions` | Extend with program/template/activity references, exercise snapshot and actual sets. Keep old summaries readable. |
| `runs` | Extend with activity/program/source references and planned/actual comparison. Keep existing IDs. |
| `runningPlanSessions` | Preserve historical statuses and links through an adapter. |
| `trainingPrograms` | New versioned strength/running program instances. |
| `workoutTemplates` | New exercise prescriptions and technique/substitution metadata. |
| `plannedActivities` | New shared calendar with original/planned date, type, status and completion reference. |
| `dailyRecovery` | New optional recovery journal by date. |
| `nutritionTargets` | New dated target snapshots and explicitly chosen overrides. |

Avoid creating duplicate `workoutSessions`/`runningSessions` collections alongside
the existing completed-session collections. Completing a planned session writes
the result and calendar status together. Keep a snapshot of the prescription so
future template edits cannot rewrite historical training.

Use write batches for linked unconditional changes and transactions for
revision-dependent updates. Offline edits requiring a revision check stay as
drafts until the conflict check can run online. Never label them saved early.

New security rules need per-collection validation. A narrower rule cannot
override an overlapping owner-wide `allow`: partition the legacy allowance and
new validated paths, then test compatibility in the emulator before any rollout.

## Lot 2: strength

Implement program preview/activation, template editor, planned session detail,
set logging, editable warmups, substitutions, rest timer, drafts and completion.
Exercise names remain English; interface text remains French.

Each prescription distinguishes repetitions, sets, load guidance, RPE/RIR and
rest. Each performed set records what actually happened. Work-set volume is
calculated separately from warmups, with explicit conventions for unilateral,
assisted and bodyweight movements.

Progression is proposed from completed work sets, target reps and effort, and
requires acceptance. Historical summaries without exercise data must not be
used to invent set-level performance. Import the exact program only when the
authoritative A/B/C table is available.

## Lot 3: running and shared planning

Replace duplicated fixed-session definitions with a shared program source.
Preserve the old plan and its recorded statuses. Import the supplied calendar
through a validated preview with source metadata and stable session IDs.
Re-importing the same program does not duplicate sessions or overwrite results.

The calendar supports moves, postponements, skips and completion links. Show
potential scheduling conflicts without silently moving sessions. Deleting a run
must reconcile its linked completion state, including cases with another linked
result. Guided phases require actual workout details; a summary calendar alone
does not specify interval counts, recovery or pace targets.

Running dates and race-date discrepancies must remain visible until resolved.
PDF/JSON/manual input is an import workflow, not an automatic Runna/Garmin sync.

## Lot 4: dynamic nutrition

One pure calculation module supplies Nutrition, Dashboard and Trends.
Choose a day's target from the active schedule and accepted overrides, with an
explicit mixed-day policy. The target explains its source. Completing or moving
a workout triggers recalculation; unaccepted suggestions do not change it.

Training-aware intake targets already include their intended activity allowance.
Do not add exercise calories a second time. Keep estimated energy expenditure
separate from intake targets. Preserve historical target snapshots. Treat missing
food logs as missing, not zero-intake days, in weekly trend statistics.

Maintain existing per-100/portion semantics, journal/favorites/templates/search,
manual correction and hydration. Optional recipe/meal-prep expansion follows
only after the core target and logging flows work reliably.

## Lot 5: recovery

Optional daily sleep, fatigue, soreness, pain and effort inputs. Missing data
must be marked unknown. Read training load from actual session records.
Recommendations are explainable proposals; accepting one creates a program or
calendar revision, and declining one preserves the schedule. Do not infer a
diagnosis, a medical score, or external-device metrics from absent inputs.

## Verification and completion gates

Run `npm test` with Node 22 or newer. Tests use Node's built-in runner, actual
application functions and synthetic SDK/DOM/clock boundaries; no dependencies
need installing and no real Firebase connection is initialized.

Lot 0: 26 tests pass; the same suite has 18 failures on the audit baseline.
CI runs on feature-branch pushes and pull requests to develop, with read-only
repository permissions and no deployment job.

Next gates:
- Firestore emulator: owner/anonymous/other-user access, malformed fields,
  atomic completion and preservation of old-format records.
- Repository tests: account-switch race, retries, conflicts and offline drafts.
- Domain tests: progression, volume, import deduplication, dates, target selection.
- Browser flows: login, old histories, food add/edit/delete, favorites, templates,
  hydration, guided runs and new strength/recovery flows.
- Mobile/PWA: small screens, first install, update, offline restart, timer pause,
  iPhone background behavior and test/stable cache coexistence.

Browser/mobile and emulator-rule tests have not been run in this initial lot.
No production merge, deploy or rule update is part of this branch's publication.
