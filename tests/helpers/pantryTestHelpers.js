import { MEAL_TYPES } from '../../src/domain/types.js';
import { MemoryDatabase } from '../../src/storage/memoryDatabase.js';
import { PantryService } from '../../src/services/pantryService.js';

export const fixedDate = new Date('2026-06-20T12:00:00');

/**
 * Crea un servicio con dependencias deterministas para tests.
 *
 * @returns {{database: MemoryDatabase, service: PantryService}} Dependencias de test.
 */
export function createTestService() {
  const database = new MemoryDatabase();
  const service = new PantryService(database, {
    now: () => fixedDate,
    random: () => 0,
  });

  return { database, service };
}

/**
 * Prepara una base en memoria con una receta compatible con varias franjas.
 *
 * @param {import('../../src/domain/types.js').MealType[]} [mealTypes] Franjas compatibles de la receta.
 * @returns {Promise<{service: PantryService, rice: import('../../src/domain/types.js').PantryItem, recipe: import('../../src/domain/types.js').Recipe}>}
 * Dependencias de test.
 */
export async function createServiceWithRecipe(mealTypes = [...MEAL_TYPES]) {
  const { service } = createTestService();
  const rice = await service.createPantryItem({ name: 'Arroz', quantity: 500, unit: 'g' });
  const recipe = await service.createRecipe({
    name: 'Arroz basico',
    mealTypes,
    ingredients: [{ pantryItemId: rice.id, quantity: 100 }],
  });

  return { service, rice, recipe };
}
