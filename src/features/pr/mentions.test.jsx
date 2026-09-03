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
