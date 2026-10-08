import { useEffect, useState } from 'react'
import Avatar from '../components/common/Avatar.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { leadTeamOf, leadsOf, watchMembers, addMember, removeMember } from '../services/teamsApi.js'
import { emailUsername } from '../utils/format.js'
import { card } from '../utils/ui.js'

const inputCls =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:border-accent'

// Teamage — team membership management. Leads (from env TEAM_LEADS) manage
// THEIR team's members here; members are Firestore docs. Login stays the
// Firebase Auth whitelist — adding someone here gives them a TEAM (what they
// see after login), it does not grant login itself.
export default function TeamagePage({ user, onNotify }) {
  const team = leadTeamOf(user?.email)
  const [members, setMembers] = useState(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // email pending removal

  useEffect(() => {
    if (!team) return
    return watchMembers(team, setMembers, (e) => onNotify(e.message, true))
  }, [team])

  if (!team)
    return (
      <div className={card}>
        <div className="px-4 py-12 text-center text-muted">
          Teamage is for team leads — your account isn't a lead of any team
          (env <code className="text-accent-bright">TEAM_LEADS</code>).
        </div>
      </div>
    )

  const leads = leadsOf(team)
  const add = async (e) => {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return onNotify('Enter a valid email', true)
    if (leads.includes(addr)) return onNotify(`${addr} is a lead — already in the team`, true)
    if (members?.some((m) => m.email === addr)) return onNotify(`${addr} is already a member`, true)
    setBusy(true)
    try {
      await addMember(team, addr, user.email)
      setEmail('')
      onNotify(`✓ ${emailUsername(addr)} added to ${team.toUpperCase()} — they'll see the team on their next reload`)
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div className={card}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">
            Team <span className="text-accent-bright uppercase">{team}</span>
          </h2>
          <span className="text-xs text-muted">
            {(members?.length ?? 0) + leads.length} people
          </span>
        </div>
        <div className="grid gap-4 p-5">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Lead{leads.length === 1 ? '' : 's'}</span>
            <div className="flex flex-wrap gap-2">
              {leads.map((l) => (
                <span key={l} className="flex items-center gap-2 rounded-full border border-violet/50 bg-violet-soft py-1 pr-3 pl-1 text-[13px] text-violet">
                  <Avatar id={l} name={emailUsername(l)} className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-bg" />
                  {emailUsername(l)}
                  {l === user.email.toLowerCase() && <span className="opacity-70">(you)</span>}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={add} className="flex gap-2">
            <input
              className={inputCls}
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="shrink-0 rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Adding…' : '+ Add member'}
            </button>
          </form>
          <p className="-mt-2 text-xs text-muted">
            Adding here decides WHICH TEAM they see. Login access itself is the
            Firebase Auth whitelist (Console → Authentication → Users) — make
            sure the person exists there too.
          </p>

          <div className="grid gap-2">
            {members === null && <p className="text-[13px] text-muted">Loading members…</p>}
            {members?.length === 0 && (
              <p className="text-[13px] text-muted">No members yet — add your first teammate above.</p>
            )}
            {members?.map((m) => (
              <div
                key={m.email}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-field px-4 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar id={m.email} name={emailUsername(m.email)} className="grid size-6 place-items-center rounded-full text-[10px] font-bold text-bg" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{emailUsername(m.email)}</span>
                    <span className="block truncate text-xs text-muted">{m.email}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {m.addedBy && (
                    <span className="text-xs text-muted max-sm:hidden">
                      added by {emailUsername(m.addedBy)}
                    </span>
                  )}
                  <button
                    className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-ink-soft hover:border-danger hover:text-danger"
                    onClick={() => setConfirm(m.email)}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={`Remove ${emailUsername(confirm)} from ${team.toUpperCase()}?`}
          message="They stay on the login whitelist but will land on the no-team page until added to a team again."
          confirmLabel="Remove"
          onConfirm={async () => {
            try {
              await removeMember(team, confirm)
              onNotify(`✓ ${emailUsername(confirm)} removed from ${team.toUpperCase()}`)
            } catch (err) {
              onNotify(err.message, true)
            }
            setConfirm(null)
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
