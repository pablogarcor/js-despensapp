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

test('permite sumar cantidad a un alimento existente', async () => {
  const { service, rice } = await createServiceWithRecipe();

  const updatedRice = await service.addPantryItemQuantity(rice.id, 250.5);

  assert.equal(updatedRice.quantity, 750.5);
  assert.equal(updatedRice.unit, 'g');
});

test('impide sumar una cantidad no positiva a un alimento', async () => {
  const { service, rice } = await createServiceWithRecipe();

  await assert.rejects(
    () => service.addPantryItemQuantity(rice.id, 0),
    /mayor que cero/,
  );
});

test('permite restar cantidad a un alimento existente', async () => {
  const { service, rice } = await createServiceWithRecipe();

  const updatedRice = await service.subtractPantryItemQuantity(rice.id, 120.25);

  assert.equal(updatedRice.quantity, 379.75);
  assert.equal(updatedRice.unit, 'g');
});

test('restar mas cantidad que el stock disponible deja el alimento a cero', async () => {
  const { service, rice } = await createServiceWithRecipe();

  const updatedRice = await service.subtractPantryItemQuantity(rice.id, 999);

  assert.equal(updatedRice.quantity, 0);
});

test('impide restar una cantidad no positiva a un alimento', async () => {
  const { service, rice } = await createServiceWithRecipe();

  await assert.rejects(
    () => service.subtractPantryItemQuantity(rice.id, 0),
    /mayor que cero/,
  );
});

test('exporta un backup versionado con datos locales', async () => {
  const { service } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  const backup = await service.exportBackup();

  assert.equal(backup.app, 'despensapp');
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.data.pantryItems.length, 1);
  assert.equal(backup.data.recipes.length, 1);
  assert.equal(backup.data.plannedMeals.length, 21);
});

test('importa un backup reemplazando datos actuales', async () => {
  const source = await createServiceWithRecipe();
  const backup = await source.service.exportBackup();
  const targetDatabase = new MemoryDatabase();
  const targetService = new PantryService(targetDatabase, { now: () => fixedDate });
  await targetService.createPantryItem({ name: 'Lentejas', quantity: 300, unit: 'g' });

  const summary = await targetService.importBackup(JSON.stringify(backup));
  const dashboard = await targetService.getDashboard();

  assert.deepEqual(summary, {
    pantryItems: 1,
    recipes: 1,
    plannedMeals: 0,
  });
  assert.equal(dashboard.pantryItems.length, 1);
  assert.equal(dashboard.pantryItems[0].name, 'Arroz');
  assert.equal(dashboard.recipes[0].name, 'Arroz basico');
});

test('rechaza backups con relaciones invalidas sin reemplazar los datos actuales', async () => {
  const { service } = await createServiceWithRecipe();
  const invalidBackup = {
    app: 'despensapp',
    schemaVersion: 1,
    exportedAt: fixedDate.toISOString(),
    data: {
      pantryItems: [],
      recipes: [
        {
          id: 'recipe_invalid',
          name: 'Receta rota',
          mealTypes: ['lunch'],
          ingredients: [{ pantryItemId: 'item_missing', quantity: 1 }],
          createdAt: fixedDate.toISOString(),
          updatedAt: fixedDate.toISOString(),
        },
      ],
      plannedMeals: [],
    },
  };

  await assert.rejects(
    () => service.importBackup(JSON.stringify(invalidBackup)),
    /alimento inexistente/,
  );

  const dashboard = await service.getDashboard();
  assert.equal(dashboard.pantryItems.length, 1);
  assert.equal(dashboard.recipes.length, 1);
});

test('impide borrar recetas planificadas', async () => {
  const { service, recipe } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  await assert.rejects(
    () => service.deleteRecipe(recipe.id),
    /esta planificada/,
  );
});

test('permite editar ingredientes y cantidades de una receta existente', async () => {
  const { service, rice, recipe } = await createServiceWithRecipe();
  const tomato = await service.createPantryItem({ name: 'Tomate', quantity: 4, unit: 'ud' });

  const updatedRecipe = await service.updateRecipe(recipe.id, {
    name: 'Arroz con tomate',
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { pantryItemId: rice.id, quantity: 150 },
      { pantryItemId: tomato.id, quantity: 1 },
    ],
  });

  assert.equal(updatedRecipe.id, recipe.id);
  assert.equal(updatedRecipe.name, 'Arroz con tomate');
  assert.deepEqual(updatedRecipe.mealTypes, ['lunch', 'dinner']);
  assert.deepEqual(updatedRecipe.ingredients, [
    { pantryItemId: rice.id, quantity: 150 },
    { pantryItemId: tomato.id, quantity: 1 },
  ]);
});

test('impide editar una receta planificada dejando una franja incompatible', async () => {
  const { service, rice, recipe } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  await assert.rejects(
    () =>
      service.updateRecipe(recipe.id, {
        name: recipe.name,
        mealTypes: ['breakfast'],
        ingredients: [{ pantryItemId: rice.id, quantity: 100 }],
      }),
    /quitar una franja/,
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

test('indica que recetas y fechas no se podrian cocinar con la despensa actual', async () => {
  const { service } = await createServiceWithRecipe();

  await service.planNextWeek({ servings: 2 });
  const dashboard = await service.getDashboard();
  const firstUnavailableMeal = dashboard.unavailableMeals[0];

  assert.ok(firstUnavailableMeal);
  assert.equal(firstUnavailableMeal.date, '2026-06-21');
  assert.equal(firstUnavailableMeal.mealType, 'dinner');
  assert.equal(firstUnavailableMeal.recipeName, 'Arroz basico');
  assert.equal(firstUnavailableMeal.missingIngredients.length, 1);
  assert.equal(firstUnavailableMeal.missingIngredients[0].name, 'Arroz');
  assert.equal(firstUnavailableMeal.missingIngredients[0].missingQuantity, 100);
  assert.equal(firstUnavailableMeal.missingIngredients[0].unit, 'g');
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
