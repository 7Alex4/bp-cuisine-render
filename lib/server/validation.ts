/**
 * Input validation helpers for the render API routes.
 */

export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export interface ValidationError {
  field: string
  message: string
}

export function validateImageFile(file: File, fieldName: string): ValidationError | null {
  if (!file || file.size === 0) {
    return { field: fieldName, message: `${fieldName}: fichier requis` }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      field: fieldName,
      message: `${fieldName}: fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 20 Mo.`,
    }
  }

  const mimeType = file.type.toLowerCase()
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      field: fieldName,
      message: `${fieldName}: format invalide (${file.type}). Formats acceptes: JPG, PNG, WebP.`,
    }
  }

  return null
}

export interface Dimensions {
  width: number
  depth: number
  height: number
}

export function parseDimensions(raw: string): { value: Dimensions | null; error: string | null } {
  try {
    const parsed = JSON.parse(raw || '{}')
    const width = Number(parsed.width)
    const depth = Number(parsed.depth)
    const height = Number(parsed.height)

    if (
      !width ||
      !depth ||
      !height ||
      Number.isNaN(width) ||
      Number.isNaN(depth) ||
      Number.isNaN(height) ||
      width <= 0 ||
      depth <= 0 ||
      height <= 0
    ) {
      return {
        value: null,
        error: 'dimensions invalides - format attendu : {"width":4,"depth":5,"height":2.6}',
      }
    }

    return { value: { width, depth, height }, error: null }
  } catch {
    return { value: null, error: 'dimensions: JSON invalide' }
  }
}

export interface MaterialsPayload {
  description: string
}

export function parseMaterials(raw: string): { value: MaterialsPayload; error: string | null } {
  try {
    const parsed = JSON.parse(raw || '{}')
    return { value: { description: (parsed.description as string) || '' }, error: null }
  } catch {
    return { value: { description: '' }, error: 'materials: JSON invalide' }
  }
}
