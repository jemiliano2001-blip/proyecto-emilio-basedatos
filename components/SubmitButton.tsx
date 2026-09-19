'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { vibrarTap } from '@/lib/haptics'

export function SubmitButton({
  children,
  className = 'w-full',
  variant = 'default',
  disabled = false,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'accent' | 'secondary' | 'destructive'
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      loading={pending}
      disabled={disabled || pending}
      onClick={(e) => {
        vibrarTap()
        onClick?.(e)
      }}
    >
      {pending ? 'Guardando…' : children}
    </Button>
  )
}
