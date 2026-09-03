import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PromptModal from './PromptModal.jsx'

const URL = 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=42'

describe('PromptModal', () => {
  it('renders the template with {link} replaced by the spec url', () => {
    render(<PromptModal template="enhance {link} now" url={URL} onClose={() => {}} />)
    expect(screen.getByText(`enhance ${URL} now`)).toBeInTheDocument()
    // the spec header links to the page
    expect(screen.getByRole('link')).toHaveAttribute('href', URL)
  })

  it('copies the generated prompt to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.assign(navigator, { clipboard: { writeText } })
    render(<PromptModal template="use {link}" url={URL} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(writeText).toHaveBeenCalledWith(`use ${URL}`)
    expect(screen.getByText('✓ Copied to clipboard')).toBeInTheDocument()
  })

  it('Close and Escape both close', async () => {
    const onClose = vi.fn()
    render(<PromptModal template="t {link}" url={URL} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
