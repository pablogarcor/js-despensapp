import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServiceWithRecipe } from './helpers/pantryTestHelpers.js';

test('calcula lista de compra cuando el plan supera la despensa', async () => {
  const { service } = await createServiceWithRecipe();

  await service.planNextWeek({ servings: 2 });
  const dashboard = await service.getDashboard();
  const riceShortage = dashboard.shoppingList.find((item) => item.name === 'Arroz');

  assert.ok(riceShortage);
  assert.equal(riceShortage.unit, 'g');
  assert.ok(riceShortage.missingQuantity > 0);
});

test('permite marcar faltantes generados y sumar la compra a la despensa', async () => {
  const { service, rice } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });
  const before = await service.getDashboard();
  const riceShortage = before.shoppingList.find((item) => item.name === 'Arroz');

  await service.setShoppingItemChecked(riceShortage.shoppingItemId, true);
  const marked = await service.getDashboard();
  const markedRiceShortage = marked.shoppingList.find((item) => item.name === 'Arroz');
  const summary = await service.applyShoppingPurchase();
  const after = await service.getDashboard();
  const updatedRice = after.pantryItems.find((item) => item.id === rice.id);

  assert.equal(markedRiceShortage.checked, true);
  assert.equal(summary.purchasedItems, 1);
  assert.equal(summary.updatedPantryItems, 1);
  assert.equal(summary.createdPantryItems, 0);
  assert.equal(updatedRice.quantity, 2100);
  assert.equal(after.shoppingList.length, 0);
});

test('limpia el marcado generado cuando se ajusta stock manualmente', async () => {
  const { service, rice } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });
  const before = await service.getDashboard();
  const riceShortage = before.shoppingList.find((item) => item.name === 'Arroz');

  await service.setShoppingItemChecked(riceShortage.shoppingItemId, true);
  await service.addPantryItemQuantity(rice.id, 100);
  const after = await service.getDashboard();
  const updatedRiceShortage = after.shoppingList.find((item) => item.name === 'Arroz');

  assert.equal(updatedRiceShortage.missingQuantity, 1500);
  assert.equal(updatedRiceShortage.checked, false);
});

test('permite comprar extras y sumarlos a alimentos existentes o nuevos', async () => {
  const { service, rice } = await createServiceWithRecipe();
  const riceExtra = await service.createShoppingExtra({ name: 'Arroz', quantity: 250, unit: 'g' });
  const milkExtra = await service.createShoppingExtra({ name: 'Leche', quantity: 2, unit: 'l' });

  await service.setShoppingItemChecked(riceExtra.id, true);
  await service.setShoppingItemChecked(milkExtra.id, true);
  const summary = await service.applyShoppingPurchase();
  const dashboard = await service.getDashboard();
  const updatedRice = dashboard.pantryItems.find((item) => item.id === rice.id);
  const milk = dashboard.pantryItems.find((item) => item.name === 'Leche');

  assert.equal(summary.purchasedItems, 2);
  assert.equal(summary.updatedPantryItems, 1);
  assert.equal(summary.createdPantryItems, 1);
  assert.equal(updatedRice.quantity, 750);
  assert.equal(milk.quantity, 2);
  assert.equal(milk.unit, 'l');
  assert.equal(dashboard.shoppingExtras.length, 0);
});

test('impide aplicar un extra con la misma despensa pero distinta unidad', async () => {
  const { service } = await createServiceWithRecipe();
  const riceExtra = await service.createShoppingExtra({ name: 'Arroz', quantity: 1, unit: 'kg' });

  await service.setShoppingItemChecked(riceExtra.id, true);

  await assert.rejects(
    () => service.applyShoppingPurchase(),
    /ya existe en g/,
  );
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
