'use client';
/** Shrinks a photo on the iPad before uploading so pages load fast. */
export async function resizeImage(file: File, maxSize = 1600, keepTransparency = false): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that photo.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const type = keepTransparency ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that photo.'))), type, 0.86),
    );
    return new File([blob], keepTransparency ? 'image.png' : 'image.jpg', { type });
  } finally {
    URL.revokeObjectURL(url);
  }
}
