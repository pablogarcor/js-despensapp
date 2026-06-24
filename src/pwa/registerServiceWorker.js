const SERVICE_WORKER_URL = `${import.meta.env.BASE_URL}sw.js`;
const SERVICE_WORKER_SCOPE = import.meta.env.BASE_URL;

/**
 * Registra el service worker de la PWA cuando el entorno permite cache offline.
 *
 * @returns {void}
 */
export function registerServiceWorker() {
  if (!shouldRegisterServiceWorker()) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE })
      .catch((error) => {
        console.warn('[DespensApp] No se pudo registrar el service worker.', error);
      });
  });
}

/**
 * Evita registrar service workers en desarrollo y en origenes no seguros.
 *
 * @returns {boolean} True si se puede registrar el service worker.
 */
function shouldRegisterServiceWorker() {
  return (
    import.meta.env.PROD &&
    'serviceWorker' in navigator &&
    (window.isSecureContext || isLocalhost(window.location.hostname))
  );
}

/**
 * Permite pruebas locales porque los navegadores tratan localhost como origen seguro.
 *
 * @param {string} hostname Hostname actual.
 * @returns {boolean} True si el hostname es local.
 */
function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
