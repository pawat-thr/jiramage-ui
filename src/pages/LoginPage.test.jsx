import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage.jsx'

const auth = { error: null, signIn: vi.fn().mockResolvedValue(), activate: vi.fn().mockResolvedValue() }

describe('LoginPage — first-time activation checklist', () => {
  it('submit stays disabled until every rule passes and passwords match', async () => {
    render(<LoginPage auth={auth} />)
    await userEvent.click(screen.getByRole('button', { name: 'First time here' }))
    const submit = screen.getByRole('button', { name: 'Set password & continue' })
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText('Create a strong password'), 'Passw0rd')
    expect(submit).toBeDisabled() // missing special char + confirm

    await userEvent.type(screen.getByPlaceholderText('Create a strong password'), '!')
    await userEvent.type(screen.getByPlaceholderText('Re-enter password'), 'Passw0rd!')
    expect(submit).toBeEnabled()
  })

  it('shows all five checklist rules', async () => {
    render(<LoginPage auth={auth} />)
    await userEvent.click(screen.getByRole('button', { name: 'First time here' }))
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('1 uppercase letter (A–Z)')).toBeInTheDocument()
    expect(screen.getByText('1 number (0–9)')).toBeInTheDocument()
    expect(screen.getByText('1 special character (!@#…)')).toBeInTheDocument()
    expect(screen.getByText('Both passwords match')).toBeInTheDocument()
  })

  it('sign-in mode submits credentials', async () => {
    render(<LoginPage auth={auth} />)
    await userEvent.type(screen.getByPlaceholderText('you@orbitdigital.co.th'), 'me@x.co')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret')
    // two "Sign in" buttons exist (mode tab + submit) — pick the submit one
    const submit = screen.getAllByRole('button', { name: 'Sign in' }).find((b) => b.type === 'submit')
    await userEvent.click(submit)
    expect(auth.signIn).toHaveBeenCalledWith('me@x.co', 'secret')
  })

  it('cross-link switches modes and clears passwords', async () => {
    render(<LoginPage auth={auth} />)
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Activate your account' }))
    expect(screen.getByPlaceholderText('Create a strong password')).toHaveValue('')
  })
})
