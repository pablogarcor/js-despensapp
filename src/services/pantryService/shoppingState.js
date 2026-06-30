const GENERATED_SHOPPING_PREFIX = 'shopping_generated_';

/**
 * Ordena entradas persistidas de compra de forma estable.
 *
 * @param {import('../../domain/types.js').ShoppingItem[]} shoppingItems Entradas.
 * @returns {import('../../domain/types.js').ShoppingItem[]} Entradas ordenadas.
 */
export function sortShoppingItems(shoppingItems) {
  return [...shoppingItems].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind, 'es');
    }

    const leftLabel = left.name ?? left.pantryItemId ?? '';
    const rightLabel = right.name ?? right.pantryItemId ?? '';
    return leftLabel.localeCompare(rightLabel, 'es');
  });
}

/**
 * Devuelve solo extras manuales ordenados por nombre.
 *
 * @param {import('../../domain/types.js').ShoppingItem[]} shoppingItems Entradas persistidas.
 * @returns {import('../../domain/types.js').ShoppingItem[]} Extras manuales.
 */
export function sortShoppingExtras(shoppingItems) {
  return shoppingItems
    .filter((shoppingItem) => shoppingItem.kind === 'extra')
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

/**
 * Anade estado persistido a los faltantes generados por el plan.
 *
 * @param {Object} params Parametros.
 * @param {import('../../domain/types.js').ShoppingListItem[]} params.shoppingList Faltantes calculados.
 * @param {import('../../domain/types.js').ShoppingItem[]} params.shoppingItems Estado persistido.
 * @returns {import('../../domain/types.js').ShoppingListItem[]} Lista accionable.
 */
export function buildShoppingListWithState({ shoppingList, shoppingItems }) {
  const statesByPantryItemId = new Map(
    shoppingItems
      .filter((shoppingItem) => shoppingItem.kind === 'generated')
      .map((shoppingItem) => [shoppingItem.pantryItemId, shoppingItem]),
  );

  return shoppingList.map((item) => {
    const state = statesByPantryItemId.get(item.pantryItemId);

    return {
      ...item,
      shoppingItemId: state?.id ?? createGeneratedShoppingItemId(item.pantryItemId),
      checked: state?.checked === true,
    };
  });
}

/**
 * Crea el id estable para guardar estado de un faltante generado.
 *
 * @param {string} pantryItemId Identificador de alimento.
 * @returns {string} Identificador de compra.
 */
export function createGeneratedShoppingItemId(pantryItemId) {
  return `${GENERATED_SHOPPING_PREFIX}${pantryItemId}`;
}

/**
 * Comprueba si un id pertenece a una compra generada.
 *
 * @param {string} shoppingItemId Identificador de compra.
 * @returns {boolean} True si es generado.
 */
export function isGeneratedShoppingItemId(shoppingItemId) {
  return shoppingItemId.startsWith(GENERATED_SHOPPING_PREFIX);
}

/**
 * Extrae el alimento desde un id de compra generada.
 *
 * @param {string} shoppingItemId Identificador de compra generada.
 * @returns {string} Identificador de alimento.
 */
export function getPantryItemIdFromGeneratedShoppingId(shoppingItemId) {
  return shoppingItemId.slice(GENERATED_SHOPPING_PREFIX.length);
}
