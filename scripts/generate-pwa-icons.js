import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUTPUTS = [
  { path: 'public/icons/icon-180.png', size: 180, maskable: false },
  { path: 'public/icons/icon-192.png', size: 192, maskable: false },
  { path: 'public/icons/icon-512.png', size: 512, maskable: false },
  { path: 'public/icons/maskable-icon-512.png', size: 512, maskable: true },
];
const SCALE = 4;

for (const output of OUTPUTS) {
  writePng(output.path, createIconPng(output.size, output.maskable));
}

/**
 * Escribe un PNG en disco creando el directorio destino si no existe.
 *
 * @param {string} outputPath Ruta relativa de salida.
 * @param {Buffer} pngBuffer Contenido PNG.
 * @returns {void}
 */
function writePng(outputPath, pngBuffer) {
  const absolutePath = resolve(outputPath);

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, pngBuffer);
}

/**
 * Genera el icono raster de DespensApp usando solo APIs nativas de Node.
 *
 * @param {number} size Tamano final en pixeles.
 * @param {boolean} maskable True para dejar mas margen seguro en iconos maskable.
 * @returns {Buffer} PNG generado.
 */
function createIconPng(size, maskable) {
  const canvasSize = size * SCALE;
  const pixels = createPixelBuffer(canvasSize, canvasSize, hexToRgba('#183f31'));
  const unit = canvasSize / 512;
  const safeScale = maskable ? 0.88 : 1;
  const offset = ((1 - safeScale) * canvasSize) / 2;
  const map = (value) => Math.round(offset + value * unit * safeScale);
  const dimension = (value) => Math.round(value * unit * safeScale);

  fillRoundedRect(pixels, canvasSize, canvasSize, map(96), map(88), dimension(320), dimension(336), dimension(54), hexToRgba('#f7fbf7'));
  fillRoundedRect(pixels, canvasSize, canvasSize, map(128), map(190), dimension(256), dimension(20), dimension(10), hexToRgba('#bdd6c8'));
  fillRoundedRect(pixels, canvasSize, canvasSize, map(128), map(314), dimension(256), dimension(20), dimension(10), hexToRgba('#bdd6c8'));
  fillCircle(pixels, canvasSize, canvasSize, map(178), map(154), dimension(34), hexToRgba('#d85b45'));
  fillEllipse(pixels, canvasSize, canvasSize, map(194), map(120), dimension(50), dimension(24), -0.42, hexToRgba('#257054'));
  fillRoundedRect(pixels, canvasSize, canvasSize, map(247), map(116), dimension(72), dimension(72), dimension(18), hexToRgba('#f0c968'));
  fillRoundedRect(pixels, canvasSize, canvasSize, map(154), map(242), dimension(78), dimension(74), dimension(18), hexToRgba('#8fb7a4'));
  fillRoundedRect(pixels, canvasSize, canvasSize, map(280), map(238), dimension(80), dimension(80), dimension(24), hexToRgba('#e9a35f'));
  fillRoundedRect(pixels, canvasSize, canvasSize, map(154), map(370), dimension(204), dimension(44), dimension(22), hexToRgba('#183f31'));

  return encodePng(size, size, downsample(pixels, canvasSize, canvasSize, SCALE));
}

/**
 * Crea un buffer RGBA inicializado con un color de fondo.
 *
 * @param {number} width Ancho.
 * @param {number} height Alto.
 * @param {number[]} color Color RGBA.
 * @returns {Uint8Array} Buffer RGBA.
 */
function createPixelBuffer(width, height, color) {
  const pixels = new Uint8Array(width * height * 4);

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = color[3];
  }

  return pixels;
}

/**
 * Convierte un color hexadecimal a RGBA opaco.
 *
 * @param {string} hex Color en formato #rrggbb.
 * @returns {number[]} Componentes RGBA.
 */
function hexToRgba(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255,
  ];
}

/**
 * Rellena un rectangulo con esquinas redondeadas.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho total.
 * @param {number} height Alto total.
 * @param {number} x Coordenada x.
 * @param {number} y Coordenada y.
 * @param {number} rectWidth Ancho del rectangulo.
 * @param {number} rectHeight Alto del rectangulo.
 * @param {number} radius Radio de las esquinas.
 * @param {number[]} color Color RGBA.
 * @returns {void}
 */
function fillRoundedRect(pixels, width, height, x, y, rectWidth, rectHeight, radius, color) {
  for (let py = y; py < y + rectHeight; py += 1) {
    for (let px = x; px < x + rectWidth; px += 1) {
      const cornerX = px < x + radius ? x + radius : px > x + rectWidth - radius ? x + rectWidth - radius : px;
      const cornerY = py < y + radius ? y + radius : py > y + rectHeight - radius ? y + rectHeight - radius : py;
      const dx = px - cornerX;
      const dy = py - cornerY;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, width, height, px, py, color);
      }
    }
  }
}

/**
 * Rellena un circulo.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho total.
 * @param {number} height Alto total.
 * @param {number} centerX Centro x.
 * @param {number} centerY Centro y.
 * @param {number} radius Radio.
 * @param {number[]} color Color RGBA.
 * @returns {void}
 */
function fillCircle(pixels, width, height, centerX, centerY, radius, color) {
  for (let py = centerY - radius; py <= centerY + radius; py += 1) {
    for (let px = centerX - radius; px <= centerX + radius; px += 1) {
      const dx = px - centerX;
      const dy = py - centerY;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, width, height, px, py, color);
      }
    }
  }
}

/**
 * Rellena una elipse rotada.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho total.
 * @param {number} height Alto total.
 * @param {number} centerX Centro x.
 * @param {number} centerY Centro y.
 * @param {number} radiusX Radio horizontal.
 * @param {number} radiusY Radio vertical.
 * @param {number} rotation Rotacion en radianes.
 * @param {number[]} color Color RGBA.
 * @returns {void}
 */
function fillEllipse(pixels, width, height, centerX, centerY, radiusX, radiusY, rotation, color) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let py = centerY - radiusX; py <= centerY + radiusX; py += 1) {
    for (let px = centerX - radiusX; px <= centerX + radiusX; px += 1) {
      const dx = px - centerX;
      const dy = py - centerY;
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;

      if ((localX * localX) / (radiusX * radiusX) + (localY * localY) / (radiusY * radiusY) <= 1) {
        setPixel(pixels, width, height, px, py, color);
      }
    }
  }
}

/**
 * Pinta un pixel si esta dentro del canvas.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho total.
 * @param {number} height Alto total.
 * @param {number} x Coordenada x.
 * @param {number} y Coordenada y.
 * @param {number[]} color Color RGBA.
 * @returns {void}
 */
function setPixel(pixels, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }

  const index = (y * width + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

/**
 * Reduce un canvas supersampleado promediando bloques de pixeles.
 *
 * @param {Uint8Array} pixels Buffer RGBA original.
 * @param {number} width Ancho original.
 * @param {number} height Alto original.
 * @param {number} scale Factor de reduccion.
 * @returns {Uint8Array} Buffer RGBA reducido.
 */
function downsample(pixels, width, height, scale) {
  const targetWidth = width / scale;
  const targetHeight = height / scale;
  const output = new Uint8Array(targetWidth * targetHeight * 4);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const color = [0, 0, 0, 0];

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const sourceIndex = (((y * scale + sy) * width + x * scale + sx) * 4);
          color[0] += pixels[sourceIndex];
          color[1] += pixels[sourceIndex + 1];
          color[2] += pixels[sourceIndex + 2];
          color[3] += pixels[sourceIndex + 3];
        }
      }

      const targetIndex = (y * targetWidth + x) * 4;
      const samples = scale * scale;
      output[targetIndex] = Math.round(color[0] / samples);
      output[targetIndex + 1] = Math.round(color[1] / samples);
      output[targetIndex + 2] = Math.round(color[2] / samples);
      output[targetIndex + 3] = Math.round(color[3] / samples);
    }
  }

  return output;
}

/**
 * Codifica pixeles RGBA como PNG sin depender de librerias externas.
 *
 * @param {number} width Ancho.
 * @param {number} height Alto.
 * @param {Uint8Array} pixels Pixeles RGBA.
 * @returns {Buffer} PNG.
 */
function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rawRowStart = y * (width * 4 + 1);
    const pixelRowStart = y * width * 4;

    raw[rawRowStart] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + pixelRowStart, width * 4).copy(raw, rawRowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createPngChunk('IHDR', createHeaderChunk(width, height)),
    createPngChunk('IDAT', deflateSync(raw, { level: 9 })),
    createPngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Crea el chunk IHDR de PNG.
 *
 * @param {number} width Ancho.
 * @param {number} height Alto.
 * @returns {Buffer} Datos IHDR.
 */
function createHeaderChunk(width, height) {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return header;
}

/**
 * Crea un chunk PNG con longitud y CRC.
 *
 * @param {string} type Tipo de chunk.
 * @param {Buffer} data Datos del chunk.
 * @returns {Buffer} Chunk completo.
 */
function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(calculateCrc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Calcula CRC32 para chunks PNG.
 *
 * @param {Buffer} buffer Datos del chunk.
 * @returns {number} CRC32 sin signo.
 */
function calculateCrc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
