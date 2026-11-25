import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'navy'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap transition-colors select-none disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'text-ink-soft hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-surface hover:opacity-90',
  navy: 'bg-navy text-on-navy hover:bg-navy-strong',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-12 px-6 text-base',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string): string {
  return cx(base, variants[variant], sizes[size], extra)
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  /** Shows a spinner and disables the button. */
  busy?: boolean
}

export function Button({ variant = 'primary', size = 'md', icon, busy, className, children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button type={type ?? 'button'} className={buttonClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  )
}

/** A router link styled as a button. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
}: {
  to: string
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {icon}
      {children}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  )
}
