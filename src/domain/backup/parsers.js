import { DomainError } from '../errors.js';
import { MEAL_TYPES } from '../types.js';

/**
 * Valida un valor de franja.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {import('../types.js').MealType} Franja valida.
 */
export function parseMealType(value) {
  if (!MEAL_TYPES.includes(value)) {
    throw new DomainError('Hay una franja de comida invalida en el backup.', 'BACKUP_MEAL_TYPE');
  }

  return value;
}

/**
 * Valida un booleano de backup.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {boolean} Booleano validado.
 */
export function parseBoolean(value, errorMessage) {
  if (typeof value !== 'boolean') {
    throw new DomainError(errorMessage, 'BACKUP_BOOLEAN_INVALID');
  }

  return value;
}

/**
 * Valida una fecha YYYY-MM-DD.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Fecha valida.
 */
export function parseDate(value) {
  const date = parseRequiredString(value, 'Hay una comida planificada sin fecha.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DomainError('Hay una comida planificada con fecha invalida.', 'BACKUP_MEAL_DATE');
  }

  return date;
}

/**
 * Valida texto obligatorio.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {string} Texto saneado.
 */
export function parseRequiredString(value, errorMessage) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError(errorMessage, 'BACKUP_STRING_REQUIRED');
  }

  return value.trim();
}

/**
 * Valida texto opcional, rellenando con fecha actual si falta.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Texto saneado.
 */
export function parseOptionalString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : new Date().toISOString();
}

/**
 * Valida texto opcional conservando vacio.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Texto saneado.
 */
export function parseOptionalText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Valida numero mayor o igual a cero.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Numero valido.
 */
export function parseNonNegativeNumber(value, errorMessage) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new DomainError(errorMessage, 'BACKUP_NUMBER_INVALID');
  }

  return number;
}

/**
 * Valida numero positivo.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Numero valido.
 */
export function parsePositiveNumber(value, errorMessage) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new DomainError(errorMessage, 'BACKUP_NUMBER_INVALID');
  }

  return number;
}

/**
 * Comprueba que una entrada sea un array.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 */
export function assertArray(value, errorMessage) {
  if (!Array.isArray(value)) {
    throw new DomainError(errorMessage, 'BACKUP_ARRAY_REQUIRED');
  }
}

/**
 * Comprueba ids unicos en una coleccion.
 *
 * @param {unknown[]} records Registros.
 * @param {string} errorMessage Mensaje si falla.
 */
export function assertUniqueIds(records, errorMessage) {
  const ids = new Set();

  for (const record of records) {
    if (!isPlainObject(record) || typeof record.id !== 'string') {
      continue;
    }

    if (ids.has(record.id)) {
      throw new DomainError(errorMessage, 'BACKUP_DUPLICATED_ID');
    }

    ids.add(record.id);
  }
}

/**
 * Comprueba que un valor sea un objeto plano.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {boolean} Resultado.
 */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
