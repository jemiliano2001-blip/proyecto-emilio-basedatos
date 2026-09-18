'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { useModalFocus } from '@/lib/hooks/useModalFocus'

interface SheetContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descriptionId: string
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
  const titleId = React.useId()
  const descriptionId = React.useId()
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

  return <SheetContext.Provider value={{ open, setOpen, titleId, descriptionId }}>{children}</SheetContext.Provider>
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
  'fixed z-50 bg-card p-6 shadow-2xl transition-transform duration-200 ease-out flex flex-col',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b border-border animate-slide-in-top',
        bottom: 'inset-x-0 bottom-0 border-t border-border rounded-t-2xl max-h-[85vh] animate-slide-in-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r border-border',
        right: 'inset-y-0 right-0 h-full w-full sm:max-w-md border-l border-border animate-slide-in-right',
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
  const { open, setOpen, titleId, descriptionId } = useSheet()
  const [mounted, setMounted] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  useModalFocus(open, contentRef)

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
    <div className="fixed inset-0 z-50 flex print:hidden" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div ref={contentRef} tabIndex={-1} className={cn(sheetVariants({ side }), className)} {...props}>
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
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
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-auto pt-4 border-t border-border/50', className)}
      {...props}
    />
  )
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useSheet()
  return <h2 id={titleId} className={cn('text-lg font-semibold tracking-tight text-foreground sm:text-xl', className)} {...props} />
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useSheet()
  return <p id={descriptionId} className={cn('text-sm text-muted-foreground leading-relaxed', className)} {...props} />
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
