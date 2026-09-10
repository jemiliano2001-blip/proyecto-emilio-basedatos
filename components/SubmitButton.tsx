'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function SubmitButton({
  children,
  className = 'w-full',
  variant = 'default',
}: {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'accent' | 'secondary' | 'destructive'
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      loading={pending}
    >
      {pending ? 'Guardando…' : children}
    </Button>
  )
}
