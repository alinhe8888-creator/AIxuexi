import { createContext } from 'react'
import type { ParentChildSummary, ParentDashboard } from '../types'

export interface ParentDataValue {
  children: ParentChildSummary[]
  selectedChildId: string
  dashboard: ParentDashboard | null
  loading: boolean
  error: string
  setSelectedChildId: (id: string) => void
  refresh: () => Promise<void>
  linkChild: (code: string) => Promise<void>
  unlinkChild: (id: string) => Promise<void>
}

export const ParentDataContext = createContext<ParentDataValue | null>(null)
