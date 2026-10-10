# Known issues — to fix in a version before 0.2.0

> Accepted for local team use (0.1.7 → 0.1.9). Must be resolved (or consciously
> re-accepted) before the 0.2.0 deployment release.

## 1. Integration Plan: last-write-wins on concurrent saves

The plan has no realtime sync (by design — data loads on open / after Sync, edits
save via the explicit 💾 button). If two members edit the **same release** at the
same time, whoever saves second silently overwrites the other's changes for any
row both touched. There is no conflict detection or merge.

*Workaround until fixed:* one owner per release while editing.
*Fix ideas:* per-row `updatedAt` compare-and-warn on save; or field-level merge
(only write fields the user actually changed); or a lightweight presence hint
("Ohm is editing this plan").

Related smaller gap: switching release and closing the tab warn about unsaved
edits, but clicking a **sidebar item** mid-edit unmounts the page and drops them
without warning.

## 2. Concurrent edits, generally (all Firestore-backed editing)

The same last-write-wins behavior applies wherever two people can edit the same
document without a live listener guarding them — most notably **Team Board task
edits** (two members opening Edit Task on the same card: second Save wins whole-doc)
and the shared **Dev Prompt template**. Status-only changes are safe (field-level
updates), and PR comments are append-only, so the exposure is edit forms that
write the whole document.

*Fix ideas:* `updatedAt` optimistic-concurrency check on submit ("this task was
changed while you edited — reload?"); or switch edit-forms to field-diff updates.

## 3. SSO sessions are in-memory (0.1.9, by design for the dev phase)

Atlassian SSO sessions live in the dev server's memory. Restarting
`npm run dev` logs everyone out — the app fails SAFELY (401 + re-login
prompt; your writes can never silently fall back to the shared token), but
expect a one-click re-login after every server restart. Also: the Capacity
Planner's auto-refresh or a long-idle tab may hit the same 401 — reload to
sign in again.

*Fix (0.2.0):* sessions move to Firestore when the standalone server lands.

## 4. Teamage lead checks are client-side (0.1.9 draft)

Leads come from env (`TEAM_LEADS`), which Firestore rules can't read — so
"only leads edit members" is enforced in the UI, while the rules allow any
signed-in member to write `teams/*/members`. Fine for a trusted team; a
malicious member could add/remove members via the API.

*Fix:* Phase C of docs/PLAN-ORG-SSO.md moves teams/leads into Firestore and
locks member writes to the team's lead in rules.

## 5. Team config propagates on reload, not live

Changing Settings → Team configuration reloads YOUR app; teammates get a
"⚙ Team config updated — reload to apply" pill on their next load (the
boot-time cache applies instantly, the fresh doc is compared in the
background). Nobody's running session hot-swaps config — by design, to avoid
torn state. If someone says "the config change didn't work", the answer is:
click the pill / reload.

## 6. Team data isolation is client-side (0.1.9 draft)

Team-rooted filtering (PRs/tasks/inbox/integration scoped to your current
team) happens in the services, not in Firestore rules — any signed-in member
could technically query another team's docs via the API. Same trust level as
the lead checks; hardens in Phase A/C when rules become membership-aware.
It also costs bandwidth as teams grow: the realtime watchers subscribe to
whole collections and filter in memory, so every browser downloads (and
re-receives on every write) all teams' docs. Fine at 1-2 teams; Phase A's
per-team tree (or a `where('team'==…)` + composite indexes) scopes reads
server-side.

## 7. Turning TEAMS off after using teams merges all teams' data

The teams-off passthrough shows EVERY doc (all teams' PRs, tasks, inbox,
plans) — that's correct for a fresh install, but downgrading an installation
that already ran multiple teams merges their histories in one view, and the
Integration Plan can show the same release+story twice (one row per team).
Don't remove `TEAMS` from a multi-team deployment; to really sunset a team,
keep TEAMS and remove its members instead.
