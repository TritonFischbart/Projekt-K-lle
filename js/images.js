// Bilder fürs Schwarze Brett: auf dem Handy verkleinern, damit sie kostenlos
// in der Datenbank Platz haben (ein Eintrag darf höchstens 1 MB groß sein).

const MAX_CHARS = 900000; // etwas Luft unter der 1-MB-Grenze
const SIZES = [1600, 1280, 1024, 800];
const QUALITIES = [0.82, 0.7, 0.58];

async function loadImage(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file);
    } catch {
      // z. B. ältere Safari-Versionen: unten mit <img> weiter versuchen
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Liefert { data: "data:image/jpeg;base64,…", width, height } oder wirft einen Fehler.
export async function compressImage(file) {
  const source = await loadImage(file);
  const srcW = source.width;
  const srcH = source.height;
  for (const size of SIZES) {
    const scale = Math.min(1, size / Math.max(srcW, srcH));
    const width = Math.round(srcW * scale);
    const height = Math.round(srcH * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // durchsichtige Stellen (z. B. PNG-Grundriss) weiß statt schwarz
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    for (const quality of QUALITIES) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= MAX_CHARS) return { data, width, height };
    }
  }
  throw new Error('Das Bild ist zu groß.');
}
