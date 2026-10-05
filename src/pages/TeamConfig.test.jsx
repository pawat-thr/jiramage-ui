import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Inline validation of the Team config editor: typing a bad WORK_TIME /
// WORK_DAYS shows the error IMMEDIATELY (no submit) and disables Save.
vi.mock('../services/firebase.js', () => ({ db: {}, firebaseEnabled: false }))
vi.mock('../services/configApi.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual, // real CONFIG_FIELDS + validateFieldRaw — validation under test
    loadTeamConfig: async () => ({}),
    loadConfigHistory: async () => [],
    saveTeamConfig: vi.fn(async () => {}),
    logConfigChange: vi.fn(async () => {}),
  }
})

const { TeamConfig } = await import('./SettingsPage.jsx')

const setup = async () => {
  render(<TeamConfig onNotify={() => {}} user={{ email: 'me@x.com' }} />)
  return await screen.findByLabelText('WORK_TIME') // waits for the async load
}

const saveButton = () => screen.getByRole('button', { name: /Save team config/ })

describe('TeamConfig inline validation (no submit needed)', () => {
  it('bad WORK_TIME shows an error while typing and disables Save', async () => {
    const workTime = await setup()
    fireEvent.change(workTime, { target: { value: 'nine to five' } })
    expect(screen.getByText(/must be HH:MM-HH:MM windows/)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()

    // fixing the value clears the error and re-enables Save
    fireEvent.change(workTime, { target: { value: '09:00-17:00' } })
    expect(screen.queryByText(/must be HH:MM-HH:MM windows/)).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('bad WORK_DAYS shows an error while typing and disables Save', async () => {
    await setup()
    const workDays = screen.getByLabelText('WORK_DAYS')
    fireEvent.change(workDays, { target: { value: 'someday' } })
    expect(screen.getByText(/must be day names/)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()

    fireEvent.change(workDays, { target: { value: 'Mon,Tue,Wed' } })
    expect(screen.queryByText(/must be day names/)).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('one bad field keeps Save disabled even when others are valid', async () => {
    const workTime = await setup()
    fireEvent.change(screen.getByLabelText('WORK_DAYS'), { target: { value: 'Mon,Sat' } })
    fireEvent.change(workTime, { target: { value: '13:00-09:00' } }) // ends before start
    expect(screen.getByText(/must be HH:MM-HH:MM windows/)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('other validated fields behave the same (e.g. REFRESH_INTERVAL)', async () => {
    await setup()
    fireEvent.change(screen.getByLabelText('REFRESH_INTERVAL'), { target: { value: '10 min' } })
    expect(screen.getByText(/must be e\.g\. 5m/)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })
})
