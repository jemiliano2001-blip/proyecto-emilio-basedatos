'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FileUploaderProps {
  onFilesSelected?: (files: File[]) => void
  accept?: string
  maxSizeMb?: number
  multiple?: boolean
  label?: string
  hint?: string
  className?: string
}

export function FileUploader({
  onFilesSelected,
  accept,
  maxSizeMb = 10,
  multiple = false,
  label = 'Subir documentos o evidencias',
  hint = 'Arrastra tus archivos aquí o haz clic para explorar (PDF, XML, JPG, PNG hasta 10MB)',
  className,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [files, setFiles] = React.useState<{ file: File; progress: number; status: 'uploading' | 'done' | 'error' }[]>([])
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const processFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return
    setErrorMessage(null)

    const validFiles: File[] = []
    const newItems: typeof files = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i]
      if (f.size > maxSizeMb * 1024 * 1024) {
        setErrorMessage(`El archivo "${f.name}" excede el límite de ${maxSizeMb}MB.`)
        continue
      }
      validFiles.push(f)
      newItems.push({ file: f, progress: 0, status: 'uploading' })
    }

    if (newItems.length > 0) {
      setFiles((prev) => (multiple ? [...prev, ...newItems] : newItems))
      onFilesSelected?.(validFiles)

      // Simular progreso suave
      newItems.forEach((item) => {
        let currentProgress = 0
        const interval = setInterval(() => {
          currentProgress += Math.floor(Math.random() * 25) + 15
          if (currentProgress >= 100) {
            currentProgress = 100
            clearInterval(interval)
            setFiles((prev) =>
              prev.map((it) => (it.file === item.file ? { ...it, progress: 100, status: 'done' } : it))
            )
          } else {
            setFiles((prev) =>
              prev.map((it) => (it.file === item.file ? { ...it, progress: currentProgress } : it))
            )
          }
        }, 150)
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  const removeFile = (fileToRemove: File) => {
    setFiles((prev) => prev.filter((it) => it.file !== fileToRemove))
  }

  return (
    <div className={cn('w-full flex flex-col gap-3', className)}>
      {label && <label className="field-label">{label}</label>}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 cursor-pointer select-none',
          isDragging
            ? 'border-primary bg-primary-soft/60 scale-[1.01] shadow-elevated'
            : 'border-border/80 bg-muted/20 hover:border-amber-300 hover:bg-amber-50/30'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => processFiles(e.target.files)}
          className="hidden"
        />

        <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100/70 text-amber-800 mb-3 shadow-xs">
          <svg className="size-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <p className="text-sm font-semibold text-foreground">
          <span className="text-primary hover:underline">Haz clic para subir</span> o arrastra tus archivos
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{hint}</p>
      </div>

      {errorMessage && (
        <p className="field-error">
          <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errorMessage}
        </p>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {files.map(({ file, progress, status }) => (
            <div
              key={file.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-foreground truncate">{file.name}</span>
                    <span className="text-muted-foreground ml-2 font-mono">
                      {status === 'done' ? 'Listo' : `${progress}%`}
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        status === 'done' ? 'bg-success' : 'bg-primary'
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeFile(file)}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Eliminar archivo"
                aria-label={`Eliminar ${file.name}`}
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
