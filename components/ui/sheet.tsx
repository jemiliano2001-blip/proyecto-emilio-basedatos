'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

interface SheetContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

function useSheet() {
  const context = React.useContext(SheetContext)
  if (!context) {
    throw new Error('Sheet components must be used within a Sheet')
  }
  return context
}

export interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Sheet({ open: controlledOpen, onOpenChange, children }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>
}

export function SheetTrigger({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useSheet()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (!e.defaultPrevented) {
      setOpen(true)
    }
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

const sheetVariants = cva(
  'fixed z-50 bg-white p-6 shadow-2xl transition-transform duration-200 ease-out flex flex-col',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b border-gray-200 animate-slide-in-top',
        bottom: 'inset-x-0 bottom-0 border-t border-gray-200 rounded-t-2xl max-h-[85vh] animate-slide-in-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r border-gray-200',
        right: 'inset-y-0 right-0 h-full w-full sm:max-w-md border-l border-gray-200 animate-slide-in-right',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
)

export interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sheetVariants> {
  onClose?: () => void
}

export function SheetContent({
  side = 'right',
  className,
  children,
  onClose,
  ...props
}: SheetContentProps) {
  const { open, setOpen } = useSheet()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleClose = React.useCallback(() => {
    setOpen(false)
    onClose?.()
  }, [setOpen, onClose])

  // ESC handler
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  // Scroll lock
  React.useEffect(() => {
    if (!open) return
    const originalStyle = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [open])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div className={cn(sheetVariants({ side }), className)} {...props}>
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Cerrar panel"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 text-left mb-4', className)} {...props} />
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-auto pt-4 border-t border-gray-100', className)}
      {...props}
    />
  )
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-xl font-bold tracking-tight text-navy', className)} {...props} />
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-gray-500 leading-relaxed', className)} {...props} />
}

export function SheetClose({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useSheet()
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    setOpen(false)
  }
  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}
