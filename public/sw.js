const APP_CACHE = 'despensapp-app-v1';
const RUNTIME_CACHE = 'despensapp-runtime-v1';
const BUILD_MANIFEST_URL = '/asset-manifest.json';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/offline.html',
  '/icons/despensapp-icon.svg',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(installAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanOldCaches());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || !isSameOrigin(request.url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (shouldUseCacheFirst(request)) {
    event.respondWith(handleCacheFirst(request));
  }
});

/**
 * Precachea el shell de la aplicacion y los assets versionados emitidos por Vite.
 *
 * @returns {Promise<void>} Promesa de instalacion.
 */
async function installAppShell() {
  const cache = await caches.open(APP_CACHE);
  const buildUrls = await readBuildManifestUrls();

  await cacheRequests(cache, [...PRECACHE_URLS, ...buildUrls]);
  await self.skipWaiting();
}

/**
 * Elimina caches que ya no pertenecen a la version actual del service worker.
 *
 * @returns {Promise<void>} Promesa de limpieza.
 */
async function cleanOldCaches() {
  const cacheNames = await caches.keys();
  const currentCaches = new Set([APP_CACHE, RUNTIME_CACHE]);

  await Promise.all(
    cacheNames
      .filter((cacheName) => !currentCaches.has(cacheName))
      .map((cacheName) => caches.delete(cacheName)),
  );
  await self.clients.claim();
}

/**
 * Lee el manifest de build de Vite y extrae los assets cacheables.
 *
 * @returns {Promise<string[]>} URLs de assets del build.
 */
async function readBuildManifestUrls() {
  try {
    const response = await fetch(BUILD_MANIFEST_URL, { cache: 'no-store' });

    if (!response.ok) {
      return [];
    }

    const manifest = await response.json();
    const urls = new Set([BUILD_MANIFEST_URL]);

    collectBuildAssetUrls(manifest, urls);
    return [...urls];
  } catch (error) {
    console.warn('[Despensapp] No se pudo leer el manifest de assets.', error);
    return [];
  }
}

/**
 * Recorre cualquier nodo del manifest buscando assets publicados en `/assets`.
 *
 * @param {unknown} value Nodo del manifest.
 * @param {Set<string>} urls Acumulador de URLs.
 */
function collectBuildAssetUrls(value, urls) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectBuildAssetUrls(item, urls);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectBuildAssetUrls(item, urls);
    }
    return;
  }

  if (typeof value !== 'string') {
    return;
  }

  const assetUrl = normalizeBuildAssetUrl(value);

  if (assetUrl) {
    urls.add(assetUrl);
  }
}

/**
 * Normaliza rutas de assets emitidas por Vite a URLs absolutas del mismo origen.
 *
 * @param {string} value Ruta encontrada en el manifest de build.
 * @returns {string | null} URL cacheable o null.
 */
function normalizeBuildAssetUrl(value) {
  if (value.startsWith('/assets/')) {
    return value;
  }

  if (value.startsWith('assets/')) {
    return `/${value}`;
  }

  return null;
}

/**
 * Anade URLs al cache sin abortar la instalacion por un asset puntual no disponible.
 *
 * @param {Cache} cache Cache destino.
 * @param {string[]} urls URLs a cachear.
 * @returns {Promise<void>} Promesa de cacheo.
 */
async function cacheRequests(cache, urls) {
  const uniqueUrls = [...new Set(urls)];

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (error) {
        console.warn(`[Despensapp] No se pudo cachear ${url}.`, error);
      }
    }),
  );
}

/**
 * Sirve navegaciones desde red y usa cache solo cuando no hay conexion.
 *
 * @param {Request} request Peticion de navegacion.
 * @returns {Promise<Response>} Respuesta HTML.
 */
async function handleNavigation(request) {
  const cache = await caches.open(APP_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(new Request('/'), response.clone());
    }

    return response;
  } catch (error) {
    return (
      (await cache.match(request)) ||
      (await cache.match('/')) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/offline.html')) ||
      createOfflineResponse()
    );
  }
}

/**
 * Crea una respuesta minima si el fallback offline aun no esta cacheado.
 *
 * @returns {Response} Respuesta HTML offline.
 */
function createOfflineResponse() {
  return new Response('<h1>Despensapp</h1><p>No hay conexion.</p>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 503,
    statusText: 'Offline',
  });
}

/**
 * Sirve assets desde cache y guarda una copia si se descargan por primera vez.
 *
 * @param {Request} request Peticion de asset.
 * @returns {Promise<Response>} Respuesta del asset.
 */
async function handleCacheFirst(request) {
  const cachedResponse = await caches.match(request, { ignoreSearch: true });

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }

  return response;
}

/**
 * Indica si una URL pertenece al mismo origen de la aplicacion.
 *
 * @param {string} url URL de la peticion.
 * @returns {boolean} True si es mismo origen.
 */
function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

/**
 * Identifica recursos estaticos que pueden servirse con estrategia cache-first.
 *
 * @param {Request} request Peticion entrante.
 * @returns {boolean} True si el recurso es cacheable con prioridad de cache.
 */
function shouldUseCacheFirst(request) {
  const { pathname } = new URL(request.url);

  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/asset-manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/offline.html'
  );
}
