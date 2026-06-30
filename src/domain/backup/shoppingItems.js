import { DomainError } from '../errors.js';
import {
  assertArray,
  assertUniqueIds,
  isPlainObject,
  parseBoolean,
  parseOptionalString,
  parsePositiveNumber,
  parseRequiredString,
} from './parsers.js';

/**
 * Valida estado y extras de lista de compra.
 *
 * @param {unknown} records Registros de entrada.
 * @param {import('../types.js').PantryItem[]} pantryItems Alimentos validados.
 * @returns {import('../types.js').ShoppingItem[]} Entradas saneadas.
 */
export function validateShoppingItems(records, pantryItems) {
  assertArray(records, 'El backup debe incluir una lista de compra.');
  assertUniqueIds(records, 'Hay entradas de compra duplicadas en el backup.');

  const pantryIds = new Set(pantryItems.map((item) => item.id));
  const generatedPantryIds = new Set();

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay una entrada de compra con formato invalido.', 'BACKUP_SHOPPING_INVALID');
    }

    const id = parseRequiredString(record.id, 'Hay una entrada de compra sin identificador.');
    const kind = parseShoppingItemKind(record.kind);
    const checked = parseBoolean(record.checked, 'Hay una entrada de compra con marcado invalido.');
    const createdAt = parseOptionalString(record.createdAt);
    const updatedAt = parseOptionalString(record.updatedAt);

    if (kind === 'generated') {
      const pantryItemId = parseRequiredString(record.pantryItemId, 'Hay una compra generada sin alimento.');

      if (!pantryIds.has(pantryItemId)) {
        throw new DomainError('Hay una compra generada con un alimento inexistente.', 'BACKUP_SHOPPING_PANTRY');
      }

      if (generatedPantryIds.has(pantryItemId)) {
        throw new DomainError('Hay compras generadas duplicadas para un alimento.', 'BACKUP_SHOPPING_DUPLICATED');
      }

      generatedPantryIds.add(pantryItemId);

      return {
        id,
        kind,
        pantryItemId,
        checked,
        createdAt,
        updatedAt,
      };
    }

    return {
      id,
      kind,
      name: parseRequiredString(record.name, 'Hay un extra de compra sin nombre.'),
      quantity: parsePositiveNumber(record.quantity, 'Hay un extra de compra con cantidad invalida.'),
      unit: parseRequiredString(record.unit, 'Hay un extra de compra sin unidad.'),
      checked,
      createdAt,
      updatedAt,
    };
  });
}

/**
 * Valida el origen de una entrada de compra.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {import('../types.js').ShoppingItemKind} Tipo valido.
 */
function parseShoppingItemKind(value) {
  if (value !== 'generated' && value !== 'extra') {
    throw new DomainError('Hay un tipo de compra invalido en el backup.', 'BACKUP_SHOPPING_KIND');
  }

  return value;
}
