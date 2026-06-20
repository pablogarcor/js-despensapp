import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEAL_TYPES } from '../src/domain/types.js';
import { MemoryDatabase } from '../src/storage/memoryDatabase.js';
import { PantryService } from '../src/services/pantryService.js';

const fixedDate = new Date('2026-06-20T12:00:00');

test('impide borrar alimentos usados por recetas', async () => {
  const { service, rice } = await createServiceWithRecipe();

  await assert.rejects(
    () => service.deletePantryItem(rice.id),
    /porque se usa/,
  );
});

test('impide borrar recetas planificadas', async () => {
  const { service, recipe } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  await assert.rejects(
    () => service.deleteRecipe(recipe.id),
    /esta planificada/,
  );
});

test('planifica siete dias con desayuno comida y cena', async () => {
  const { service } = await createServiceWithRecipe();

  const result = await service.planNextWeek({ servings: 2 });
  const dashboard = await service.getDashboard();

  assert.equal(result.missingSlots.length, 0);
  assert.equal(dashboard.plannedMeals.length, 7 * MEAL_TYPES.length);
  assert.equal(dashboard.plannedMeals[0].date, '2026-06-21');
  assert.equal(dashboard.plannedMeals[0].servings, 2);
});

test('calcula lista de compra cuando el plan supera la despensa', async () => {
  const { service } = await createServiceWithRecipe();

  await service.planNextWeek({ servings: 2 });
  const dashboard = await service.getDashboard();
  const riceShortage = dashboard.shoppingList.find((item) => item.name === 'Arroz');

  assert.ok(riceShortage);
  assert.equal(riceShortage.unit, 'g');
  assert.ok(riceShortage.missingQuantity > 0);
});

test('resolver comida hecha descuenta ingredientes y borra la planificacion', async () => {
  const { service, rice } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });
  const before = await service.getDashboard();
  const meal = before.plannedMeals[0];

  await service.resolvePastMeal(meal.id, true);
  const after = await service.getDashboard();
  const updatedRice = after.pantryItems.find((item) => item.id === rice.id);

  assert.equal(after.plannedMeals.length, 20);
  assert.equal(updatedRice.quantity, 400);
});

/**
 * Prepara una base en memoria con una receta compatible con cualquier comida.
 *
 * @returns {Promise<{service: PantryService, rice: import('../src/domain/types.js').PantryItem, recipe: import('../src/domain/types.js').Recipe}>}
 * Dependencias de test.
 */
async function createServiceWithRecipe() {
  const database = new MemoryDatabase();
  const service = new PantryService(database, {
    now: () => fixedDate,
    random: () => 0,
  });
  const rice = await service.createPantryItem({ name: 'Arroz', quantity: 500, unit: 'g' });
  const recipe = await service.createRecipe({
    name: 'Arroz basico',
    mealTypes: [...MEAL_TYPES],
    ingredients: [{ pantryItemId: rice.id, quantity: 100 }],
  });

  return { service, rice, recipe };
}
