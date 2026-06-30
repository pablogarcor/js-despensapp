import { DomainError } from '../errors.js';
import { BACKUP_APP_ID, SUPPORTED_BACKUP_SCHEMA_VERSIONS } from './constants.js';
import { isPlainObject } from './parsers.js';
import { validatePantryItems } from './pantryItems.js';
import { validatePlannedMeals } from './plannedMeals.js';
import { validateRecipes } from './recipes.js';
import { validateShoppingItems } from './shoppingItems.js';

/**
 * Valida y sanea un backup antes de importarlo.
 *
 * @param {unknown} backup Backup parseado desde JSON.
 * @returns {import('../types.js').BackupData} Datos validados.
 */
export function validateBackup(backup) {
  if (!isPlainObject(backup)) {
    throw new DomainError('El archivo de importacion no tiene un formato valido.', 'BACKUP_INVALID');
  }

  if (
    backup.app !== BACKUP_APP_ID ||
    !SUPPORTED_BACKUP_SCHEMA_VERSIONS.includes(backup.schemaVersion)
  ) {
    throw new DomainError('El archivo no pertenece a una version compatible de DespensApp.', 'BACKUP_VERSION');
  }

  if (!isPlainObject(backup.data)) {
    throw new DomainError('El archivo no contiene datos importables.', 'BACKUP_DATA_INVALID');
  }

  const pantryItems = validatePantryItems(backup.data.pantryItems);
  const recipes = validateRecipes(backup.data.recipes, pantryItems);
  const plannedMeals = validatePlannedMeals(backup.data.plannedMeals, recipes, backup.schemaVersion);
  const shoppingItems =
    backup.schemaVersion >= 2
      ? validateShoppingItems(backup.data.shoppingItems, pantryItems)
      : [];

  return {
    pantryItems,
    recipes,
    plannedMeals,
    shoppingItems,
  };
}
