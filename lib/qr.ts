import React from 'react'
import qrcode from 'qrcode-generator'

/**
 * Matriz de módulos de un QR ISO/IEC 18004 (modo byte, corrección de errores nivel M).
 * La codificación (Reed-Solomon, máscara, formato) la hace `qrcode-generator`; aquí solo se adapta a
 * boolean[][] para dibujarla como SVG. El texto debe ser ASCII (los payloads `emilio:oc:<uuid>` lo son).
 */
export function generarMatrizQR(texto: string): boolean[][] {
  const qr = qrcode(0, 'M') // 0 = versión automática (la mínima que quepa)
  qr.addData(texto, 'Byte')
  qr.make()
  const tamano = qr.getModuleCount()
  return Array.from({ length: tamano }, (_, r) =>
    Array.from({ length: tamano }, (_, c) => qr.isDark(r, c))
  )
}

/**
 * Genera un SVG del código QR en string.
 */
export function generarQRSVG(texto: string, tamanoPx = 120, className = ''): string {
  const matriz = generarMatrizQR(texto)
  const modulesCount = matriz.length
  const cellSize = tamanoPx / (modulesCount + 2) // margen de 1 módulo

  let paths = ''
  for (let r = 0; r < modulesCount; r++) {
    for (let c = 0; c < modulesCount; c++) {
      if (matriz[r][c]) {
        const x = (c + 1) * cellSize
        const y = (r + 1) * cellSize
        paths += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tamanoPx} ${tamanoPx}" width="${tamanoPx}" height="${tamanoPx}" class="${className}"><rect width="100%" height="100%" fill="white"/><path d="${paths}" fill="black"/></svg>`
}

/**
 * Componente React nativo para renderizar Códigos QR vectoriales sin peligro de HTML inyectado.
 */
export function QRCodeSvg({
  value,
  size = 96,
  className = '',
  bgColor = '#FFFFFF',
  fgColor = '#0F172A',
}: {
  value: string
  size?: number
  className?: string
  bgColor?: string
  fgColor?: string
}) {
  const matriz = React.useMemo(() => generarMatrizQR(value), [value])
  const count = matriz.length
  const cellSize = size / (count + 2)

  let pathData = ''
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matriz[r][c]) {
        const x = (c + 1) * cellSize
        const y = (r + 1) * cellSize
        pathData += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `
      }
    }
  }

  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${size} ${size}`,
      width: size,
      height: size,
      className,
      'aria-label': `Código QR para ${value}`,
    },
    React.createElement('rect', { width: '100%', height: '100%', fill: bgColor, rx: 4 }),
    React.createElement('path', { d: pathData, fill: fgColor })
  )
}
