'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface UseInlineEditOptions<T> {
  initialValue: T
  onSave: (value: T) => Promise<boolean | void> | boolean | void
  validate?: (value: T) => string | null
}

export function useInlineEdit<T extends string | number>({
  initialValue,
  onSave,
  validate,
}: UseInlineEditOptions<T>) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState<T>(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const startEditing = useCallback(() => {
    setValue(initialValue)
    setError(null)
    setIsEditing(true)
  }, [initialValue])

  const cancelEditing = useCallback(() => {
    setValue(initialValue)
    setError(null)
    setIsEditing(false)
  }, [initialValue])

  const save = useCallback(async () => {
    if (validate) {
      const validationError = validate(value)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    try {
      setIsSaving(true)
      const result = await onSave(value)
      if (result === false) {
        return
      }
      setIsEditing(false)
      setError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setError(msg)
    } finally {
      setIsSaving(false)
    }
  }, [onSave, validate, value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEditing()
      }
    },
    [save, cancelEditing]
  )

  return {
    isEditing,
    value,
    setValue,
    error,
    isSaving,
    inputRef,
    startEditing,
    cancelEditing,
    save,
    handleKeyDown,
  }
}
