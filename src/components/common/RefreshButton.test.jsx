import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RefreshButton from './RefreshButton.jsx'

describe('RefreshButton', () => {
  it('is clickable and labeled Refresh when idle', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RefreshButton refreshing={false} onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: /Refresh/ }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and shows progress while refreshing', () => {
    const onClick = vi.fn()
    render(<RefreshButton refreshing onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /Refreshing…/ })
    expect(btn).toBeDisabled()
    expect(btn.querySelector('.animate-spin')).not.toBeNull()
  })
})
