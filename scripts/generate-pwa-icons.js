import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const SOURCE_ICON_PATH = 'public/icons/despensapp-icon.svg';
const OUTPUTS = [
  { path: 'public/icons/icon-180.png', size: 180, maskable: false },
  { path: 'public/icons/icon-192.png', size: 192, maskable: false },
  { path: 'public/icons/icon-512.png', size: 512, maskable: false },
  { path: 'public/icons/maskable-icon-512.png', size: 512, maskable: true },
];
const SUPERSAMPLE_SCALE = 4;
const MASKABLE_SAFE_SCALE = 0.88;
const CURVE_SEGMENT_SOURCE_LENGTH = 3;
const MIN_CURVE_SEGMENTS = 4;
const MAX_CURVE_SEGMENTS = 96;

const sourceIcon = readSvgIcon(SOURCE_ICON_PATH);

for (const output of OUTPUTS) {
  writePng(output.path, createIconPng(sourceIcon, output.size, output.maskable));
}

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ x: number, y: number, width: number, height: number }} ViewBox
 * @typedef {{ fill: number[], subpaths: Point[][] }} SvgPath
 * @typedef {{ backgroundColor: number[], paths: SvgPath[], viewBox: ViewBox }} SvgIcon
 * @typedef {{ x1: number, y1: number, x2: number, y2: number, yMin: number, yMax: number, winding: number }} Edge
 */

/**
 * Lee el SVG base y extrae los paths que forman el icono.
 *
 * @param {string} sourcePath Ruta relativa del SVG fuente.
 * @returns {SvgIcon} Icono vectorial preparado para rasterizar.
 */
function readSvgIcon(sourcePath) {
  const svg = readFileSync(resolve(sourcePath), 'utf8');
  const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0];

  if (!svgTag) {
    throw new Error(`No se encontro la etiqueta <svg> en ${sourcePath}.`);
  }

  const svgAttributes = parseAttributes(svgTag);
  const viewBox = readViewBox(svgAttributes);
  const paths = [];
  const pathTagPattern = /<path\b[^>]*>/gi;
  let pathTagMatch = pathTagPattern.exec(svg);

  while (pathTagMatch) {
    const attributes = parseAttributes(pathTagMatch[0]);
    const fill = attributes.fill;

    if (attributes.d && fill && fill.toLowerCase() !== 'none') {
      paths.push({
        fill: hexToRgba(fill),
        subpaths: parsePathData(attributes.d, parseTranslate(attributes.transform)),
      });
    }

    pathTagMatch = pathTagPattern.exec(svg);
  }

  if (paths.length === 0) {
    throw new Error(`No se encontraron paths rasterizables en ${sourcePath}.`);
  }

  return {
    backgroundColor: paths[0].fill,
    paths,
    viewBox,
  };
}

/**
 * Extrae atributos XML simples con comillas dobles o simples.
 *
 * @param {string} tag Etiqueta SVG.
 * @returns {Record<string, string>} Atributos indexados por nombre.
 */
function parseAttributes(tag) {
  const attributes = {};
  const attributePattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = attributePattern.exec(tag);

  while (match) {
    attributes[match[1]] = match[2] ?? match[3] ?? '';
    match = attributePattern.exec(tag);
  }

  return attributes;
}

/**
 * Lee el viewBox del SVG o lo deriva de width/height.
 *
 * @param {Record<string, string>} attributes Atributos de la etiqueta svg.
 * @returns {ViewBox} Caja de coordenadas fuente.
 */
function readViewBox(attributes) {
  if (attributes.viewBox) {
    const values = parseNumberList(attributes.viewBox);

    if (values.length === 4 && values.every(Number.isFinite)) {
      return { x: values[0], y: values[1], width: values[2], height: values[3] };
    }
  }

  const width = parseSvgLength(attributes.width);
  const height = parseSvgLength(attributes.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('El SVG debe declarar viewBox o width/height validos.');
  }

  return { x: 0, y: 0, width, height };
}

/**
 * Convierte una longitud SVG sencilla a numero.
 *
 * @param {string | undefined} value Valor de longitud.
 * @returns {number} Numero en unidades SVG.
 */
function parseSvgLength(value) {
  return Number.parseFloat(String(value ?? '').replace(/px$/i, ''));
}

/**
 * Convierte una lista de numeros SVG a array.
 *
 * @param {string} value Lista separada por espacios o comas.
 * @returns {number[]} Numeros parseados.
 */
function parseNumberList(value) {
  return value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));
}

/**
 * Lee transformaciones translate(x,y). El icono actual no usa otras.
 *
 * @param {string | undefined} transform Transform SVG.
 * @returns {Point} Desplazamiento.
 */
function parseTranslate(transform) {
  if (!transform) {
    return { x: 0, y: 0 };
  }

  const number = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';
  const match = transform.match(new RegExp(`^\\s*translate\\(\\s*(${number})(?:[\\s,]+(${number}))?\\s*\\)\\s*$`));

  if (!match) {
    throw new Error(`Transform SVG no soportado: "${transform}".`);
  }

  return {
    x: Number.parseFloat(match[1]),
    y: Number.parseFloat(match[2] ?? '0'),
  };
}

/**
 * Genera un PNG rasterizando el SVG fuente.
 *
 * @param {SvgIcon} icon Icono vectorial.
 * @param {number} size Tamano final en pixeles.
 * @param {boolean} maskable True para dejar mas margen seguro en iconos maskable.
 * @returns {Buffer} PNG generado.
 */
function createIconPng(icon, size, maskable) {
  const canvasSize = size * SUPERSAMPLE_SCALE;
  const pixels = createPixelBuffer(canvasSize, canvasSize, maskable ? icon.backgroundColor : [0, 0, 0, 0]);
  const safeScale = maskable ? MASKABLE_SAFE_SCALE : 1;
  const iconScale = Math.min(canvasSize / icon.viewBox.width, canvasSize / icon.viewBox.height) * safeScale;
  const offsetX = (canvasSize - icon.viewBox.width * iconScale) / 2 - icon.viewBox.x * iconScale;
  const offsetY = (canvasSize - icon.viewBox.height * iconScale) / 2 - icon.viewBox.y * iconScale;

  for (const path of icon.paths) {
    fillSvgPath(pixels, canvasSize, canvasSize, path, iconScale, offsetX, offsetY);
  }

  return encodePng(size, size, downsample(pixels, canvasSize, canvasSize, SUPERSAMPLE_SCALE));
}

/**
 * Rasteriza un path SVG ya parseado sobre el buffer.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho del canvas.
 * @param {number} height Alto del canvas.
 * @param {SvgPath} path Path SVG.
 * @param {number} scale Escala SVG -> canvas.
 * @param {number} offsetX Desplazamiento X.
 * @param {number} offsetY Desplazamiento Y.
 * @returns {void}
 */
function fillSvgPath(pixels, width, height, path, scale, offsetX, offsetY) {
  const subpaths = path.subpaths.map((subpath) => (
    subpath.map((point) => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    }))
  ));

  fillPath(pixels, width, height, subpaths, path.fill);
}

/**
 * Parsea path data con los comandos necesarios para el SVG del icono.
 *
 * @param {string} data Atributo d del path.
 * @param {Point} translate Transformacion translate del path.
 * @returns {Point[][]} Subpaths aplanados.
 */
function parsePathData(data, translate) {
  const tokens = tokenizePathData(data);
  const subpaths = [];
  let index = 0;
  let command = '';
  let current = { x: 0, y: 0 };
  let start = null;
  let subpath = [];

  const pushSubpath = () => {
    if (subpath.length > 1) {
      subpaths.push(subpath);
    }

    subpath = [];
  };

  const readNumber = () => {
    const token = tokens[index];

    if (token === undefined || isPathCommand(token)) {
      throw new Error(`Path SVG incompleto cerca de "${data.slice(0, 80)}".`);
    }

    index += 1;
    return Number.parseFloat(token);
  };

  const readPoint = (relative) => {
    const x = readNumber();
    const y = readNumber();

    if (relative) {
      return { x: current.x + x, y: current.y + y };
    }

    return { x, y };
  };

  while (index < tokens.length) {
    if (isPathCommand(tokens[index])) {
      command = tokens[index];
      index += 1;
    }

    switch (command) {
      case 'M':
      case 'm': {
        const relative = command === 'm';
        const point = readPoint(relative);

        pushSubpath();
        current = point;
        start = point;
        subpath = [translatePoint(point, translate)];

        while (hasNumberToken(tokens[index])) {
          const linePoint = readPoint(relative);
          current = linePoint;
          subpath.push(translatePoint(linePoint, translate));
        }

        command = relative ? 'l' : 'L';
        break;
      }
      case 'L':
      case 'l': {
        const relative = command === 'l';

        while (hasNumberToken(tokens[index])) {
          const point = readPoint(relative);
          current = point;
          subpath.push(translatePoint(point, translate));
        }

        break;
      }
      case 'H':
      case 'h': {
        const relative = command === 'h';

        while (hasNumberToken(tokens[index])) {
          const x = readNumber();
          current = { x: relative ? current.x + x : x, y: current.y };
          subpath.push(translatePoint(current, translate));
        }

        break;
      }
      case 'V':
      case 'v': {
        const relative = command === 'v';

        while (hasNumberToken(tokens[index])) {
          const y = readNumber();
          current = { x: current.x, y: relative ? current.y + y : y };
          subpath.push(translatePoint(current, translate));
        }

        break;
      }
      case 'C':
      case 'c': {
        const relative = command === 'c';

        while (hasNumberToken(tokens[index])) {
          const control1 = readPoint(relative);
          const control2 = readPoint(relative);
          const end = readPoint(relative);
          const flattened = flattenCubic(
            translatePoint(current, translate),
            translatePoint(control1, translate),
            translatePoint(control2, translate),
            translatePoint(end, translate),
          );

          subpath.push(...flattened);
          current = end;
        }

        break;
      }
      case 'Z':
      case 'z': {
        if (start) {
          current = start;
        }

        pushSubpath();
        start = null;
        command = '';
        break;
      }
      default:
        throw new Error(`Comando SVG no soportado: "${command}".`);
    }
  }

  pushSubpath();
  return subpaths;
}

/**
 * Divide path data SVG en comandos y numeros.
 *
 * @param {string} data Atributo d.
 * @returns {string[]} Tokens.
 */
function tokenizePathData(data) {
  return data.match(/[MmLlHhVvCcZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
}

/**
 * Indica si un token es comando SVG.
 *
 * @param {string | undefined} token Token de path.
 * @returns {boolean} True si es comando.
 */
function isPathCommand(token) {
  return Boolean(token && /^[A-Za-z]$/.test(token));
}

/**
 * Indica si un token contiene un numero.
 *
 * @param {string | undefined} token Token de path.
 * @returns {boolean} True si es numero.
 */
function hasNumberToken(token) {
  return Boolean(token && !isPathCommand(token));
}

/**
 * Aplica desplazamiento a un punto.
 *
 * @param {Point} point Punto base.
 * @param {Point} translate Desplazamiento.
 * @returns {Point} Punto desplazado.
 */
function translatePoint(point, translate) {
  return {
    x: point.x + translate.x,
    y: point.y + translate.y,
  };
}

/**
 * Aplana una curva cubica a segmentos lineales.
 *
 * @param {Point} p0 Inicio.
 * @param {Point} p1 Control 1.
 * @param {Point} p2 Control 2.
 * @param {Point} p3 Fin.
 * @returns {Point[]} Puntos intermedios y finales.
 */
function flattenCubic(p0, p1, p2, p3) {
  const segments = getCurveSegmentCount(p0, p1, p2, p3);
  const points = [];

  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const mt = 1 - t;

    points.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    });
  }

  return points;
}

/**
 * Calcula cuantos segmentos necesita una curva para verse suave.
 *
 * @param {Point} p0 Inicio.
 * @param {Point} p1 Control 1.
 * @param {Point} p2 Control 2.
 * @param {Point} p3 Fin.
 * @returns {number} Numero de segmentos.
 */
function getCurveSegmentCount(p0, p1, p2, p3) {
  const controlLength = distance(p0, p1) + distance(p1, p2) + distance(p2, p3);
  const segments = Math.ceil(controlLength / CURVE_SEGMENT_SOURCE_LENGTH);

  return clamp(segments, MIN_CURVE_SEGMENTS, MAX_CURVE_SEGMENTS);
}

/**
 * Calcula la distancia euclidea entre dos puntos.
 *
 * @param {Point} a Punto A.
 * @param {Point} b Punto B.
 * @returns {number} Distancia.
 */
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Limita un valor numerico entre minimo y maximo.
 *
 * @param {number} value Valor.
 * @param {number} minimum Minimo.
 * @param {number} maximum Maximo.
 * @returns {number} Valor limitado.
 */
function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Rellena subpaths con regla nonzero, igual que SVG por defecto.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho del canvas.
 * @param {number} height Alto del canvas.
 * @param {Point[][]} subpaths Subpaths aplanados.
 * @param {number[]} color Color RGBA.
 * @returns {void}
 */
function fillPath(pixels, width, height, subpaths, color) {
  const edges = createEdges(subpaths);

  if (edges.length === 0) {
    return;
  }

  edges.sort((a, b) => a.yMin - b.yMin);

  let maxY = edges[0].yMax;

  for (const edge of edges) {
    maxY = Math.max(maxY, edge.yMax);
  }

  const firstScanline = Math.max(0, Math.ceil(edges[0].yMin - 0.5));
  const lastScanline = Math.min(height - 1, Math.ceil(maxY - 0.5) - 1);
  const activeEdges = [];
  let edgeIndex = 0;

  for (let y = firstScanline; y <= lastScanline; y += 1) {
    const sampleY = y + 0.5;

    while (edgeIndex < edges.length && edges[edgeIndex].yMin <= sampleY) {
      activeEdges.push(edges[edgeIndex]);
      edgeIndex += 1;
    }

    for (let index = activeEdges.length - 1; index >= 0; index -= 1) {
      if (activeEdges[index].yMax <= sampleY) {
        activeEdges.splice(index, 1);
      }
    }

    fillScanline(pixels, width, y, activeEdges, sampleY, color);
  }
}

/**
 * Crea aristas orientadas para rellenar un path.
 *
 * @param {Point[][]} subpaths Subpaths aplanados.
 * @returns {Edge[]} Aristas no horizontales.
 */
function createEdges(subpaths) {
  const edges = [];

  for (const subpath of subpaths) {
    if (subpath.length < 2) {
      continue;
    }

    for (let index = 0; index < subpath.length; index += 1) {
      const start = subpath[index];
      const end = subpath[(index + 1) % subpath.length];

      if (start.y === end.y) {
        continue;
      }

      edges.push({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        yMin: Math.min(start.y, end.y),
        yMax: Math.max(start.y, end.y),
        winding: start.y < end.y ? 1 : -1,
      });
    }
  }

  return edges;
}

/**
 * Rellena los tramos interiores de una linea horizontal.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho del canvas.
 * @param {number} y Coordenada Y de la scanline.
 * @param {Edge[]} activeEdges Aristas activas.
 * @param {number} sampleY Posicion de muestreo Y.
 * @param {number[]} color Color RGBA.
 * @returns {void}
 */
function fillScanline(pixels, width, y, activeEdges, sampleY, color) {
  const intersections = activeEdges
    .map((edge) => ({
      x: edge.x1 + ((sampleY - edge.y1) * (edge.x2 - edge.x1)) / (edge.y2 - edge.y1),
      winding: edge.winding,
    }))
    .sort((a, b) => a.x - b.x);
  let winding = 0;
  let spanStart = null;

  for (const intersection of intersections) {
    const previousWinding = winding;
    winding += intersection.winding;

    if (previousWinding === 0 && winding !== 0) {
      spanStart = intersection.x;
    } else if (previousWinding !== 0 && winding === 0 && spanStart !== null) {
      fillSpan(pixels, width, y, spanStart, intersection.x, color);
      spanStart = null;
    }
  }
}

/**
 * Rellena un tramo horizontal.
 *
 * @param {Uint8Array} pixels Buffer RGBA.
 * @param {number} width Ancho del canvas.
 * @param {number} y Coordenada Y.
 * @param {number} xStart Inicio X.
 * @param {number} xEnd Fin X.
 * @param {number[]} color Color RGBA.
 * @returns {void}
 */
function fillSpan(pixels, width, y, xStart, xEnd, color) {
  const start = Math.max(0, Math.ceil(Math.min(xStart, xEnd) - 0.5));
  const end = Math.min(width - 1, Math.ceil(Math.max(xStart, xEnd) - 0.5) - 1);

  for (let x = start; x <= end; x += 1) {
    const pixelIndex = (y * width + x) * 4;
    pixels[pixelIndex] = color[0];
    pixels[pixelIndex + 1] = color[1];
    pixels[pixelIndex + 2] = color[2];
    pixels[pixelIndex + 3] = color[3];
  }
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
 * @param {string} hex Color en formato #rgb o #rrggbb.
 * @returns {number[]} Componentes RGBA.
 */
function hexToRgba(hex) {
  const value = hex.trim();

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return [
      Number.parseInt(value[1] + value[1], 16),
      Number.parseInt(value[2] + value[2], 16),
      Number.parseInt(value[3] + value[3], 16),
      255,
    ];
  }

  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return [
      Number.parseInt(value.slice(1, 3), 16),
      Number.parseInt(value.slice(3, 5), 16),
      Number.parseInt(value.slice(5, 7), 16),
      255,
    ];
  }

  throw new Error(`Color SVG no soportado: "${hex}".`);
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
