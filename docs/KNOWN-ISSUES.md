# Known issues — to fix in a version before 0.2.0

> Accepted for local team use in 0.1.7. Must be resolved (or consciously re-accepted)
> before the 0.2.0 deployment release.

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
