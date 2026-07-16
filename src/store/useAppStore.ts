import { useContext } from 'react'
import { AppStoreContext } from './AppStoreContext'

export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) throw new Error('useAppStore must be used inside AppStoreProvider')
  return context
}
