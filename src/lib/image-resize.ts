/**
 * Reduce una foto del celular (varios MB) a JPEG ≤ maxSide px antes de
 * mandarla a la IA: menos datos por la red y dentro del límite de Server Actions.
 * Sólo cliente (usa canvas).
 */
export interface ResizedImage {
  mimeType: "image/jpeg";
  /** base64 sin el prefijo data: */
  data: string;
  /** data URL para la vista previa */
  previewUrl: string;
}

export const resizeImageFile = async (
  file: File,
  maxSide = 1024,
  quality = 0.8,
): Promise<ResizedImage> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite procesar la imagen.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const previewUrl = canvas.toDataURL("image/jpeg", quality);
  return {
    mimeType: "image/jpeg",
    data: previewUrl.slice(previewUrl.indexOf(",") + 1),
    previewUrl,
  };
};
