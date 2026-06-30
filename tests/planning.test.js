import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEAL_TYPES } from '../src/domain/types.js';
import { createServiceWithRecipe } from './helpers/pantryTestHelpers.js';

test('planifica siete dias con desayuno comida y cena', async () => {
  const { service } = await createServiceWithRecipe();

  const result = await service.planNextWeek({ servings: 2 });
  const dashboard = await service.getDashboard();

  assert.equal(result.missingSlots.length, 0);
  assert.equal(dashboard.plannedMeals.length, 7 * MEAL_TYPES.length);
  assert.equal(dashboard.plannedMeals[0].date, '2026-06-21');
  assert.equal(dashboard.plannedMeals[0].servings, 2);
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

test('permite añadir una comida manual en un hueco libre', async () => {
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

test('permite añadir una nota manual en un hueco libre sin generar compra', async () => {
  const { service } = await createServiceWithRecipe();

  const note = await service.createPlannedNote({
    date: '2026-06-21',
    mealType: 'dinner',
    title: 'Sobras',
    note: 'Arroz de ayer',
  });
  const dashboard = await service.getDashboard();

  assert.equal(note.kind, 'note');
  assert.equal(note.title, 'Sobras');
  assert.equal(note.note, 'Arroz de ayer');
  assert.equal(dashboard.plannedMeals.length, 1);
  assert.equal(dashboard.missingPlanSlots.length, 20);
  assert.equal(dashboard.shoppingList.length, 0);
  assert.equal(dashboard.unavailableMeals.length, 0);
});

test('impide añadir una nota duplicando una fecha y franja ocupada', async () => {
  const { service } = await createServiceWithRecipe();
  await service.createPlannedNote({
    date: '2026-06-21',
    mealType: 'dinner',
    title: 'Congelado',
  });

  await assert.rejects(
    () =>
      service.createPlannedNote({
        date: '2026-06-21',
        mealType: 'dinner',
        title: 'Comer fuera',
      }),
    /Ya existe una comida planificada/,
  );
});

test('permite editar una nota planificada conservando fecha y franja', async () => {
  const { service } = await createServiceWithRecipe();
  const note = await service.createPlannedNote({
    date: '2026-06-21',
    mealType: 'lunch',
    title: 'Comer fuera',
  });

  const updatedNote = await service.updatePlannedNote(note.id, {
    title: 'Otro motivo',
    note: 'Cumpleanos',
  });

  assert.equal(updatedNote.id, note.id);
  assert.equal(updatedNote.date, '2026-06-21');
  assert.equal(updatedNote.mealType, 'lunch');
  assert.equal(updatedNote.title, 'Otro motivo');
  assert.equal(updatedNote.note, 'Cumpleanos');
});

test('normaliza el motivo antiguo Nota libre a Otro motivo', async () => {
  const { service } = await createServiceWithRecipe();

  const note = await service.createPlannedNote({
    date: '2026-06-21',
    mealType: 'lunch',
    title: 'Nota libre',
    note: 'Plan flexible',
  });

  assert.equal(note.title, 'Otro motivo');
});

test('resolver una nota pasada no descuenta ingredientes', async () => {
  const { service, rice } = await createServiceWithRecipe();
  const note = await service.createPlannedNote({
    date: '2026-06-21',
    mealType: 'dinner',
    title: 'Sobras',
  });

  await service.resolvePastMeal(note.id, true);
  const dashboard = await service.getDashboard();
  const updatedRice = dashboard.pantryItems.find((item) => item.id === rice.id);

  assert.equal(updatedRice.quantity, 500);
  assert.equal(dashboard.plannedMeals.length, 0);
});

test('muestra huecos de la siguiente semana aunque el plan este vacio', async () => {
  const { service } = await createServiceWithRecipe();
  const dashboard = await service.getDashboard();

  assert.equal(dashboard.plannedMeals.length, 0);
  assert.equal(dashboard.missingPlanSlots.length, 7 * MEAL_TYPES.length);
  assert.equal(dashboard.missingPlanSlots[0].date, '2026-06-21');
  assert.deepEqual(
    dashboard.missingPlanSlots.slice(0, MEAL_TYPES.length).map((slot) => slot.mealType),
    MEAL_TYPES,
  );
});

test('impide añadir dos comidas en el mismo dia y franja', async () => {
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

test('impide añadir una receta incompatible con la franja', async () => {
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

test('permite editar receta y raciones de una comida planificada', async () => {
  const { service, recipe } = await createServiceWithRecipe();
  const meal = await service.createPlannedMeal({
    date: '2026-06-21',
    mealType: 'breakfast',
    recipeId: recipe.id,
    servings: 1,
  });

  const updatedMeal = await service.updatePlannedMeal(meal.id, {
    recipeId: recipe.id,
    servings: 2.5,
  });

  assert.equal(updatedMeal.id, meal.id);
  assert.equal(updatedMeal.date, '2026-06-21');
  assert.equal(updatedMeal.mealType, 'breakfast');
  assert.equal(updatedMeal.servings, 2.5);
});

test('permite convertir una comida planificada en no cocinar conservando el hueco', async () => {
  const { service, recipe } = await createServiceWithRecipe();
  const meal = await service.createPlannedMeal({
    date: '2026-06-21',
    mealType: 'breakfast',
    recipeId: recipe.id,
    servings: 1,
  });

  const updatedMeal = await service.convertPlannedMealToNote(meal.id, {
    title: 'Comer fuera',
    note: 'Sobras',
  });
  const dashboard = await service.getDashboard();

  assert.equal(updatedMeal.id, meal.id);
  assert.equal(updatedMeal.kind, 'note');
  assert.equal(updatedMeal.date, '2026-06-21');
  assert.equal(updatedMeal.mealType, 'breakfast');
  assert.equal(updatedMeal.title, 'Comer fuera');
  assert.equal(updatedMeal.note, 'Sobras');
  assert.equal('recipeId' in updatedMeal, false);
  assert.equal('servings' in updatedMeal, false);
  assert.equal(dashboard.plannedMeals.length, 1);
  assert.equal(dashboard.shoppingList.length, 0);
});

test('impide editar una comida con receta incompatible', async () => {
  const { service, rice, recipe } = await createServiceWithRecipe(['breakfast']);
  const meal = await service.createPlannedMeal({
    date: '2026-06-21',
    mealType: 'breakfast',
    recipeId: recipe.id,
    servings: 1,
  });
  const lunchRecipe = await service.createRecipe({
    name: 'Arroz comida',
    mealTypes: ['lunch'],
    ingredients: [{ pantryItemId: rice.id, quantity: 100 }],
  });

  await assert.rejects(
    () =>
      service.updatePlannedMeal(meal.id, {
        recipeId: lunchRecipe.id,
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
