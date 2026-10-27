export type WindowKey = 'd1' | 'd7' | 'd30'

export interface StatBlock {
  pageviews: number
  events: number
  visitors: number
  startAt: number
  endAt: number
}

export interface WindowOverview {
  key: WindowKey
  label: string
  compareLabel: string
  days: number
  current: StatBlock
  previous: StatBlock
  change: {
    pageviews: number | null
    events: number | null
    visitors: number | null
  }
}
