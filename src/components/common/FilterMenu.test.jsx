import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterMenu from './FilterMenu.jsx'

describe('FilterMenu', () => {
  it('opens on click and lists All plus the options', async () => {
    const user = userEvent.setup()
    render(<FilterMenu label="Status" value="" options={['Done', 'To Do']} onPick={() => {}} />)
    expect(screen.queryByText('All')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Status/ }))
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('To Do')).toBeInTheDocument()
  })

  it('picks an option, closes, and shows the active value on the chip', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const { rerender } = render(
      <FilterMenu label="Status" value="" options={['Done']} onPick={onPick} />,
    )
    await user.click(screen.getByRole('button', { name: /Status/ }))
    await user.click(screen.getByText('Done'))
    expect(onPick).toHaveBeenCalledWith('Done')
    expect(screen.queryByText('All')).not.toBeInTheDocument()
    rerender(<FilterMenu label="Status" value="Done" options={['Done']} onPick={onPick} />)
    expect(screen.getByRole('button', { name: /Status: Done/ })).toBeInTheDocument()
  })

  it('clears the filter via All', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<FilterMenu label="Status" value="Done" options={['Done']} onPick={onPick} />)
    await user.click(screen.getByRole('button', { name: /Status: Done/ }))
    await user.click(screen.getByText('All'))
    expect(onPick).toHaveBeenCalledWith('')
  })
})
