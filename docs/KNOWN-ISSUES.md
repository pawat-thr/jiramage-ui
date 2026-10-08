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
