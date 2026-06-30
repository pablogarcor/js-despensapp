import { DomainError } from '../../domain/errors.js';
import { roundQuantity } from '../../domain/planning.js';

/**
 * Limpia texto de formularios.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Texto normalizado.
 */
export function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Parsea una cantidad mayor o igual que cero.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Cantidad.
 */
export function parseNonNegativeQuantity(value, errorMessage) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new DomainError(errorMessage, 'INVALID_QUANTITY');
  }

  return roundQuantity(parsedValue);
}

/**
 * Parsea una cantidad estrictamente positiva.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Cantidad.
 */
export function parsePositiveQuantity(value, errorMessage) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new DomainError(errorMessage, 'INVALID_QUANTITY');
  }

  return roundQuantity(parsedValue);
}
