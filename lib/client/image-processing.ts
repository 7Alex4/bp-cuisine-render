'use client'

const MAX_ROOM_DIMENSION = 1600
const MAX_SKETCH_DIMENSION = 1400

export async function prepareRoomImage(file: File): Promise<File> {
  const canvas = await drawFileToCanvas(file, MAX_ROOM_DIMENSION)
  return canvasToFile(canvas, withSuffix(file.name, '-normalized.jpg'), 'image/jpeg', 0.9)
}

export async function prepareSketchImage(file: File): Promise<File> {
  const canvas = await drawFileToCanvas(file, MAX_SKETCH_DIMENSION)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const thresholded = thresholdToLineart(imageData)
  ctx.putImageData(thresholded, 0, 0)

  const bounds = findInkBounds(thresholded, canvas.width, canvas.height)
  if (!bounds) {
    return canvasToFile(canvas, withSuffix(file.name, '-lineart.png'), 'image/png')
  }

  const padding = Math.round(Math.min(canvas.width, canvas.height) * 0.04)
  const cropX = Math.max(0, bounds.x - padding)
  const cropY = Math.max(0, bounds.y - padding)
  const cropWidth = Math.min(canvas.width - cropX, bounds.width + padding * 2)
  const cropHeight = Math.min(canvas.height - cropY, bounds.height + padding * 2)

  const croppedCanvas = document.createElement('canvas')
  croppedCanvas.width = cropWidth
  croppedCanvas.height = cropHeight
  const croppedCtx = croppedCanvas.getContext('2d')
  if (!croppedCtx) throw new Error('2D canvas unavailable')

  croppedCtx.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  )

  return canvasToFile(croppedCanvas, withSuffix(file.name, '-lineart.png'), 'image/png')
}

async function drawFileToCanvas(file: File, maxDimension: number): Promise<HTMLCanvasElement> {
  const source = await loadDrawable(file)
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    closeDrawable(source.drawable)
    throw new Error('2D canvas unavailable')
  }

  ctx.drawImage(source.drawable, 0, 0, width, height)
  closeDrawable(source.drawable)

  return canvas
}

async function loadDrawable(
  file: File,
): Promise<{ drawable: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { drawable: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      // Fallback to HTMLImageElement below.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image decode failed'))
      img.src = objectUrl
    })

    return { drawable: image, width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function closeDrawable(drawable: CanvasImageSource) {
  if ('close' in drawable && typeof drawable.close === 'function') {
    drawable.close()
  }
}

function thresholdToLineart(imageData: ImageData): ImageData {
  const { data, width, height } = imageData
  const histogram = new Array<number>(256).fill(0)
  const grayscale = new Uint8ClampedArray(width * height)

  for (let pixel = 0, index = 0; index < data.length; index += 4, pixel += 1) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const gray = Math.round(red * 0.299 + green * 0.587 + blue * 0.114)
    grayscale[pixel] = gray
    histogram[gray] += 1
  }

  const threshold = Math.min(245, Math.max(150, computeOtsuThreshold(histogram) + 12))

  for (let pixel = 0, index = 0; index < data.length; index += 4, pixel += 1) {
    const value = grayscale[pixel] <= threshold ? 0 : 255
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }

  return imageData
}

function computeOtsuThreshold(histogram: number[]): number {
  const total = histogram.reduce((sum, count) => sum + count, 0)
  let weightedSum = 0
  for (let index = 0; index < histogram.length; index += 1) {
    weightedSum += index * histogram[index]
  }

  let backgroundWeight = 0
  let backgroundSum = 0
  let maxVariance = -1
  let threshold = 180

  for (let index = 0; index < histogram.length; index += 1) {
    backgroundWeight += histogram[index]
    if (backgroundWeight === 0) continue

    const foregroundWeight = total - backgroundWeight
    if (foregroundWeight === 0) break

    backgroundSum += index * histogram[index]
    const backgroundMean = backgroundSum / backgroundWeight
    const foregroundMean = (weightedSum - backgroundSum) / foregroundWeight
    const betweenClassVariance =
      backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance
      threshold = index
    }
  }

  return threshold
}

function findInkBounds(
  imageData: ImageData,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } | null {
  const { data } = imageData
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let darkPixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if (data[index] < 32) {
        darkPixels += 1
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (darkPixels < 100 || maxX < minX || maxY < minY) return null

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

async function canvasToFile(
  canvas: HTMLCanvasElement,
  name: string,
  type: string,
  quality?: number,
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value)
        else reject(new Error('Canvas export failed'))
      },
      type,
      quality,
    )
  })

  return new File([blob], name, { type, lastModified: Date.now() })
}

function withSuffix(filename: string, suffix: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return `${filename}${suffix}`
  return `${filename.slice(0, lastDot)}${suffix}`
}
