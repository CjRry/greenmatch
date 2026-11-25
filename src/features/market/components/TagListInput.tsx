import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, TextInput } from '../../../ui'

/** A growing list of short texts (main customers, certifications). */
export function TagListInput({
  id,
  value,
  onChange,
  placeholder,
  label,
}: {
  id?: string
  value: readonly string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Names the add button and remove buttons for screen readers. */
  label: string
}) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (!t) return
    if (!value.includes(t)) onChange([...value, t])
    setText('')
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <TextInput
          id={id}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={add} aria-label={`新增${label}`}>
          新增
        </Button>
      </div>
      {value.length ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-sm bg-sunken py-1 pr-1 pl-2.5 text-sm text-ink">
              {v}
              <button
                type="button"
                className="rounded-sm p-0.5 text-muted hover:bg-line hover:text-ink"
                aria-label={`移除${v}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
