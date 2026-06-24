import { fromISODate } from '../domain/planning.js';
import { DEFAULT_UNITS } from '../domain/types.js';

/**
 * Formatea cantidades evitando decimales innecesarios.
 *
 * @param {number} value Cantidad.
 * @returns {string} Cantidad visible.
 */
export function formatQuantity(value) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatea fechas para lectura en movil.
 *
 * @param {string} isoDate Fecha YYYY-MM-DD.
 * @returns {string} Fecha visible.
 */
export function formatDate(isoDate) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(fromISODate(isoDate));
}

/**
 * Resume cada dia del plan para la navegacion semanal.
 *
 * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
 * @returns {Array<{date: string, weekday: string, dayNumber: string, longLabel: string, statusClass: string}>} Dias.
 */
export function getPlanDaySummaries(dashboard) {
  const dates = new Set();

  for (const meal of dashboard.plannedMeals) {
    dates.add(meal.date);
  }

  for (const slot of dashboard.missingPlanSlots) {
    dates.add(slot.date);
  }

  return [...dates]
    .sort((leftDate, rightDate) => leftDate.localeCompare(rightDate))
    .map((date) => {
      const hasMissingFood = dashboard.unavailableMeals.some((meal) => meal.date === date);
      const hasOpenSlots = dashboard.missingPlanSlots.some((slot) => slot.date === date);
      const dateValue = fromISODate(date);

      return {
        date,
        weekday: new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
          .format(dateValue)
          .replace('.', ''),
        dayNumber: new Intl.DateTimeFormat('es-ES', { day: 'numeric' }).format(dateValue),
        longLabel: new Intl.DateTimeFormat('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(dateValue),
        statusClass: hasMissingFood ? 'has-shortage' : hasOpenSlots ? 'has-open-slots' : 'is-complete',
      };
    });
}

/**
 * Normaliza texto de busqueda para comparar sin acentos ni mayusculas.
 *
 * @param {unknown} value Texto original.
 * @returns {string} Texto normalizado.
 */
export function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Comprueba si un texto contiene la busqueda normalizada.
 *
 * @param {unknown} value Texto candidato.
 * @param {string} normalizedQuery Busqueda ya normalizada.
 * @returns {boolean} True si coincide.
 */
export function matchesSearchText(value, normalizedQuery) {
  return normalizeSearchText(value).includes(normalizedQuery);
}

/**
 * Renderiza opciones de unidad conservando unidades importadas no predefinidas.
 *
 * @param {string} [selectedUnit] Unidad seleccionada.
 * @returns {string} HTML de opciones.
 */
export function renderUnitOptions(selectedUnit) {
  const units = selectedUnit && !DEFAULT_UNITS.includes(selectedUnit)
    ? [...DEFAULT_UNITS, selectedUnit]
    : [...DEFAULT_UNITS];

  return units
    .map((unit) => `
      <option value="${escapeAttribute(unit)}" ${selectedUnit === unit ? 'selected' : ''}>
        ${escapeHtml(unit)}
      </option>
    `)
    .join('');
}

/**
 * Escapa texto dinamico antes de insertarlo en plantillas HTML.
 *
 * @param {unknown} value Valor dinamico.
 * @returns {string} Texto seguro para contenido HTML.
 */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Escapa texto dinamico usado en atributos HTML.
 *
 * @param {unknown} value Valor dinamico.
 * @returns {string} Texto seguro para atributo.
 */
export function escapeAttribute(value) {
  return escapeHtml(value);
}
