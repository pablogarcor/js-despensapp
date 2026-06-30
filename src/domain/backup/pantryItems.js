import { DomainError } from '../errors.js';
import {
  assertArray,
  assertUniqueIds,
  isPlainObject,
  parseNonNegativeNumber,
  parseOptionalString,
  parseRequiredString,
} from './parsers.js';

/**
 * Valida alimentos de despensa.
 *
 * @param {unknown} records Registros de entrada.
 * @returns {import('../types.js').PantryItem[]} Alimentos saneados.
 */
export function validatePantryItems(records) {
  assertArray(records, 'El backup debe incluir una lista de alimentos.');
  assertUniqueIds(records, 'Hay alimentos duplicados en el backup.');

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay un alimento con formato invalido.', 'BACKUP_PANTRY_INVALID');
    }

    const id = parseRequiredString(record.id, 'Hay un alimento sin identificador.');
    const name = parseRequiredString(record.name, 'Hay un alimento sin nombre.');
    const unit = parseRequiredString(record.unit, 'Hay un alimento sin unidad.');
    const quantity = parseNonNegativeNumber(record.quantity, 'Hay un alimento con cantidad invalida.');

    return {
      id,
      name,
      quantity,
      unit,
      createdAt: parseOptionalString(record.createdAt),
      updatedAt: parseOptionalString(record.updatedAt),
    };
  });
}
