import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemberPicker from './MemberPicker.jsx'

const members = (n) => Array.from({ length: n }, (_, i) => `member${i + 1}.x@team.co`)

describe('MemberPicker', () => {
  it('small team: no filter box, pills toggle', async () => {
    const onToggle = vi.fn()
    render(<MemberPicker members={members(3)} selected={[]} onToggle={onToggle} />)
    expect(screen.queryByPlaceholderText(/Filter/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /member2\.x/ }))
    expect(onToggle).toHaveBeenCalledWith('member2.x@team.co')
  })

  it('8+ members: filter box appears and narrows the list', async () => {
    render(<MemberPicker members={members(9)} selected={[]} onToggle={() => {}} />)
    const filter = screen.getByPlaceholderText('Filter 9 members…')
    await userEvent.type(filter, 'member3')
    const pills = screen.getAllByRole('button')
    expect(pills).toHaveLength(1)
    expect(pills[0]).toHaveTextContent('member3.x')
  })

  it('no-match filter shows an empty message', async () => {
    render(<MemberPicker members={members(9)} selected={[]} onToggle={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText(/Filter/), 'zzz')
    expect(screen.getByText(/No member matches/)).toBeInTheDocument()
  })

  it('selected members float up as chips with remove + clear all', async () => {
    const onToggle = vi.fn()
    const sel = ['member1.x@team.co', 'member2.x@team.co']
    render(<MemberPicker members={members(3)} selected={sel} onToggle={onToggle} />)
    expect(screen.getByText('2 picked:')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove member1.x' }))
    expect(onToggle).toHaveBeenCalledWith('member1.x@team.co')
    await userEvent.click(screen.getByRole('button', { name: 'clear all' }))
    expect(onToggle).toHaveBeenCalledWith('member2.x@team.co')
    expect(onToggle.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('empty hint shows when nobody picked', () => {
    render(<MemberPicker members={members(2)} selected={[]} onToggle={() => {}} emptyHint="Pick one!" />)
    expect(screen.getByText('Pick one!')).toBeInTheDocument()
  })
})
