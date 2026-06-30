import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServiceWithRecipe } from './helpers/pantryTestHelpers.js';

test('borra todos los datos principales aunque existan relaciones entre tablas', async () => {
  const { service } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  const summary = await service.clearAllData();
  const dashboard = await service.getDashboard();

  assert.equal(summary.pantryItems, 1);
  assert.equal(summary.recipes, 1);
  assert.equal(summary.plannedMeals, 21);
  assert.equal(summary.shoppingItems, 0);
  assert.equal(dashboard.pantryItems.length, 0);
  assert.equal(dashboard.recipes.length, 0);
  assert.equal(dashboard.plannedMeals.length, 0);
});

test('borrar todos los datos limpia tambien extras de compra', async () => {
  const { service } = await createServiceWithRecipe();
  await service.createShoppingExtra({ name: 'Cafe', quantity: 1, unit: 'ud' });

  const summary = await service.clearAllData();
  const dashboard = await service.getDashboard();

  assert.equal(summary.shoppingItems, 1);
  assert.equal(dashboard.shoppingExtras.length, 0);
});
