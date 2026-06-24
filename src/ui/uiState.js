/**
 * Crea una fila de ingrediente para el formulario.
 *
 * @param {{pantryItemId?: string, quantity?: string}} [initialValues] Valores iniciales.
 * @returns {{id: string, pantryItemId: string, quantity: string}} Estado inicial.
 */
export function createIngredientRow(initialValues = {}) {
  return {
    id: createUiId('ingredient'),
    pantryItemId: initialValues.pantryItemId ?? '',
    quantity: initialValues.quantity ?? '',
  };
}

/**
 * Crea un identificador efimero para estado local de interfaz.
 *
 * @param {string} prefix Prefijo legible.
 * @returns {string} Identificador de UI.
 */
export function createUiId(prefix) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())}`;
}
