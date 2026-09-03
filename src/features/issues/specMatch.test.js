import { describe, it, expect } from 'vitest'
import { extractAdfLinks, titleFromUrl, bestSpecLink } from './specMatch.js'

const bestSpecUrl = (summary, links) => bestSpecLink(summary, links)?.url ?? null

const SPEC_URL =
  'https://orbitdigital.atlassian.net/wiki/spaces/Merchant/pages/2113568967/R6.1+5+S12+POST+campaigns+v1+mp-merchant+pre-order+orders+get-order-detail?xpis=abc'
const OTHER_URL =
  'https://orbitdigital.atlassian.net/wiki/spaces/Merchant/pages/999/R6.1+5+S12+GET+campaigns+v1+mp-merchant+pre-order+orders+get-order-list'

describe('titleFromUrl', () => {
  it('decodes the page slug into a title', () => {
    expect(titleFromUrl(SPEC_URL)).toBe(
      'R6.1 5 S12 POST campaigns v1 mp-merchant pre-order orders get-order-detail',
    )
  })
  it('returns empty for non-page urls', () => {
    expect(titleFromUrl('https://github.com/org/repo/pull/1')).toBe('')
  })
})

describe('bestSpecUrl', () => {
  const links = [{ url: OTHER_URL }, { url: SPEC_URL }]

  it('matches the real-world subtask to the right spec page', () => {
    expect(bestSpecUrl('[BE][MP] mp-merchant/pre-order/orders/get-order-detail', links)).toBe(
      SPEC_URL,
    )
  })

  it('prefers get-order-list page for the list subtask', () => {
    expect(bestSpecUrl('[BE][MP] mp-merchant/pre-order/orders/get-order-list', links)).toBe(
      OTHER_URL,
    )
  })

  it('ignores short generic subtask names', () => {
    expect(bestSpecUrl('[QA] Test case', links)).toBeNull()
  })

  it('ignores non-Confluence links', () => {
    expect(
      bestSpecUrl('[BE][MP] mp-merchant/pre-order/orders/get-order-detail', [
        { url: 'https://github.com/org/repo/pull/1' },
      ]),
    ).toBeNull()
  })

  it('returns null when nothing clears the threshold', () => {
    expect(bestSpecUrl('[BE] totally unrelated cleanup work', links)).toBeNull()
  })
})

describe('extractAdfLinks', () => {
  it('collects inlineCard urls and link marks', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'inlineCard', attrs: { url: SPEC_URL } },
            { type: 'text', text: 'see', marks: [{ type: 'link', attrs: { href: OTHER_URL } }] },
          ],
        },
      ],
    }
    expect(extractAdfLinks(adf).map((l) => l.url)).toEqual([SPEC_URL, OTHER_URL])
  })
})

describe('viewpage.action remote links (real Jira shape)', () => {
  it('matches on the remote-link title even with a pageId-style url', () => {
    const links = [
      {
        url: 'https://orbitdigital.atlassian.net/wiki/pages/viewpage.action?pageId=2113568967',
        title: '[R6.1#5][S12] POST /campaigns/v1/mp-merchant/pre-order/orders/get-order-detail',
      },
      {
        url: 'https://orbitdigital.atlassian.net/wiki/pages/viewpage.action?pageId=2125988124',
        title: '[R6.1#5][S12] POST /campaigns/v1/mp-merchant/pre-order/orders/list-orders',
      },
    ]
    expect(bestSpecUrl('[BE][MP] mp-merchant/pre-order/orders/get-order-detail', links)).toContain(
      'pageId=2113568967',
    )
  })
})

describe('camelCase GRPC names (real case: DX-32428/DX-32456)', () => {
  const links = [
    { url: 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=2029551618', title: '[R6.1#5][S12] GRPC ReservePreOrder' },
    { url: 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=111', title: '[R6.1#5][S12] GRPC ValidatePreOrderCart' },
    { url: 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=222', title: '[R6.1#5][S12] viewPreOrderCart Service' },
  ]

  it('maps [BE][MP] GRPC ValidatePreOrderCart to its page, not ReservePreOrder', () => {
    expect(bestSpecUrl('[BE][MP] GRPC ValidatePreOrderCart', links)).toContain('pageId=111')
  })

  it('maps ReservePreOrder to its own page', () => {
    expect(bestSpecUrl('[BE][MP] GRPC ReservePreOrder', links)).toContain('pageId=2029551618')
  })
})
