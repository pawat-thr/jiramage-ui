import { describe, it, expect } from 'vitest'
import { validatePassword } from './password.js'

describe('validatePassword', () => {
  it('accepts a password meeting every rule', () => {
    expect(validatePassword('Secret1!')).toBeNull()
    expect(validatePassword('Str0ng@Pass')).toBeNull()
  })

  it('rejects short passwords', () => {
    expect(validatePassword('Ab1!')).toMatch(/at least 8/i)
    expect(validatePassword('')).toMatch(/at least 8/i)
  })

  it('requires an uppercase letter', () => {
    expect(validatePassword('secret1!')).toMatch(/uppercase/i)
  })

  it('requires a number', () => {
    expect(validatePassword('Secret!!')).toMatch(/number/i)
  })

  it('requires a special character', () => {
    expect(validatePassword('Secret12')).toMatch(/special/i)
  })
})
