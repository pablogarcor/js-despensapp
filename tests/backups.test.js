import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createServiceWithRecipe,
  createTestService,
  fixedDate,
} from './helpers/pantryTestHelpers.js';

test('exporta un backup versionado con datos locales', async () => {
  const { service } = await createServiceWithRecipe();
  await service.planNextWeek({ servings: 1 });

  const backup = await service.exportBackup();

  assert.equal(backup.app, 'despensapp');
  assert.equal(backup.schemaVersion, 3);
  assert.equal(backup.data.pantryItems.length, 1);
  assert.equal(backup.data.recipes.length, 1);
  assert.equal(backup.data.plannedMeals.length, 21);
  assert.equal(backup.data.shoppingItems.length, 0);
});

test('importa un backup reemplazando datos actuales', async () => {
  const source = await createServiceWithRecipe();
  const backup = await source.service.exportBackup();
  const { service: targetService } = createTestService();
  await targetService.createPantryItem({ name: 'Lentejas', quantity: 300, unit: 'g' });

  const summary = await targetService.importBackup(JSON.stringify(backup));
  const dashboard = await targetService.getDashboard();

  assert.deepEqual(summary, {
    pantryItems: 1,
    recipes: 1,
    plannedMeals: 0,
    shoppingItems: 0,
  });
  assert.equal(dashboard.pantryItems.length, 1);
  assert.equal(dashboard.pantryItems[0].name, 'Arroz');
  assert.equal(dashboard.recipes[0].name, 'Arroz basico');
});

test('importa backups version 1 sin lista de compra', async () => {
  const source = await createServiceWithRecipe();
  const backup = await source.service.exportBackup();
  const legacyBackup = {
    ...backup,
    schemaVersion: 1,
    data: {
      pantryItems: backup.data.pantryItems,
      recipes: backup.data.recipes,
      plannedMeals: backup.data.plannedMeals,
    },
  };
  const { service: targetService } = createTestService();

  const summary = await targetService.importBackup(JSON.stringify(legacyBackup));
  const dashboard = await targetService.getDashboard();

  assert.equal(summary.shoppingItems, 0);
  assert.equal(dashboard.shoppingList.length, 0);
  assert.equal(dashboard.shoppingExtras.length, 0);
});

test('exporta e importa notas de plan en backups version 3', async () => {
  const source = await createServiceWithRecipe();
  await source.service.createPlannedNote({
    date: '2026-06-21',
    mealType: 'dinner',
    title: 'Congelado',
    note: 'Crema preparada',
  });
  const backup = await source.service.exportBackup();
  const { service: targetService } = createTestService();

  const summary = await targetService.importBackup(JSON.stringify(backup));
  const dashboard = await targetService.getDashboard();

  assert.equal(summary.plannedMeals, 1);
  assert.equal(dashboard.plannedMeals[0].kind, 'note');
  assert.equal(dashboard.plannedMeals[0].title, 'Congelado');
  assert.equal(dashboard.plannedMeals[0].note, 'Crema preparada');
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
