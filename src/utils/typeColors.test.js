import { describe, it, expect } from 'vitest'
import { typeColor } from './typeColors.js'

describe('typeColor', () => {
  it('gives canonical colors to well-known types, case-insensitively', () => {
    expect(typeColor('Epic').fg).toBe('#a78bfa')
    expect(typeColor('story').fg).toBe('#6cb0f0')
    expect(typeColor('Bug').fg).toBe('#ff8a7a')
  })

  it('maps Bug variants to the same color', () => {
    expect(typeColor('BugSIT').fg).toBe(typeColor('Bug').fg)
    expect(typeColor('Sub-task').fg).toBe(typeColor('Subtask').fg)
  })

  it('assigns unknown types a stable color from the palette', () => {
    const a = typeColor('Service request')
    expect(typeColor('Service request')).toEqual(a)
    expect(a.fg).toMatch(/^#[0-9a-f]{6}$/)
    expect(a.soft).toMatch(/^#[0-9a-f]{6}$/)
  })
})
