import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServiceWithRecipe, createTestService } from './helpers/pantryTestHelpers.js';

test('impide borrar alimentos usados por recetas', async () => {
  const { service, rice } = await createServiceWithRecipe();

  await assert.rejects(
    () => service.deletePantryItem(rice.id),
    /porque se usa/,
  );
});

test('permite vaciar la despensa si ningun alimento se usa en recetas', async () => {
  const { service } = createTestService();

  await service.createPantryItem({ name: 'Arroz', quantity: 500, unit: 'g' });
  await service.createPantryItem({ name: 'Tomate', quantity: 4, unit: 'ud' });

  const deletedCount = await service.clearPantryItems();
  const dashboard = await service.getDashboard();

  assert.equal(deletedCount, 2);
  assert.equal(dashboard.pantryItems.length, 0);
});

test('impide vaciar la despensa si hay recetas que usan alimentos', async () => {
  const { service } = await createServiceWithRecipe();

  await assert.rejects(
    () => service.clearPantryItems(),
    /usa alimentos guardados/,
  );
});

test('permite editar nombre y cantidad de un alimento existente', async () => {
  const { service, rice } = await createServiceWithRecipe();

  const updatedRice = await service.updatePantryItem(rice.id, {
    name: 'Arroz integral',
    quantity: 750,
    unit: 'g',
  });

  assert.equal(updatedRice.id, rice.id);
  assert.equal(updatedRice.name, 'Arroz integral');
  assert.equal(updatedRice.quantity, 750);
  assert.equal(updatedRice.unit, 'g');
});

test('impide editar un alimento con un nombre duplicado', async () => {
  const { service, rice } = await createServiceWithRecipe();
  await service.createPantryItem({ name: 'Pasta', quantity: 300, unit: 'g' });

  await assert.rejects(
    () =>
      service.updatePantryItem(rice.id, {
        name: 'Pasta',
        quantity: 500,
        unit: 'g',
      }),
    /Ya existe un alimento/,
  );
});

test('impide cambiar unidad de un alimento usado en recetas sin actualizar esas recetas', async () => {
  const { service, rice } = await createServiceWithRecipe();

  await assert.rejects(
    () =>
      service.updatePantryItem(rice.id, {
        name: 'Arroz redondo',
        quantity: 500,
        unit: 'kg',
      }),
    /Actualiza la cantidad/,
  );
});

test('cambiar unidad de un alimento actualiza cantidades en las recetas que lo usan', async () => {
  const { service, rice, recipe } = await createServiceWithRecipe();

  await service.updatePantryItem(rice.id, {
    name: 'Arroz redondo',
    quantity: 500,
    unit: 'kg',
    recipeIngredientUpdates: [{ recipeId: recipe.id, quantity: 0.1 }],
  });
  const dashboard = await service.getDashboard();
  const updatedRecipe = dashboard.recipes.find((candidate) => candidate.id === recipe.id);

  assert.equal(updatedRecipe.ingredients[0].pantryItemId, rice.id);
  assert.equal(updatedRecipe.ingredients[0].quantity, 0.1);
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
