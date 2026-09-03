import { describe, it, expect } from 'vitest'
import { linkParamCount, buildPrompt, DEFAULT_PROMPT_TEMPLATE } from './settingsApi.js'

describe('prompt template', () => {
  it('default template has exactly one {link}', () => {
    expect(linkParamCount(DEFAULT_PROMPT_TEMPLATE)).toBe(1)
  })

  it('counts occurrences', () => {
    expect(linkParamCount('no param')).toBe(0)
    expect(linkParamCount('{link} and {link}')).toBe(2)
  })

  it('builds the prompt with the spec url', () => {
    expect(buildPrompt('enhance {link} please', 'https://x/wiki/p/1')).toBe(
      'enhance https://x/wiki/p/1 please',
    )
  })
})
