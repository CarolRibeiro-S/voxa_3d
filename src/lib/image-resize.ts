// Só roda no navegador (canvas). Reduz a foto antes do envio: lado maior de 1200 px e WebP com
// qualidade 0,8 (JPEG se o navegador não souber gerar WebP). Meta de até 400 KB.

const MAX_SIDE = 1200;
const TARGET_BYTES = 400 * 1024;
const QUALITIES = [0.8, 0.65, 0.5];

export type PreparedPhoto = { ok: true; blob: Blob; previewUrl: string } | { ok: false; message: string };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareModelPhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "Escolha um arquivo de imagem." };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, message: "Não foi possível ler essa imagem. Tente outra." };
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { ok: false, message: "Não foi possível preparar a imagem." };
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of QUALITIES) {
    blob = await toBlob(canvas, "image/webp", quality);
    // Navegador sem suporte a WebP devolve PNG: troca por JPEG.
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) return { ok: false, message: "Não foi possível preparar a imagem." };

  return { ok: true, blob, previewUrl: URL.createObjectURL(blob) };
}
