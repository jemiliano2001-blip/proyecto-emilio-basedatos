'use client'

import dynamic from 'next/dynamic'
import type { RolUsuario } from '@/lib/types'

const CommandPalette = dynamic(
  () => import('@/components/CommandPalette').then((module) => module.CommandPalette),
  { ssr: false }
)
const KeyboardShortcutsModal = dynamic(
  () => import('@/components/KeyboardShortcutsModal').then((module) => module.KeyboardShortcutsModal),
  { ssr: false }
)

export function GlobalClientTools({ rol, userId, traspasosDisponibles }: { rol: RolUsuario | null; userId: string; traspasosDisponibles: boolean }) {
  return (
    <>
      <CommandPalette rol={rol} userId={userId} traspasosDisponibles={traspasosDisponibles} />
      <KeyboardShortcutsModal />
    </>
  )
}
