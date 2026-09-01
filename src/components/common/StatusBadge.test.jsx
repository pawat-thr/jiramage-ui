import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge.jsx'

const status = (name, cat) => ({ name, statusCategory: { key: cat } })

describe('StatusBadge', () => {
  it('shows the status name', () => {
    render(<StatusBadge status={status('In Dev', 'indeterminate')} />)
    expect(screen.getByText('In Dev')).toBeInTheDocument()
  })

  it('colors by category: blue for in-progress, green for done, slate for to-do', () => {
    const { rerender } = render(<StatusBadge status={status('In Dev', 'indeterminate')} />)
    expect(screen.getByText('In Dev').className).toContain('text-blue')
    rerender(<StatusBadge status={status('Done', 'done')} />)
    expect(screen.getByText('Done').className).toContain('text-success-bright')
    rerender(<StatusBadge status={status('To Do', 'new')} />)
    expect(screen.getByText('To Do').className).toContain('text-slate')
  })

  it('falls back to the to-do style for unknown categories', () => {
    render(<StatusBadge status={{ name: 'Weird' }} />)
    expect(screen.getByText('Weird').className).toContain('text-slate')
  })
})
