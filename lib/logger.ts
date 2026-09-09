type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE_KEYS = new Set([
  'password',
  'contrasena',
  'token',
  'secret',
  'authorization',
  'cookie',
  'service_role',
  'key',
  'access_token',
  'refresh_token',
])

export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 4) return '[MaxDepth]'
  if (data === null || data === undefined) return data
  if (typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('pass') || lowerKey.includes('token')) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, depth + 1)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: sanitizeLogData(context) } : {}),
  }

  const isProd = process.env.NODE_ENV === 'production'
  const formatted = isProd ? JSON.stringify(payload) : `[${payload.timestamp}] [${level.toUpperCase()}] ${message} ${context ? JSON.stringify(payload.context) : ''}`

  switch (level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'debug':
      if (!isProd) {
        console.debug(formatted)
      }
      break
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
}
