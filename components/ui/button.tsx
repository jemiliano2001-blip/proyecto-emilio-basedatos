import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-navy text-white hover:bg-navy/90 shadow-sm',
        accent: 'bg-teal text-white hover:bg-teal/90 shadow-sm',
        secondary: 'bg-white text-navy border border-gray-300 hover:bg-gray-50 shadow-sm',
        destructive: 'bg-danger text-white hover:bg-red-700 shadow-sm focus-visible:ring-danger',
        outline: 'border border-gray-300 bg-transparent text-gray-900 hover:bg-gray-100',
        ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200',
        link: 'text-accent underline-offset-4 hover:underline p-0 h-auto min-h-0 active:scale-100',
      },
      size: {
        // Mobile-first: default cumple los 44px mínimos táctiles para obra
        default: 'min-h-[44px] px-5 py-3 text-base rounded-lg gap-2',
        sm: 'min-h-[44px] px-3 text-sm rounded-md gap-1.5',
        lg: 'min-h-[48px] h-12 px-8 text-base rounded-lg gap-2.5',
        icon: 'min-h-[44px] min-w-[44px] size-11 p-0 rounded-lg justify-center',
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
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
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
