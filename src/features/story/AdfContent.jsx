// Minimal renderer for Atlassian Document Format (Jira v3 descriptions/comments).
// Covers the common nodes; unknown nodes fall back to rendering their children.

function TextNode({ node }) {
  let el = node.text
  for (const mark of node.marks || []) {
    if (mark.type === 'strong') el = <strong>{el}</strong>
    else if (mark.type === 'em') el = <em>{el}</em>
    else if (mark.type === 'strike') el = <s>{el}</s>
    else if (mark.type === 'underline') el = <u>{el}</u>
    else if (mark.type === 'code')
      el = <code className="rounded bg-panel-soft px-1 py-0.5 font-mono text-[13px]">{el}</code>
    else if (mark.type === 'link')
      el = (
        <a
          className="text-accent-bright hover:underline"
          href={mark.attrs?.href}
          target="_blank"
          rel="noreferrer"
        >
          {el}
        </a>
      )
  }
  return el
}

function Node({ node }) {
  const kids = (node.content || []).map((n, i) => <Node key={i} node={n} />)

  switch (node.type) {
    case 'doc':
      return <>{kids}</>
    case 'paragraph':
      return <p className="min-h-[1em] text-sm leading-relaxed text-ink-soft">{kids}</p>
    case 'text':
      return <TextNode node={node} />
    case 'hardBreak':
      return <br />
    case 'heading': {
      const Tag = `h${Math.min(6, node.attrs?.level || 3)}`
      return <Tag className="mt-2 text-sm font-semibold text-ink">{kids}</Tag>
    }
    case 'bulletList':
      return <ul className="list-disc pl-5 text-sm text-ink-soft">{kids}</ul>
    case 'orderedList':
      return <ol className="list-decimal pl-5 text-sm text-ink-soft">{kids}</ol>
    case 'listItem':
      return <li className="my-0.5">{kids}</li>
    case 'codeBlock':
      return (
        <pre className="overflow-x-auto rounded-xl border border-line bg-panel-soft p-3 font-mono text-[13px] text-ink-soft">
          {(node.content || []).map((n) => n.text || '').join('')}
        </pre>
      )
    case 'blockquote':
      return <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-muted">{kids}</blockquote>
    case 'rule':
      return <hr className="border-line" />
    case 'panel':
      return <div className="rounded-xl border border-line bg-panel-soft p-3">{kids}</div>
    case 'mention':
      return <span className="font-medium text-accent-bright">{node.attrs?.text || '@user'}</span>
    case 'emoji':
      return <span>{node.attrs?.text || node.attrs?.shortName || ''}</span>
    case 'status':
      return (
        <span className="rounded border border-line bg-panel-soft px-1.5 text-xs">
          {node.attrs?.text}
        </span>
      )
    case 'inlineCard':
      return (
        <a
          className="text-accent-bright hover:underline"
          href={node.attrs?.url}
          target="_blank"
          rel="noreferrer"
        >
          {node.attrs?.url}
        </a>
      )
    case 'date':
      return <span>{node.attrs?.timestamp ? new Date(Number(node.attrs.timestamp)).toLocaleDateString() : ''}</span>
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>{kids}</tbody>
          </table>
        </div>
      )
    case 'tableRow':
      return <tr>{kids}</tr>
    case 'tableHeader':
      return <th className="border border-line bg-panel-soft px-2.5 py-1.5 text-left font-semibold">{kids}</th>
    case 'tableCell':
      return <td className="border border-line px-2.5 py-1.5 align-top text-ink-soft">{kids}</td>
    case 'taskList':
      return <ul className="pl-1 text-sm text-ink-soft">{kids}</ul>
    case 'taskItem':
      return (
        <li className="my-0.5 list-none">
          <span className="mr-1.5">{node.attrs?.state === 'DONE' ? '☑' : '☐'}</span>
          {kids}
        </li>
      )
    case 'expand':
    case 'nestedExpand':
      return (
        <div className="rounded-xl border border-line p-3">
          {node.attrs?.title && <div className="mb-1 text-sm font-semibold">{node.attrs.title}</div>}
          {kids}
        </div>
      )
    case 'mediaSingle':
    case 'mediaGroup':
    case 'media':
      return (
        <div className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted italic">
          Attachment / image — open the card in Jira to view
        </div>
      )
    default:
      return kids.length ? <>{kids}</> : null
  }
}

export default function AdfContent({ doc }) {
  if (!doc) return <p className="text-sm text-muted italic">No description.</p>
  if (typeof doc === 'string') return <p className="text-sm whitespace-pre-wrap text-ink-soft">{doc}</p>
  return (
    <div className="grid gap-2">
      <Node node={doc} />
    </div>
  )
}
