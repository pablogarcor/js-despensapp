import { createId } from '../domain/planning.js';

/**
 * Inserta datos de ejemplo una unica vez para que el MVP sea explorable.
 *
 * @param {import('./indexedDbClient.js').IndexedDbClient | import('./memoryDatabase.js').MemoryDatabase} database
 * Base de datos compatible.
 * @returns {Promise<void>}
 */
export async function seedDemoData(database) {
  const seedStatus = await database.get('meta', 'demoSeeded');

  if (seedStatus?.value === true) {
    return;
  }

  const now = new Date().toISOString();
  const items = [
    createPantryItem('Avena', 500, 'g', now),
    createPantryItem('Leche', 2, 'l', now),
    createPantryItem('Huevos', 12, 'ud', now),
    createPantryItem('Arroz', 1000, 'g', now),
    createPantryItem('Pollo', 600, 'g', now),
    createPantryItem('Tomate', 6, 'ud', now),
    createPantryItem('Pasta', 500, 'g', now),
    createPantryItem('Atun', 3, 'ud', now),
    createPantryItem('Pan de molde', 14, 'rebanadas', now),
    createPantryItem('Yogur natural', 6, 'ud', now),
    createPantryItem('Lechuga', 2, 'ud', now),
  ];

  const byName = new Map(items.map((item) => [item.name, item]));
  const recipes = [
    createRecipe('Porridge de avena', ['breakfast'], [
      ingredient(byName, 'Avena', 80),
      ingredient(byName, 'Leche', 0.25),
    ], now),
    createRecipe('Tostada con huevo', ['breakfast'], [
      ingredient(byName, 'Pan de molde', 2),
      ingredient(byName, 'Huevos', 1),
    ], now),
    createRecipe('Arroz con pollo', ['lunch', 'dinner'], [
      ingredient(byName, 'Arroz', 120),
      ingredient(byName, 'Pollo', 180),
      ingredient(byName, 'Tomate', 1),
    ], now),
    createRecipe('Ensalada de atun', ['lunch', 'dinner'], [
      ingredient(byName, 'Lechuga', 0.5),
      ingredient(byName, 'Atun', 1),
      ingredient(byName, 'Tomate', 1),
    ], now),
    createRecipe('Pasta con tomate', ['lunch', 'dinner'], [
      ingredient(byName, 'Pasta', 110),
      ingredient(byName, 'Tomate', 2),
    ], now),
    createRecipe('Yogur con avena', ['breakfast'], [
      ingredient(byName, 'Yogur natural', 1),
      ingredient(byName, 'Avena', 40),
    ], now),
  ];

  await database.bulkPut('pantryItems', items);
  await database.bulkPut('recipes', recipes);
  await database.put('meta', { key: 'demoSeeded', value: true, updatedAt: now });
}

/**
 * Crea un alimento demo.
 *
 * @param {string} name Nombre.
 * @param {number} quantity Cantidad.
 * @param {string} unit Unidad.
 * @param {string} now Fecha ISO.
 * @returns {import('../domain/types.js').PantryItem} Alimento.
 */
function createPantryItem(name, quantity, unit, now) {
  return {
    id: createId('item'),
    name,
    quantity,
    unit,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Crea una receta demo.
 *
 * @param {string} name Nombre.
 * @param {import('../domain/types.js').MealType[]} mealTypes Tipos de comida.
 * @param {import('../domain/types.js').RecipeIngredient[]} ingredients Ingredientes.
 * @param {string} now Fecha ISO.
 * @returns {import('../domain/types.js').Recipe} Receta.
 */
function createRecipe(name, mealTypes, ingredients, now) {
  return {
    id: createId('recipe'),
    name,
    mealTypes,
    ingredients,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Construye una referencia de ingrediente desde el mapa de alimentos demo.
 *
 * @param {Map<string, import('../domain/types.js').PantryItem>} itemsByName Alimentos por nombre.
 * @param {string} name Nombre del alimento.
 * @param {number} quantity Cantidad por racion.
 * @returns {import('../domain/types.js').RecipeIngredient} Ingrediente.
 */
function ingredient(itemsByName, name, quantity) {
  return {
    pantryItemId: itemsByName.get(name).id,
    quantity,
  };
}
