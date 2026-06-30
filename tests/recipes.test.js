import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServiceWithRecipe } from './helpers/pantryTestHelpers.js';

test('impide borrar recetas planificadas', async () => {
  const { service, recipe } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  await assert.rejects(
    () => service.deleteRecipe(recipe.id),
    /esta planificada/,
  );
});

test('las notas planificadas no bloquean recetas', async () => {
  const { service, recipe } = await createServiceWithRecipe();
  await service.createPlannedNote({
    date: '2026-06-21',
    mealType: 'breakfast',
    title: 'Comer fuera',
  });

  await service.deleteRecipe(recipe.id);
  const dashboard = await service.getDashboard();

  assert.equal(dashboard.recipes.length, 0);
  assert.equal(dashboard.plannedMeals.length, 1);
  assert.equal(dashboard.plannedMeals[0].kind, 'note');
});

test('permite restaurar una receta eliminada', async () => {
  const { service, recipe } = await createServiceWithRecipe();

  const deletedRecipe = await service.deleteRecipe(recipe.id);
  await service.restoreRecipe(deletedRecipe);
  const dashboard = await service.getDashboard();

  assert.equal(dashboard.recipes.length, 1);
  assert.equal(dashboard.recipes[0].id, recipe.id);
  assert.equal(dashboard.recipes[0].name, recipe.name);
});

test('permite vaciar recetas si no estan planificadas', async () => {
  const { service } = await createServiceWithRecipe();

  const deletedCount = await service.clearRecipes();
  const dashboard = await service.getDashboard();

  assert.equal(deletedCount, 1);
  assert.equal(dashboard.recipes.length, 0);
  assert.equal(dashboard.pantryItems.length, 1);
});

test('impide vaciar recetas si hay recetas planificadas', async () => {
  const { service } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  await assert.rejects(
    () => service.clearRecipes(),
    /recetas planificadas/,
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
