import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap font-semibold select-none cursor-pointer',
    'transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-[0.98] [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
        accent: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
        secondary: 'bg-card text-foreground border border-border shadow-xs hover:bg-muted hover:border-input',
        destructive: 'bg-danger text-danger-foreground shadow-sm hover:bg-danger/90 focus-visible:ring-danger',
        outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        soft: 'bg-primary-soft text-primary-soft-foreground hover:bg-primary/15',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto min-h-0 active:scale-100',
      },
      size: {
        // Mobile-first: default cumple los 44px táctiles para obra
        default: 'min-h-[44px] px-5 py-2.5 text-base rounded-lg gap-2',
        sm: 'min-h-[40px] px-4 py-2 text-sm rounded-lg gap-1.5',
        xs: 'min-h-[32px] px-3 py-1.5 text-sm rounded-md gap-1.5',
        lg: 'min-h-[48px] px-8 text-base rounded-lg gap-2.5',
        icon: 'min-h-[44px] min-w-[44px] size-11 p-0 rounded-lg justify-center',
        'icon-sm': 'min-h-[36px] min-w-[36px] size-9 p-0 rounded-md justify-center',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isDisabled}
        aria-busy={loading ? 'true' : undefined}
        {...props}
      >
        {loading && (
          <svg
            className="size-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
