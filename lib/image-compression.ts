/**
 * Utilidad para compresión ligera de fotografías en el cliente.
 * Optimiza imágenes tomadas en obra (cámaras de 12-48 MP) a un tamaño apto
 * para conexiones móviles 3G/4G (máx 1600px de ancho/alto y calidad 82%).
 */
export async function comprimirImagenEnCliente(
  file: File,
  maxDimension = 1600,
  calidad = 0.82
): Promise<File> {
  // Si no es una imagen o no estamos en navegador, retornar el archivo original
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file
  }

  // Si es un SVG o GIF animado, no comprimir por Canvas para preservar vector/animación
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Redimensionar manteniendo proporción si excede el límite
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Intentar compresión a webp, con fallback a jpeg
        const mimeType = 'image/webp'
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Si el archivo comprimido resultó mayor o falló, conservar el original
              resolve(file)
              return
            }

            const extension = blob.type === 'image/webp' ? '.webp' : '.jpg'
            const baseName = file.name.replace(/\.[^/.]+$/, '')
            const nuevoArchivo = new File([blob], `${baseName}${extension}`, {
              type: blob.type,
              lastModified: Date.now(),
            })

            resolve(nuevoArchivo)
          },
          mimeType,
          calidad
        )
      }

      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }

    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}
