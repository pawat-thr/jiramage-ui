import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let photo = null
vi.mock('../../services/profilesApi.js', () => ({
  photoOf: () => photo,
  subscribeProfiles: () => () => {},
  startProfiles: () => {},
}))

const { default: Avatar } = await import('./Avatar.jsx')

describe('Avatar', () => {
  it('falls back to initials on the deterministic color when no photo', () => {
    photo = null
    render(<Avatar id="pawat.t@x.com" name="pawat.t" className="size-6" />)
    const el = screen.getByTitle('pawat.t')
    expect(el.tagName).toBe('SPAN')
    expect(el.textContent).toBe('PA') // the classic "PA in yellow"
    expect(el.style.background).toBeTruthy()
  })

  it('renders the profile photo when one exists', () => {
    photo = 'data:image/jpeg;base64,xyz'
    render(<Avatar id="pawat.t@x.com" name="pawat.t" className="size-6" />)
    const img = screen.getByAltText('pawat.t')
    expect(img.tagName).toBe('IMG')
    expect(img.src).toContain('data:image/jpeg')
  })
})
