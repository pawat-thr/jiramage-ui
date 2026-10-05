import { describe, it, expect } from 'vitest'
import { textToAdf, commentAdf } from './jiraApi.js'

describe('textToAdf (comment body builder)', () => {
  it('wraps plain text in a one-paragraph ADF doc', () => {
    expect(textToAdf('hello')).toEqual({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    })
  })

  it('splits newlines into paragraphs, blank lines stay empty', () => {
    const doc = textToAdf('line one\n\nline two')
    expect(doc.content).toHaveLength(3)
    expect(doc.content[0].content[0].text).toBe('line one')
    expect(doc.content[1].content).toEqual([]) // empty paragraph, no empty text node (Jira rejects those)
    expect(doc.content[2].content[0].text).toBe('line two')
  })
})

describe('textToAdf with mentions', () => {
  it('known @names become real mention nodes; unknown stay text', () => {
    const doc = textToAdf('ping @somjit.r and @stranger', { 'somjit.r': { id: 'acc-123' } })
    const nodes = doc.content[0].content
    expect(nodes).toEqual([
      { type: 'text', text: 'ping ' },
      { type: 'mention', attrs: { id: 'acc-123', text: '@somjit.r' } },
      { type: 'text', text: ' and @stranger' },
    ])
  })

  it('mention at line start and case-insensitive match', () => {
    const doc = textToAdf('@Somjit.R hello', { 'somjit.r': { id: 'x' } })
    expect(doc.content[0].content[0]).toEqual({ type: 'mention', attrs: { id: 'x', text: '@Somjit.R' } })
  })
})

describe('commentAdf with images', () => {
  it('appends one external media block per image, alt = filename', () => {
    const doc = commentAdf('see below', {}, [{ filename: 'shot.png', url: 'https://x/att/1' }])
    expect(doc.content).toHaveLength(2)
    expect(doc.content[1]).toEqual({
      type: 'mediaSingle',
      attrs: { layout: 'center' },
      content: [{ type: 'media', attrs: { type: 'external', url: 'https://x/att/1', alt: 'shot.png' } }],
    })
  })
})
