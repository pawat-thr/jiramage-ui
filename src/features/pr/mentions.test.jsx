import { describe, it, expect } from 'vitest'
import { extractMentionEmails } from './mentions.jsx'
import { CFG } from '../../config/appConfig.js'
import { emailUsername } from '../../utils/format.js'

// CFG comes from the test build's __APP_CONFIG__ — derive expectations from it.
const me = emailUsername(CFG.email)

describe('extractMentionEmails', () => {
  it('finds a mentioned member by username', () => {
    expect(extractMentionEmails(`hey @${me} please check`)).toEqual([CFG.email])
  })

  it('ignores unknown names', () => {
    expect(extractMentionEmails('hey @somebody.unknown please')).toEqual([])
  })

  it('dedupes repeated mentions', () => {
    expect(extractMentionEmails(`@${me} and again @${me}`)).toEqual([CFG.email])
  })

  it('is case-insensitive', () => {
    expect(extractMentionEmails(`ping @${me.toUpperCase()}`)).toEqual([CFG.email])
  })

  it('returns empty for no mentions', () => {
    expect(extractMentionEmails('plain comment, email a@b.c untouched')).toEqual([])
  })
})

// ---- component behavior ----
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MentionText, MentionTextarea } from './mentions.jsx'

describe('MentionText', () => {
  it('highlights real member mentions, leaves unknown names plain', () => {
    render(<MentionText text={`hi @${me} and @not.a.member ok`} />)
    const chip = screen.getByText(`@${me}`)
    expect(chip.className).toContain('text-accent-bright')
    expect(screen.queryByText('@not.a.member')).toBeNull() // stays inside plain text
  })
})

function Harness() {
  const [v, setV] = useState('')
  return <MentionTextarea value={v} setValue={setV} onPost={() => {}} className="x" placeholder="c" />
}

describe('MentionTextarea', () => {
  it('typing @ opens the member dropdown and picking inserts the name', async () => {
    render(<Harness />)
    const ta = screen.getByPlaceholderText('c')
    await userEvent.type(ta, `hey @${me.slice(0, 2)}`)
    const option = await screen.findByRole('button', { name: new RegExp(`@${me}`) })
    await userEvent.click(option)
    expect(ta).toHaveValue(`hey @${me} `)
  })

  it('Escape closes the dropdown', async () => {
    render(<Harness />)
    const ta = screen.getByPlaceholderText('c')
    await userEvent.type(ta, '@')
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
