import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION } from './constants.js';

/**
 * Construye un backup JSON versionado de los datos locales.
 *
 * @param {Object} params Datos a exportar.
 * @param {import('../types.js').PantryItem[]} params.pantryItems Alimentos.
 * @param {import('../types.js').Recipe[]} params.recipes Recetas.
 * @param {import('../types.js').PlannedMeal[]} params.plannedMeals Comidas planificadas.
 * @param {import('../types.js').ShoppingItem[]} [params.shoppingItems] Entradas de compra.
 * @param {string} params.exportedAt Fecha ISO de exportacion.
 * @returns {import('../types.js').PantryBackup} Backup serializable.
 */
export function createBackup({ pantryItems, recipes, plannedMeals, shoppingItems = [], exportedAt }) {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: {
      pantryItems,
      recipes,
      plannedMeals,
      shoppingItems,
    },
  };
}
