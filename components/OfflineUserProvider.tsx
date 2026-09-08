'use client'

import { createContext, useContext } from 'react'

const OfflineUserContext = createContext<string | null>(null)

export function OfflineUserProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  return <OfflineUserContext.Provider value={userId}>{children}</OfflineUserContext.Provider>
}

export function useOfflineUser() {
  return useContext(OfflineUserContext)
}
