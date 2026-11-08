// Grayscale and lighten dark header bands so white-on-blue table headings survive OCR.
// This runs on pixels locally; it does not change the original uploaded file.
export function improveContrast(imageData) {
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y += 1) {
    let dark = 0;
    let firstDark = width, lastDark = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const gray = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114);
      if (gray < 180) { dark += 1; firstDark = Math.min(firstDark, x); lastDark = Math.max(lastDark, x); }
    }
    const invert = dark / width > 0.4;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      let gray = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      if (invert && x >= firstDark && x <= lastDark) gray = 255 - gray;
      gray = Math.min(255, Math.max(0, (gray - 128) * 1.25 + 128));
      data[offset] = gray; data[offset + 1] = gray; data[offset + 2] = gray;
    }
  }
  return imageData;
}

// Detect broad coloured/dark bands before grayscale conversion. These often contain
// table headings which a full-page OCR pass may skip as decoration.
export function headingBands({ data, width, height }) {
  const bands = [];
  let start = null;
  for (let y = 0; y <= height; y += 1) {
    let colored = 0;
    if (y < height) for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = data[offset], g = data[offset + 1], b = data[offset + 2];
      const gray = (r + g + b) / 3;
      if ((Math.max(r, g, b) - Math.min(r, g, b) > 25 && gray < 215) || gray < 90) colored += 1;
    }
    if (colored / width > 0.32 && start === null) start = y;
    if ((colored / width <= 0.32 || y === height) && start !== null) {
      if (y - start >= 10 && y - start <= 180) {
        // Separate the table band from a neighbouring sidebar, using colour density.
        const active = [];
        for (let x = 0; x < width; x += 1) {
          let count = 0;
          for (let row = start; row < y; row += 1) {
            const offset = (row * width + x) * 4;
            const r = data[offset], g = data[offset + 1], b = data[offset + 2];
            if ((Math.max(r, g, b) - Math.min(r, g, b) > 25 && (r + g + b) / 3 < 215) || (r + g + b) / 3 < 90) count += 1;
          }
          if (count > (y - start) * 0.25) active.push(x);
        }
        const segments = [];
        for (const x of active) {
          const previous = segments.at(-1);
          if (!previous || x - previous.right > width * 0.01) segments.push({ left: x, right: x });
          else previous.right = x;
        }
        const region = segments.sort((a, b) => (b.right - b.left) - (a.right - a.left))[0];
        if (region && region.right - region.left > width * 0.3) bands.push({ top: start, bottom: y, ...region });
      }
      start = null;
    }
  }
  return bands;
}
