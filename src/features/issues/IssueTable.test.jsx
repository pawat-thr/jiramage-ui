import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../services/jiraApi.js', () => ({
  browseUrl: (key) => `https://jira.example.com/browse/${key}`,
}))

const { default: IssueTable } = await import('./IssueTable.jsx')

const issue = (key, type, tier = 0) => ({
  key,
  fields: {
    summary: `Summary for ${key}`,
    status: { name: 'In Dev', statusCategory: { key: 'indeterminate' } },
    priority: { name: 'High' },
    assignee: { displayName: 'Somchai (Golf)' },
    issuetype: { name: type, hierarchyLevel: tier },
  },
})

describe('IssueTable', () => {
  it('shows an empty state when there are no issues', () => {
    render(<IssueTable issues={[]} showAssignee={false} onTransition={() => {}} onReassign={() => {}} />)
    expect(screen.getByText(/No issues match/)).toBeInTheDocument()
  })

  it('groups rows by work type with counts', () => {
    render(
      <IssueTable
        issues={[issue('DX-1', 'Story'), issue('DX-2', 'Story'), issue('DX-3', 'Bug')]}
        showAssignee={false}
        onTransition={() => {}}
        onReassign={() => {}}
      />,
    )
    expect(screen.getByText('Story')).toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2 + 3) // header + 2 group rows + 3 issues
  })

  it('links each key to its Jira issue', () => {
    render(<IssueTable issues={[issue('DX-9', 'Story')]} showAssignee={false} onTransition={() => {}} onReassign={() => {}} />)
    expect(screen.getByRole('link', { name: 'DX-9' })).toHaveAttribute(
      'href',
      'https://jira.example.com/browse/DX-9',
    )
  })

  it('shows priority for my-tasks mode and short assignee name for team mode', () => {
    const { rerender } = render(
      <IssueTable issues={[issue('DX-1', 'Story')]} showAssignee={false} onTransition={() => {}} onReassign={() => {}} />,
    )
    expect(screen.getByText('High')).toBeInTheDocument()
    rerender(
      <IssueTable issues={[issue('DX-1', 'Story')]} showAssignee onTransition={() => {}} onReassign={() => {}} />,
    )
    expect(screen.getByText('Golf')).toBeInTheDocument()
  })
})
