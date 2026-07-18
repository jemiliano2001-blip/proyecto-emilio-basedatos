export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <div className="card border-red-300 bg-red-50 text-red-700 mb-4" role="alert">
      {message}
    </div>
  )
}
