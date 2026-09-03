import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdfContent from './AdfContent.jsx'

const media = (alt) => ({
  type: 'doc',
  content: [{ type: 'mediaSingle', content: [{ type: 'media', attrs: { type: 'file', alt } }] }],
})
const ATTS = [
  { id: '101', filename: 'shot.png', mimeType: 'image/png' },
  { id: '102', filename: 'demo.mov', mimeType: 'video/quicktime' },
  { id: '103', filename: 'spec.pdf', mimeType: 'application/pdf' },
]

describe('AdfContent media rendering', () => {
  it('renders an image inline through the /jira proxy', () => {
    render(<AdfContent doc={media('shot.png')} attachments={ATTS} />)
    const img = screen.getByAltText('shot.png')
    expect(img).toHaveAttribute('src', '/jira/rest/api/3/attachment/content/101')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('clicking an image opens the full-size lightbox; Esc closes it', async () => {
    render(<AdfContent doc={media('shot.png')} attachments={ATTS} />)
    await userEvent.click(screen.getByRole('button'))
    const dialog = screen.getByRole('dialog', { name: 'shot.png' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getAllByAltText('shot.png')).toHaveLength(2) // thumb + full
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders a video player that does not preload the file', () => {
    const { container } = render(<AdfContent doc={media('demo.mov')} attachments={ATTS} />)
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', '/jira/rest/api/3/attachment/content/102')
    expect(video).toHaveAttribute('preload', 'metadata')
    expect(video).toHaveAttribute('controls')
  })

  it('renders other file types as a filename link', () => {
    render(<AdfContent doc={media('spec.pdf')} attachments={ATTS} />)
    const link = screen.getByRole('link', { name: /spec\.pdf/ })
    expect(link).toHaveAttribute('href', '/jira/rest/api/3/attachment/content/103')
  })

  it('falls back to a named placeholder when no attachment matches', () => {
    render(<AdfContent doc={media('renamed.png')} attachments={ATTS} />)
    expect(screen.getByText(/renamed\.png — open the card in Jira/)).toBeInTheDocument()
  })

  it('still renders plain text docs', () => {
    render(
      <AdfContent
        doc={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }}
      />,
    )
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
