import * as THREE from 'three';
import { hash2d, mulberry32 } from '../utils';

function canvasTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  nearest = true,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  texture.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = !nearest;
  texture.needsUpdate = true;
  return texture;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createAsphaltTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const rng = mulberry32(8123);
  ctx.fillStyle = '#39464b';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 920; i += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const tone = rng();
    ctx.fillStyle = tone > 0.75 ? '#4b585c' : tone > 0.45 ? '#303c41' : '#566266';
    ctx.fillRect(x, y, 1 + (rng() > 0.8 ? 1 : 0), 1);
  }
  for (let i = 0; i < 18; i += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    ctx.fillStyle = 'rgba(20, 28, 31, 0.6)';
    ctx.fillRect(x, y, 2 + Math.floor(rng() * 8), 1);
    ctx.fillRect(x + 2, y + 1, 1 + Math.floor(rng() * 5), 1);
  }
  const texture = canvasTexture(canvas, 1, 1, true);
  texture.anisotropy = 1;
  return texture;
}

export function createShoulderTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const rng = mulberry32(4421);
  ctx.fillStyle = '#8d744b';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 440; i += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    ctx.fillStyle = rng() > 0.55 ? '#a78655' : '#6d5839';
    ctx.fillRect(x, y, 1 + (rng() > 0.9 ? 1 : 0), 1);
  }
  return canvasTexture(canvas, 3, 3, true);
}

export function createCurbTexture(): THREE.CanvasTexture {
  const canvas = makeCanvas(32, 8);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#f1dfb9';
  ctx.fillRect(0, 0, 32, 8);
  ctx.fillStyle = '#e25e39';
  ctx.fillRect(16, 0, 16, 8);
  ctx.fillStyle = '#b5442b';
  ctx.fillRect(16, 6, 16, 2);
  ctx.fillStyle = '#d3c09a';
  ctx.fillRect(0, 6, 16, 2);
  return canvasTexture(canvas, 1, 1, true);
}

export function createGridTexture(): THREE.CanvasTexture {
  const canvas = makeCanvas(128, 16);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  for (let x = 0; x < 16; x += 1) {
    for (let y = 0; y < 2; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f5ebd2' : '#17222a';
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  return canvasTexture(canvas, 1, 1, true);
}

export function createCheckerTexture(): THREE.CanvasTexture {
  const canvas = makeCanvas(64, 64);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 8; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f5ebd2' : '#15222a';
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  return canvasTexture(canvas, 1, 1, true);
}

export function createBoostTexture(): THREE.CanvasTexture {
  const canvas = makeCanvas(96, 48);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 96, 48);
  for (let i = 0; i < 3; i += 1) {
    const x = 14 + i * 26;
    ctx.fillStyle = i === 2 ? '#f5ebd2' : '#ff8f3d';
    ctx.beginPath();
    ctx.moveTo(x, 6);
    ctx.lineTo(x + 18, 24);
    ctx.lineTo(x, 42);
    ctx.lineTo(x + 7, 24);
    ctx.closePath();
    ctx.fill();
  }
  const texture = canvasTexture(canvas, 1, 1, true);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createTerrainDetailTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = 186 + Math.floor(hash2d(x, y, 19) * 58);
      const index = (y * size + x) * 4;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = canvasTexture(canvas, 1, 1, true);
  return texture;
}

export function createWaterTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const rng = mulberry32(9921);
  ctx.fillStyle = '#2c86b0';
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < 16; row += 1) {
    const y = row * 8 + 2;
    let x = Math.floor(rng() * 18);
    while (x < size) {
      const length = 3 + Math.floor(rng() * 11);
      ctx.fillStyle = row % 3 === 0 ? '#62c4d2' : '#369dbb';
      ctx.fillRect(x, y, length, 1);
      if (rng() > 0.78) {
        ctx.fillStyle = '#b8eadf';
        ctx.fillRect(x + 2, y, 2, 1);
      }
      x += length + 8 + Math.floor(rng() * 20);
    }
  }
  for (let i = 0; i < 220; i += 1) {
    ctx.fillStyle = rng() > 0.4 ? '#2d8fb2' : '#15577f';
    ctx.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 1, 1);
  }
  const texture = canvasTexture(canvas, 16, 16, true);
  return texture;
}

export function createCloudTexture(seed = 7): THREE.CanvasTexture {
  const canvas = makeCanvas(128, 64);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 128, 64);
  const rng = mulberry32(seed);
  const drawPuff = (cx: number, cy: number, rx: number, ry: number, style: string) => {
    ctx.fillStyle = style;
    for (let y = -ry; y <= ry; y += 2) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (half > 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 2);
    }
  };
  const puffs = [
    { x: 43, y: 33, rx: 26, ry: 14 },
    { x: 65, y: 29, rx: 30, ry: 16 },
    { x: 87, y: 34, rx: 24, ry: 13 },
    { x: 57, y: 24, rx: 19, ry: 14 },
    { x: 78, y: 23, rx: 17, ry: 12 },
    { x: 31, y: 37, rx: 15, ry: 9 },
  ];
  for (const puff of puffs) drawPuff(puff.x + 3, puff.y + 4, puff.rx, puff.ry, 'rgba(75, 108, 119, 0.22)');
  for (const puff of puffs) {
    drawPuff(puff.x, puff.y, puff.rx, puff.ry, '#eef3e4');
    drawPuff(puff.x, puff.y - 2, puff.rx * 0.8, puff.ry * 0.65, '#fbf6df');
  }
  ctx.fillStyle = 'rgba(148, 169, 160, 0.55)';
  for (let i = 0; i < 26; i += 1) {
    ctx.fillRect(24 + Math.floor(rng() * 82), 40 + Math.floor(rng() * 7), 2 + Math.floor(rng() * 7), 1);
  }
  const texture = canvasTexture(canvas, 1, 1, true);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createSmokeTexture(): THREE.CanvasTexture {
  const canvas = makeCanvas(32, 32);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 32, 32);
  const rng = mulberry32(331);
  for (let i = 0; i < 20; i += 1) {
    const size = 3 + Math.floor(rng() * 6);
    ctx.fillStyle = rng() > 0.5 ? 'rgba(238, 232, 210, 0.55)' : 'rgba(199, 193, 171, 0.42)';
    ctx.fillRect(4 + Math.floor(rng() * 24), 4 + Math.floor(rng() * 24), size, size);
  }
  return canvasTexture(canvas, 1, 1, true);
}

export function createNumberTexture(number: number, color = '#f5ebd2'): THREE.CanvasTexture {
  const canvas = makeCanvas(64, 64);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = color;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 32, 34);
  const texture = canvasTexture(canvas, 1, 1, true);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createStartBannerTexture(trackName: string): THREE.CanvasTexture {
  const canvas = makeCanvas(1024, 96);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#0c1820';
  ctx.fillRect(0, 0, 1024, 96);
  ctx.strokeStyle = '#f5ebd2';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 1012, 84);
  ctx.fillStyle = '#ff8f3d';
  ctx.fillRect(20, 18, 10, 10);
  ctx.fillStyle = '#f5ebd2';
  ctx.font = 'bold 18px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('PUTARAN 3 / 8 MOBIL', 42, 27);
  ctx.font = 'bold 52px monospace';
  ctx.fillText(trackName.toUpperCase(), 42, 62);
  ctx.fillStyle = '#ff8f3d';
  ctx.fillRect(942, 20, 46, 5);
  ctx.fillRect(942, 32, 32, 5);
  const texture = canvasTexture(canvas, 1, 1, true);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createSideVinylTexture(
  carId: string,
  stripeColor: string,
  highlightColor: string,
  number: number,
): THREE.CanvasTexture {
  const canvas = makeCanvas(256, 96);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 96);

  if (carId === 'mcqueen') {
    // Signature jagged lightning bolt + bold number
    ctx.fillStyle = stripeColor;
    ctx.beginPath();
    ctx.moveTo(14, 62);
    ctx.lineTo(132, 30);
    ctx.lineTo(118, 48);
    ctx.lineTo(242, 22);
    ctx.lineTo(144, 68);
    ctx.lineTo(158, 50);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ff6a1a';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (carId === 'doc' || carId === 'chick') {
    // Classic twin NASCAR/Hornet side stripes
    ctx.fillStyle = stripeColor;
    ctx.fillRect(10, 36, 236, 12);
    ctx.fillStyle = highlightColor;
    ctx.fillRect(10, 52, 236, 5);
  } else if (carId === 'cruz' || carId === 'storm') {
    // Swept modern angular aero streak
    ctx.fillStyle = stripeColor;
    ctx.beginPath();
    ctx.moveTo(12, 66);
    ctx.lineTo(160, 26);
    ctx.lineTo(244, 26);
    ctx.lineTo(222, 46);
    ctx.lineTo(128, 46);
    ctx.lineTo(42, 74);
    ctx.closePath();
    ctx.fill();
  } else if (carId === 'luigi' || carId === 'francesco') {
    // Italian tricolore racing stripe
    ctx.fillStyle = '#2ea353';
    ctx.fillRect(12, 34, 232, 8);
    ctx.fillStyle = '#f5f2ea';
    ctx.fillRect(12, 42, 232, 8);
    ctx.fillStyle = '#d9322b';
    ctx.fillRect(12, 50, 232, 8);
  } else if (carId === 'mater') {
    // Rust patina & tow service door emblem
    ctx.fillStyle = 'rgba(72, 44, 28, 0.55)';
    ctx.fillRect(18, 58, 72, 16);
    ctx.fillRect(168, 54, 64, 18);
    ctx.fillStyle = stripeColor;
    ctx.fillRect(88, 32, 80, 32);
  } else {
    ctx.fillStyle = stripeColor;
    ctx.fillRect(14, 42, 228, 12);
  }

  // Crisp racing number roundel on door
  ctx.fillStyle = carId === 'mcqueen' ? '#e12b26' : 'rgba(20, 28, 38, 0.86)';
  ctx.beginPath();
  ctx.arc(128, 48, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stripeColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = carId === 'mcqueen' ? stripeColor : '#ffffff';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 128, 50);

  const texture = canvasTexture(canvas, 1, 1, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createHoodVinylTexture(
  carId: string,
  stripeColor: string,
  highlightColor: string,
): THREE.CanvasTexture {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 128, 128);

  if (carId === 'mcqueen') {
    // Hood emblem shield + twin speed hash
    ctx.fillStyle = stripeColor;
    ctx.beginPath();
    ctx.ellipse(64, 64, 34, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9231f';
    ctx.beginPath();
    ctx.ellipse(64, 64, 26, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = stripeColor;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('95', 64, 65);
  } else if (carId === 'storm' || carId === 'cruz') {
    ctx.fillStyle = stripeColor;
    ctx.fillRect(16, 48, 96, 12);
    ctx.fillRect(16, 68, 96, 12);
  } else if (carId === 'doc' || carId === 'sally' || carId === 'chick') {
    ctx.fillStyle = stripeColor;
    ctx.fillRect(12, 42, 104, 16);
    ctx.fillStyle = highlightColor;
    ctx.fillRect(12, 70, 104, 16);
  } else {
    ctx.fillStyle = stripeColor;
    ctx.fillRect(16, 54, 96, 20);
  }

  const texture = canvasTexture(canvas, 1, 1, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Muddy dirt road with two darker wheel ruts (u across the road, v along it). */
export function createDirtTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const rng = mulberry32(9137);
  ctx.fillStyle = '#7b5a39';
  ctx.fillRect(0, 0, size, size);
  // wheel ruts
  for (const cx of [0.3, 0.7]) {
    ctx.fillStyle = '#5f4429';
    ctx.fillRect(Math.round(size * cx) - 4, 0, 8, size);
    ctx.fillStyle = '#6c4f30';
    ctx.fillRect(Math.round(size * cx) - 6, 0, 2, size);
    ctx.fillRect(Math.round(size * cx) + 4, 0, 2, size);
  }
  for (let i = 0; i < 520; i += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const roll = rng();
    ctx.fillStyle = roll > 0.62 ? '#9a7647' : roll > 0.3 ? '#5a4128' : '#8b6a43';
    ctx.fillRect(x, y, 1 + (rng() > 0.88 ? 1 : 0), 1 + (rng() > 0.92 ? 1 : 0));
  }
  // a few small stones
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = rng() > 0.5 ? '#a8a08e' : '#847c6c';
    ctx.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 2, 1);
  }
  return canvasTexture(canvas, 1, 1, true);
}
