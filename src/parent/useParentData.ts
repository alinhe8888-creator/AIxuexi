import { useContext } from 'react'
import { ParentDataContext } from './ParentDataContextObject'

export function useParentData() {
  const context = useContext(ParentDataContext)
  if (!context) throw new Error('useParentData must be used inside ParentDataProvider')
  return context
}
