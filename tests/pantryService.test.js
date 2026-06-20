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

test('permite anadir una comida manual en un hueco libre', async () => {
  const { service, recipe } = await createServiceWithRecipe();

  const meal = await service.createPlannedMeal({
    date: '2026-06-21',
    mealType: 'breakfast',
    recipeId: recipe.id,
    servings: 1.5,
  });
  const dashboard = await service.getDashboard();

  assert.equal(meal.date, '2026-06-21');
  assert.equal(meal.mealType, 'breakfast');
  assert.equal(meal.servings, 1.5);
  assert.equal(dashboard.plannedMeals.length, 1);
  assert.equal(dashboard.missingPlanSlots.length, 20);
});

test('impide anadir dos comidas en el mismo dia y franja', async () => {
  const { service, recipe } = await createServiceWithRecipe();
  const plannedMeal = {
    date: '2026-06-21',
    mealType: 'breakfast',
    recipeId: recipe.id,
    servings: 1,
  };

  await service.createPlannedMeal(plannedMeal);

  await assert.rejects(
    () => service.createPlannedMeal(plannedMeal),
    /Ya existe una comida planificada/,
  );
});

test('impide anadir una receta incompatible con la franja', async () => {
  const { service, recipe } = await createServiceWithRecipe(['breakfast']);

  await assert.rejects(
    () =>
      service.createPlannedMeal({
        date: '2026-06-21',
        mealType: 'lunch',
        recipeId: recipe.id,
        servings: 1,
      }),
    /no esta indicada/,
  );
});

test('completa solo los huecos libres del plan actual', async () => {
  const { service } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });
  const before = await service.getDashboard();

  await service.deletePlannedMeal(before.plannedMeals[0].id);
  const completion = await service.completeWeekPlan({ servings: 2 });
  const after = await service.getDashboard();

  assert.equal(completion.plannedMeals.length, 1);
  assert.equal(completion.missingSlots.length, 0);
  assert.equal(after.plannedMeals.length, 21);
  assert.equal(after.missingPlanSlots.length, 0);
  assert.equal(completion.plannedMeals[0].servings, 2);
});

/**
 * Prepara una base en memoria con una receta compatible con cualquier comida.
 *
 * @param {import('../src/domain/types.js').MealType[]} [mealTypes] Franjas compatibles de la receta.
 * @returns {Promise<{service: PantryService, rice: import('../src/domain/types.js').PantryItem, recipe: import('../src/domain/types.js').Recipe}>}
 * Dependencias de test.
 */
async function createServiceWithRecipe(mealTypes = [...MEAL_TYPES]) {
  const database = new MemoryDatabase();
  const service = new PantryService(database, {
    now: () => fixedDate,
    random: () => 0,
  });
  const rice = await service.createPantryItem({ name: 'Arroz', quantity: 500, unit: 'g' });
  const recipe = await service.createRecipe({
    name: 'Arroz basico',
    mealTypes,
    ingredients: [{ pantryItemId: rice.id, quantity: 100 }],
  });

  return { service, rice, recipe };
}
