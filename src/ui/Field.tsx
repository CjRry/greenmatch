import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

const control =
  'w-full rounded-sm border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus:border-brand focus:outline-none aria-[invalid=true]:border-danger'

/** Label + control + hint/error. Pass the control as a render function to receive its id. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': hint || error ? descId : undefined })}
      {error ? (
        <p id={descId} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, 'h-10', className)} {...rest} />
}

export function TextArea({ className, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cx(control, 'py-2 leading-relaxed', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

/** Multi-select as toggle chips (equipment types, cities, ...). */
export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  label,
  single = false,
}: {
  options: readonly { value: V; label: string }[]
  value: readonly V[]
  onChange: (next: V[]) => void
  /** Accessible group name. */
  label: string
  single?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(single ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx(
              'rounded-sm border px-3 py-1.5 text-sm transition-colors',
              on ? 'border-brand bg-brand-soft font-medium text-brand-strong' : 'border-line-strong bg-surface text-ink-soft hover:border-brand',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
