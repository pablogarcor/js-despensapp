const DISMISS_STORAGE_KEY = 'despensapp.installPromptDismissedAt';
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

let deferredInstallPrompt = null;

/**
 * Escucha cambios relevantes para mostrar un aviso de instalacion PWA.
 *
 * @param {(state: PwaInstallPromptState) => void} onChange Callback con el estado actual.
 * @returns {() => void} Funcion para retirar los listeners.
 */
export function watchPwaInstallPrompt(onChange) {
  if (!globalThis.window) {
    return () => {};
  }

  const notify = () => onChange(getPwaInstallPromptState());
  const handleBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notify();
  };
  const handleAppInstalled = () => {
    deferredInstallPrompt = null;
    clearStoredDismissal();
    notify();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  notify();

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}

/**
 * Devuelve el estado actual de instalacion y plataforma.
 *
 * @returns {PwaInstallPromptState} Estado de instalacion PWA.
 */
export function getPwaInstallPromptState() {
  const platform = detectPlatform();
  const isInstalled = isRunningInstalled();
  const wasDismissed = isPromptDismissed();

  return {
    platform,
    isInstalled,
    canUseNativePrompt: Boolean(deferredInstallPrompt),
    shouldShowPrompt: !isInstalled && !wasDismissed,
  };
}

/**
 * Marca el aviso como descartado temporalmente.
 */
export function dismissPwaInstallPrompt() {
  writeStorageValue(DISMISS_STORAGE_KEY, String(Date.now()));
}

/**
 * Lanza el prompt nativo de instalacion si el navegador lo ha ofrecido.
 *
 * @returns {Promise<{outcome?: string} | null>} Resultado del prompt o null.
 */
export async function promptPwaInstall() {
  if (!deferredInstallPrompt) {
    return null;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  return promptEvent.prompt();
}

/**
 * Textos de instalacion adaptados a la plataforma detectada.
 *
 * @param {PwaInstallPromptState} state Estado de instalacion.
 * @returns {{title: string, steps: string[], nativeButtonLabel: string}} Contenido visible.
 */
export function getPwaInstallPromptCopy(state) {
  if (state.platform === 'ios') {
    return {
      title: 'Instala DespensApp',
      steps: [
        'Toca Compartir en Safari.',
        'Elige Añadir a pantalla de inicio.',
        'Confirma con Añadir.',
      ],
      nativeButtonLabel: 'Instalar',
    };
  }

  if (state.platform === 'android') {
    return {
      title: 'Instala DespensApp',
      steps: state.canUseNativePrompt
        ? ['Pulsa Instalar para abrir el aviso del navegador.', 'Confirma la instalacion.']
        : ['Abre el menu del navegador.', 'Toca Instalar app o Añadir a pantalla de inicio.', 'Confirma la instalacion.'],
      nativeButtonLabel: 'Instalar',
    };
  }

  return {
    title: 'Instala DespensApp',
    steps: state.canUseNativePrompt
      ? ['Pulsa Instalar para abrir el aviso del navegador.', 'Confirma la instalacion.']
      : ['Usa el icono de instalar de la barra de direcciones.', 'Tambien puede estar en el menu del navegador.', 'Confirma la instalacion.'],
    nativeButtonLabel: 'Instalar',
  };
}

/**
 * Detecta si la sesion actual se ejecuta como PWA instalada.
 *
 * @returns {boolean} True si se ejecuta instalada o en modo standalone.
 */
function isRunningInstalled() {
  return (
    matchesDisplayMode('standalone') ||
    matchesDisplayMode('fullscreen') ||
    matchesDisplayMode('minimal-ui') ||
    matchesDisplayMode('window-controls-overlay') ||
    globalThis.navigator?.standalone === true
  );
}

/**
 * Comprueba un modo de visualizacion PWA.
 *
 * @param {string} mode Modo CSS display-mode.
 * @returns {boolean} True si coincide.
 */
function matchesDisplayMode(mode) {
  return Boolean(globalThis.window?.matchMedia?.(`(display-mode: ${mode})`)?.matches);
}

/**
 * Clasifica la plataforma para mostrar instrucciones utiles.
 *
 * @returns {'ios' | 'android' | 'desktop'} Plataforma detectada.
 */
function detectPlatform() {
  const userAgent = globalThis.navigator?.userAgent ?? '';
  const platform = globalThis.navigator?.platform ?? '';
  const maxTouchPoints = globalThis.navigator?.maxTouchPoints ?? 0;

  if (/Android/i.test(userAgent)) {
    return 'android';
  }

  if (/iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) {
    return 'ios';
  }

  return 'desktop';
}

/**
 * Indica si el usuario ya descarto el aviso recientemente.
 *
 * @returns {boolean} True si no debe mostrarse todavia.
 */
function isPromptDismissed() {
  const dismissedAt = Number(readStorageValue(DISMISS_STORAGE_KEY));

  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

/**
 * Borra el descarte guardado.
 */
function clearStoredDismissal() {
  try {
    globalThis.localStorage?.removeItem(DISMISS_STORAGE_KEY);
  } catch (error) {
    console.warn('[DespensApp] No se pudo borrar el estado del aviso de instalacion.', error);
  }
}

/**
 * Lee un valor de localStorage sin romper navegadores restrictivos.
 *
 * @param {string} key Clave.
 * @returns {string | null} Valor guardado.
 */
function readStorageValue(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch (error) {
    console.warn('[DespensApp] No se pudo leer el estado del aviso de instalacion.', error);
    return null;
  }
}

/**
 * Guarda un valor en localStorage sin romper navegadores restrictivos.
 *
 * @param {string} key Clave.
 * @param {string} value Valor.
 */
function writeStorageValue(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch (error) {
    console.warn('[DespensApp] No se pudo guardar el estado del aviso de instalacion.', error);
  }
}

/**
 * @typedef {Object} PwaInstallPromptState
 * @property {'ios' | 'android' | 'desktop'} platform Plataforma detectada.
 * @property {boolean} isInstalled Indica si la sesion ya se ejecuta como PWA.
 * @property {boolean} canUseNativePrompt Indica si hay prompt nativo disponible.
 * @property {boolean} shouldShowPrompt Indica si conviene mostrar el aviso.
 */
