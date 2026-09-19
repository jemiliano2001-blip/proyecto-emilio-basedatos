/**
 * Utilidad segura para retroalimentación háptica / táctil (Web Vibration API).
 * Diseñada para dispositivos móviles en campo (Android / iOS PWA).
 * Totalmente segura en SSR y navegadores de escritorio sin arrojar excepciones.
 */

export function puedeVibrar(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
}

/** Vibración sutil de 20ms para botones, chips y navegación rápida */
export function vibrarTap(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate(20)
  } catch {
    return false
  }
}

/** Vibración doble de confirmación de éxito (guardado, recepción completada, foto añadida) */
export function vibrarExito(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate([25, 40, 25])
  } catch {
    return false
  }
}

/** Vibración de advertencia o confirmación de acción importante */
export function vibrarAlerta(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate([50, 60, 50])
  } catch {
    return false
  }
}

/** Vibración de error o validación rechazada */
export function vibrarError(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate([80, 50, 80])
  } catch {
    return false
  }
}
