'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useModalFocus } from '@/lib/hooks/useModalFocus'

interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialog() {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog')
  }
  return context
}

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
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

  return <DialogContext.Provider value={{ open, setOpen, titleId, descriptionId }}>{children}</DialogContext.Provider>
}

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export function DialogTrigger({ children, onClick, ...props }: DialogTriggerProps) {
  const { setOpen } = useDialog()

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

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void
}

export function DialogContent({ className, children, onClose, ...props }: DialogContentProps) {
  const { open, setOpen, titleId, descriptionId } = useDialog()
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

  // ESC key handler
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

  // Lock body scroll when open
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden"
    >
      {/* Backdrop */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className="fixed inset-0 bg-ink/60 backdrop-blur-sm animate-fade-in transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Box */}
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in',
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Cerrar modal"
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

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 text-left mb-4', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-4 border-t border-border/50', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialog()
  return <h2 id={titleId} className={cn('text-xl font-bold tracking-tight text-navy', className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDialog()
  return <p id={descriptionId} className={cn('text-sm text-muted-foreground leading-relaxed', className)} {...props} />
}

export function DialogClose({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDialog()
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
