import { DomainError } from '../domain/errors.js';
import { createBackup, validateBackup } from '../domain/backup.js';
import {
  buildRandomMealsForSlots,
  buildRandomWeekPlan,
  calculateShoppingList,
  calculateUnavailablePlannedMeals,
  createId,
  findMissingMealSlots,
  getNextSevenDates,
  normalizeName,
  roundQuantity,
  sortPlannedMeals,
  toISODate,
} from '../domain/planning.js';
import { MEAL_TYPES, PLAN_NOTE_TITLES } from '../domain/types.js';

const GENERATED_SHOPPING_PREFIX = 'shopping_generated_';

/**
 * Servicio de aplicacion que concentra reglas de negocio y restricciones.
 *
 * La UI no toca IndexedDB directamente: siempre pasa por este servicio para
 * mantener en un unico lugar las reglas de integridad entre tablas.
 */
export class PantryService {
  /**
   * @param {import('../storage/indexedDbClient.js').IndexedDbClient | import('../storage/memoryDatabase.js').MemoryDatabase} database
   * Persistencia compatible.
   * @param {Object} [options] Opciones para tests y escenarios deterministas.
   * @param {() => Date} [options.now] Proveedor de fecha actual.
   * @param {() => number} [options.random] Proveedor de aleatoriedad.
   */
  constructor(database, options = {}) {
    this.database = database;
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  /**
   * Devuelve todos los datos necesarios para pintar la pantalla.
   *
   * @returns {Promise<import('../domain/types.js').DashboardSnapshot>} Snapshot agregado.
   */
  async getDashboard() {
    const [pantryItems, recipes, allMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);
    const today = toISODate(this.now());
    const normalizedAllMeals = normalizePlannedMeals(allMeals);
    const plannedMeals = sortPlannedMeals(normalizedAllMeals.filter((meal) => meal.date >= today));
    const pendingMeals = sortPlannedMeals(normalizedAllMeals.filter((meal) => meal.date < today));
    const missingPlanSlots = findMissingMealSlots({
      plannedMeals,
      referenceDate: this.now(),
    });

    return {
      pantryItems: sortByName(pantryItems),
      recipes: sortByName(recipes),
      plannedMeals,
      pendingMeals,
      missingPlanSlots,
      shoppingList: buildShoppingListWithState({
        shoppingList: calculateShoppingList({ pantryItems, recipes, plannedMeals }),
        shoppingItems,
      }),
      shoppingExtras: sortShoppingExtras(shoppingItems),
      unavailableMeals: calculateUnavailablePlannedMeals({ pantryItems, recipes, plannedMeals }),
    };
  }

  /**
   * Exporta todos los datos locales de usuario a un backup versionado.
   *
   * @returns {Promise<import('../domain/types.js').PantryBackup>} Backup serializable.
   */
  async exportBackup() {
    const [pantryItems, recipes, plannedMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);

    return createBackup({
      pantryItems: sortByName(pantryItems),
      recipes: sortByName(recipes),
      plannedMeals: sortPlannedMeals(normalizePlannedMeals(plannedMeals)),
      shoppingItems: sortShoppingItems(shoppingItems),
      exportedAt: this.now().toISOString(),
    });
  }

  /**
   * Importa un backup JSON reemplazando datos de usuario actuales.
   *
   * @param {string} backupText Contenido JSON del archivo.
   * @returns {Promise<import('../domain/types.js').ImportSummary>} Resumen de importacion.
   */
  async importBackup(backupText) {
    let parsedBackup;

    try {
      parsedBackup = JSON.parse(backupText);
    } catch {
      throw new DomainError('El archivo no es un JSON valido.', 'BACKUP_JSON_INVALID');
    }

    const backupData = validateBackup(parsedBackup);

    await this.database.replaceStores({
      pantryItems: backupData.pantryItems,
      recipes: backupData.recipes,
      plannedMeals: backupData.plannedMeals,
      shoppingItems: backupData.shoppingItems,
    });

    return {
      pantryItems: backupData.pantryItems.length,
      recipes: backupData.recipes.length,
      plannedMeals: backupData.plannedMeals.length,
      shoppingItems: backupData.shoppingItems.length,
    };
  }

  /**
   * Borra todos los datos principales de usuario sin validar dependencias.
   *
   * Esta operacion se usa para reiniciar la app completa, por eso limpia las
   * tablas relacionadas en una sola accion y mantiene la tabla `meta`.
   *
   * @returns {Promise<import('../domain/types.js').ImportSummary>} Totales eliminados por tabla.
   */
  async clearAllData() {
    const [pantryItems, recipes, plannedMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);

    await this.database.replaceStores({
      pantryItems: [],
      recipes: [],
      plannedMeals: [],
      shoppingItems: [],
    });

    return {
      pantryItems: pantryItems.length,
      recipes: recipes.length,
      plannedMeals: plannedMeals.length,
      shoppingItems: shoppingItems.length,
    };
  }

  /**
   * Crea un extra manual en la lista de compra.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre del alimento o producto.
   * @param {number} params.quantity Cantidad a comprar.
   * @param {string} params.unit Unidad.
   * @returns {Promise<import('../domain/types.js').ShoppingItem>} Extra creado.
   */
  async createShoppingExtra({ name, quantity, unit }) {
    const cleanName = cleanText(name);
    const cleanUnit = cleanText(unit);
    const parsedQuantity = parsePositiveQuantity(quantity, 'La cantidad del extra debe ser mayor que cero.');

    if (!cleanName) {
      throw new DomainError('El extra necesita un nombre.', 'SHOPPING_EXTRA_NAME_REQUIRED');
    }

    if (!cleanUnit) {
      throw new DomainError('El extra necesita una unidad.', 'SHOPPING_EXTRA_UNIT_REQUIRED');
    }

    const now = this.now().toISOString();
    const shoppingItem = {
      id: createId('shopping'),
      kind: 'extra',
      name: cleanName,
      quantity: parsedQuantity,
      unit: cleanUnit,
      checked: false,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('shoppingItems', shoppingItem);
  }

  /**
   * Marca o desmarca una entrada de la lista de compra.
   *
   * Las entradas generadas por el plan se crean bajo demanda para guardar solo
   * su estado, manteniendo cantidad y nombre calculados desde la planificacion.
   *
   * @param {string} shoppingItemId Identificador de compra.
   * @param {boolean} checked Estado marcado.
   * @returns {Promise<import('../domain/types.js').ShoppingItem>} Entrada actualizada.
   */
  async setShoppingItemChecked(shoppingItemId, checked) {
    const cleanShoppingItemId = cleanText(shoppingItemId);
    const existingItem = await this.database.get('shoppingItems', cleanShoppingItemId);
    const now = this.now().toISOString();

    if (existingItem) {
      const updatedItem = {
        ...existingItem,
        checked: Boolean(checked),
        updatedAt: now,
      };

      return this.database.put('shoppingItems', updatedItem);
    }

    if (!isGeneratedShoppingItemId(cleanShoppingItemId)) {
      throw new DomainError('La entrada de compra no existe.', 'SHOPPING_ITEM_NOT_FOUND');
    }

    const pantryItemId = getPantryItemIdFromGeneratedShoppingId(cleanShoppingItemId);
    const pantryItem = await this.database.get('pantryItems', pantryItemId);

    if (!pantryItem) {
      throw new DomainError('El alimento de la compra no existe.', 'PANTRY_NOT_FOUND');
    }

    const shoppingItem = {
      id: cleanShoppingItemId,
      kind: 'generated',
      pantryItemId,
      checked: Boolean(checked),
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('shoppingItems', shoppingItem);
  }

  /**
   * Elimina un extra manual de la lista de compra.
   *
   * @param {string} shoppingItemId Identificador del extra.
   * @returns {Promise<void>}
   */
  async deleteShoppingExtra(shoppingItemId) {
    const shoppingItem = await this.database.get('shoppingItems', shoppingItemId);

    if (!shoppingItem || shoppingItem.kind !== 'extra') {
      throw new DomainError('El extra de compra no existe.', 'SHOPPING_EXTRA_NOT_FOUND');
    }

    await this.database.delete('shoppingItems', shoppingItemId);
  }

  /**
   * Suma a la despensa todas las entradas marcadas como compradas.
   *
   * Los faltantes generados incrementan su alimento existente. Los extras
   * incrementan un alimento existente con la misma unidad o crean uno nuevo.
   *
   * @returns {Promise<{purchasedItems: number, updatedPantryItems: number, createdPantryItems: number}>}
   * Resumen de compra aplicada.
   */
  async applyShoppingPurchase() {
    const [pantryItems, recipes, allMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);
    const checkedShoppingItems = shoppingItems.filter((item) => item.checked);

    if (checkedShoppingItems.length === 0) {
      throw new DomainError('Marca al menos un alimento comprado.', 'SHOPPING_PURCHASE_EMPTY');
    }

    const today = toISODate(this.now());
    const plannedMeals = allMeals.filter((meal) => meal.date >= today);
    const generatedShoppingItems = calculateShoppingList({ pantryItems, recipes, plannedMeals });
    const generatedByPantryItemId = new Map(
      generatedShoppingItems.map((item) => [item.pantryItemId, item]),
    );
    const nextPantryItemsById = new Map(pantryItems.map((item) => [item.id, item]));
    const pantryItemsByName = new Map(pantryItems.map((item) => [normalizeName(item.name), item]));
    const touchedPantryItemIds = new Set();
    const createdPantryItemIds = new Set();
    const now = this.now().toISOString();
    let purchasedItems = 0;

    const addQuantityToPantryItem = (pantryItem, quantity) => {
      const currentItem = nextPantryItemsById.get(pantryItem.id) ?? pantryItem;
      const updatedItem = {
        ...currentItem,
        quantity: roundQuantity(currentItem.quantity + quantity),
        updatedAt: now,
      };

      nextPantryItemsById.set(updatedItem.id, updatedItem);
      pantryItemsByName.set(normalizeName(updatedItem.name), updatedItem);
      touchedPantryItemIds.add(updatedItem.id);
    };

    for (const shoppingItem of checkedShoppingItems) {
      if (shoppingItem.kind !== 'generated') {
        continue;
      }

      const generatedItem = generatedByPantryItemId.get(shoppingItem.pantryItemId);
      const pantryItem = nextPantryItemsById.get(shoppingItem.pantryItemId);

      if (!generatedItem || !pantryItem) {
        continue;
      }

      addQuantityToPantryItem(pantryItem, generatedItem.missingQuantity);
      purchasedItems += 1;
    }

    for (const shoppingItem of checkedShoppingItems) {
      if (shoppingItem.kind !== 'extra') {
        continue;
      }

      const cleanName = cleanText(shoppingItem.name);
      const cleanUnit = cleanText(shoppingItem.unit);
      const parsedQuantity = parsePositiveQuantity(
        shoppingItem.quantity,
        'La cantidad del extra debe ser mayor que cero.',
      );
      const existingPantryItem = pantryItemsByName.get(normalizeName(cleanName));

      if (existingPantryItem) {
        if (existingPantryItem.unit !== cleanUnit) {
          throw new DomainError(
            `"${cleanName}" ya existe en ${existingPantryItem.unit}. Usa esa unidad o edita el alimento.`,
            'SHOPPING_EXTRA_UNIT_MISMATCH',
          );
        }

        addQuantityToPantryItem(existingPantryItem, parsedQuantity);
      } else {
        const newPantryItem = {
          id: createId('item'),
          name: cleanName,
          quantity: parsedQuantity,
          unit: cleanUnit,
          createdAt: now,
          updatedAt: now,
        };

        nextPantryItemsById.set(newPantryItem.id, newPantryItem);
        pantryItemsByName.set(normalizeName(newPantryItem.name), newPantryItem);
        createdPantryItemIds.add(newPantryItem.id);
      }

      purchasedItems += 1;
    }

    if (purchasedItems === 0) {
      throw new DomainError('No hay compra pendiente marcada.', 'SHOPPING_PURCHASE_EMPTY');
    }

    const checkedShoppingItemIds = new Set(checkedShoppingItems.map((item) => item.id));
    const remainingShoppingItems = shoppingItems.filter(
      (item) =>
        !checkedShoppingItemIds.has(item.id) &&
        !(item.kind === 'generated' && touchedPantryItemIds.has(item.pantryItemId)),
    );

    await this.database.replaceStores({
      pantryItems: [...nextPantryItemsById.values()],
      shoppingItems: remainingShoppingItems,
    });

    return {
      purchasedItems,
      updatedPantryItems: touchedPantryItemIds.size,
      createdPantryItems: createdPantryItemIds.size,
    };
  }

  /**
   * Crea un alimento de despensa validando duplicados por nombre.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {number} params.quantity Cantidad inicial.
   * @param {string} params.unit Unidad.
   * @returns {Promise<import('../domain/types.js').PantryItem>} Alimento creado.
   */
  async createPantryItem({ name, quantity, unit }) {
    const pantryItems = await this.database.getAll('pantryItems');
    const cleanName = cleanText(name);
    const cleanUnit = cleanText(unit);
    const parsedQuantity = parseNonNegativeQuantity(quantity, 'La cantidad del alimento no es valida.');

    if (!cleanName) {
      throw new DomainError('El alimento necesita un nombre.', 'PANTRY_NAME_REQUIRED');
    }

    if (!cleanUnit) {
      throw new DomainError('El alimento necesita una unidad.', 'PANTRY_UNIT_REQUIRED');
    }

    if (pantryItems.some((item) => normalizeName(item.name) === normalizeName(cleanName))) {
      throw new DomainError('Ya existe un alimento con ese nombre.', 'PANTRY_DUPLICATED');
    }

    const now = this.now().toISOString();
    const item = {
      id: createId('item'),
      name: cleanName,
      quantity: parsedQuantity,
      unit: cleanUnit,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('pantryItems', item);
  }

  /**
   * Actualiza un alimento existente conservando su identificador.
   *
   * Cambiar la unidad exige actualizar las cantidades de receta que usan este
   * alimento, porque esas cantidades se interpretan en la unidad del alimento.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {number} params.quantity Cantidad disponible.
   * @param {string} params.unit Unidad.
   * @param {Array<{recipeId: string, quantity: number}>} [params.recipeIngredientUpdates]
   * Cantidades por racion para recetas que usan este alimento.
   * @returns {Promise<import('../domain/types.js').PantryItem>} Alimento actualizado.
   */
  async updatePantryItem(pantryItemId, { name, quantity, unit, recipeIngredientUpdates = [] }) {
    const [pantryItems, recipes] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
    ]);
    const pantryItem = pantryItems.find((item) => item.id === pantryItemId);
    const cleanName = cleanText(name);
    const cleanUnit = cleanText(unit);
    const parsedQuantity = parseNonNegativeQuantity(quantity, 'La cantidad del alimento no es valida.');

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    if (!cleanName) {
      throw new DomainError('El alimento necesita un nombre.', 'PANTRY_NAME_REQUIRED');
    }

    if (!cleanUnit) {
      throw new DomainError('El alimento necesita una unidad.', 'PANTRY_UNIT_REQUIRED');
    }

    const duplicatedItem = pantryItems.find(
      (item) => item.id !== pantryItemId && normalizeName(item.name) === normalizeName(cleanName),
    );

    if (duplicatedItem) {
      throw new DomainError('Ya existe un alimento con ese nombre.', 'PANTRY_DUPLICATED');
    }

    const affectedRecipes = recipes.filter((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.pantryItemId === pantryItemId),
    );
    const normalizedRecipeIngredientUpdates = normalizeRecipeIngredientUpdates({
      recipeIngredientUpdates,
      affectedRecipes,
      mustUpdateAll: pantryItem.unit !== cleanUnit,
    });
    const updatedRecipes = applyRecipeIngredientUpdates({
      affectedRecipes,
      recipeIngredientUpdates: normalizedRecipeIngredientUpdates,
      pantryItemId,
      updatedAt: this.now().toISOString(),
    });
    const updatedItem = {
      ...pantryItem,
      name: cleanName,
      quantity: parsedQuantity,
      unit: cleanUnit,
      updatedAt: this.now().toISOString(),
    };

    await this.database.bulkPut('recipes', updatedRecipes);
    await this.database.put('pantryItems', updatedItem);
    await this.clearGeneratedShoppingItemsForPantryItems([pantryItemId]);

    return updatedItem;
  }

  /**
   * Suma cantidad a un alimento existente manteniendo su unidad.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @param {number} quantityToAdd Cantidad positiva que se añadira al stock.
   * @returns {Promise<import('../domain/types.js').PantryItem>} Alimento actualizado.
   */
  async addPantryItemQuantity(pantryItemId, quantityToAdd) {
    const pantryItem = await this.database.get('pantryItems', pantryItemId);

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    const parsedQuantity = parsePositiveQuantity(
      quantityToAdd,
      'La cantidad a añadir debe ser mayor que cero.',
    );
    const updatedItem = {
      ...pantryItem,
      quantity: roundQuantity(pantryItem.quantity + parsedQuantity),
      updatedAt: this.now().toISOString(),
    };

    await this.database.put('pantryItems', updatedItem);
    await this.clearGeneratedShoppingItemsForPantryItems([pantryItemId]);

    return updatedItem;
  }

  /**
   * Resta cantidad de un alimento existente sin permitir stock negativo.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @param {number} quantityToSubtract Cantidad positiva que se descontara del stock.
   * @returns {Promise<import('../domain/types.js').PantryItem>} Alimento actualizado.
   */
  async subtractPantryItemQuantity(pantryItemId, quantityToSubtract) {
    const pantryItem = await this.database.get('pantryItems', pantryItemId);

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    const parsedQuantity = parsePositiveQuantity(
      quantityToSubtract,
      'La cantidad a restar debe ser mayor que cero.',
    );
    const updatedItem = {
      ...pantryItem,
      quantity: roundQuantity(Math.max(0, pantryItem.quantity - parsedQuantity)),
      updatedAt: this.now().toISOString(),
    };

    await this.database.put('pantryItems', updatedItem);
    await this.clearGeneratedShoppingItemsForPantryItems([pantryItemId]);

    return updatedItem;
  }

  /**
   * Elimina un alimento si no aparece como ingrediente de ninguna receta.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @returns {Promise<void>}
   */
  async deletePantryItem(pantryItemId) {
    const [pantryItem, recipes] = await Promise.all([
      this.database.get('pantryItems', pantryItemId),
      this.database.getAll('recipes'),
    ]);

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    const blockingRecipe = recipes.find((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.pantryItemId === pantryItemId),
    );

    if (blockingRecipe) {
      throw new DomainError(
        `No puedes borrar "${pantryItem.name}" porque se usa en "${blockingRecipe.name}".`,
        'PANTRY_IN_USE',
      );
    }

    await this.database.delete('pantryItems', pantryItemId);
    await this.database.deleteWhere(
      'shoppingItems',
      (shoppingItem) =>
        shoppingItem.kind === 'generated' && shoppingItem.pantryItemId === pantryItemId,
    );
  }

  /**
   * Elimina todos los alimentos si ninguna receta depende de ellos.
   *
   * @returns {Promise<number>} Numero de alimentos eliminados.
   */
  async clearPantryItems() {
    const [pantryItems, recipes] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
    ]);
    const pantryItemIds = new Set(pantryItems.map((item) => item.id));
    const blockingRecipe = recipes.find((recipe) =>
      recipe.ingredients.some((ingredient) => pantryItemIds.has(ingredient.pantryItemId)),
    );

    if (blockingRecipe) {
      throw new DomainError(
        `No puedes vaciar la despensa porque "${blockingRecipe.name}" usa alimentos guardados.`,
        'PANTRY_IN_USE',
      );
    }

    const deletedCount = await this.database.deleteWhere('pantryItems', () => true);
    await this.database.deleteWhere('shoppingItems', (shoppingItem) => shoppingItem.kind === 'generated');

    return deletedCount;
  }

  /**
   * Crea una receta con ingredientes existentes en la despensa.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {import('../domain/types.js').MealType[]} params.mealTypes Tipos de comida.
   * @param {import('../domain/types.js').RecipeIngredient[]} params.ingredients Ingredientes por racion.
   * @returns {Promise<import('../domain/types.js').Recipe>} Receta creada.
   */
  async createRecipe({ name, mealTypes, ingredients }) {
    const [pantryItems, recipes] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
    ]);
    const cleanName = cleanText(name);

    if (!cleanName) {
      throw new DomainError('La receta necesita un nombre.', 'RECIPE_NAME_REQUIRED');
    }

    if (recipes.some((recipe) => normalizeName(recipe.name) === normalizeName(cleanName))) {
      throw new DomainError('Ya existe una receta con ese nombre.', 'RECIPE_DUPLICATED');
    }

    const normalizedMealTypes = normalizeMealTypes(mealTypes);
    const normalizedIngredients = normalizeIngredients(ingredients, pantryItems);

    const now = this.now().toISOString();
    const recipe = {
      id: createId('recipe'),
      name: cleanName,
      mealTypes: normalizedMealTypes,
      ingredients: normalizedIngredients,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('recipes', recipe);
  }

  /**
   * Actualiza una receta existente conservando su identificador.
   *
   * Si la receta esta planificada, sus nuevas franjas compatibles deben seguir
   * cubriendo todas las comidas planificadas que ya la usan.
   *
   * @param {string} recipeId Identificador de la receta.
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {import('../domain/types.js').MealType[]} params.mealTypes Tipos de comida.
   * @param {import('../domain/types.js').RecipeIngredient[]} params.ingredients Ingredientes por racion.
   * @returns {Promise<import('../domain/types.js').Recipe>} Receta actualizada.
   */
  async updateRecipe(recipeId, { name, mealTypes, ingredients }) {
    const [pantryItems, recipes, plannedMeals] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
    ]);
    const recipe = recipes.find((candidate) => candidate.id === recipeId);
    const cleanName = cleanText(name);

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    if (!cleanName) {
      throw new DomainError('La receta necesita un nombre.', 'RECIPE_NAME_REQUIRED');
    }

    const duplicatedRecipe = recipes.find(
      (candidate) =>
        candidate.id !== recipeId && normalizeName(candidate.name) === normalizeName(cleanName),
    );

    if (duplicatedRecipe) {
      throw new DomainError('Ya existe una receta con ese nombre.', 'RECIPE_DUPLICATED');
    }

    const normalizedMealTypes = normalizeMealTypes(mealTypes);
    const incompatiblePlannedMeal = plannedMeals.find(
      (meal) =>
        isRecipePlannedMeal(meal) &&
        meal.recipeId === recipeId &&
        !normalizedMealTypes.includes(meal.mealType),
    );

    if (incompatiblePlannedMeal) {
      throw new DomainError(
        'No puedes quitar una franja que ya esta planificada con esta receta.',
        'RECIPE_PLANNED_MEAL_TYPE_REQUIRED',
      );
    }

    const normalizedIngredients = normalizeIngredients(ingredients, pantryItems);
    const updatedRecipe = {
      ...recipe,
      name: cleanName,
      mealTypes: normalizedMealTypes,
      ingredients: normalizedIngredients,
      updatedAt: this.now().toISOString(),
    };

    return this.database.put('recipes', updatedRecipe);
  }

  /**
   * Elimina una receta solo si no esta planificada.
   *
   * @param {string} recipeId Identificador de la receta.
   * @returns {Promise<void>}
   */
  async deleteRecipe(recipeId) {
    const [recipe, plannedMeals] = await Promise.all([
      this.database.get('recipes', recipeId),
      this.database.getAll('plannedMeals'),
    ]);

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    const blockingMeal = plannedMeals.find(
      (meal) => isRecipePlannedMeal(meal) && meal.recipeId === recipeId,
    );

    if (blockingMeal) {
      throw new DomainError(
        `No puedes borrar "${recipe.name}" porque esta planificada.`,
        'RECIPE_IN_USE',
      );
    }

    await this.database.delete('recipes', recipeId);
  }

  /**
   * Elimina todas las recetas si ninguna esta planificada.
   *
   * @returns {Promise<number>} Numero de recetas eliminadas.
   */
  async clearRecipes() {
    const [recipes, plannedMeals] = await Promise.all([
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
    ]);
    const recipeIds = new Set(recipes.map((recipe) => recipe.id));
    const blockingMeal = plannedMeals.find(
      (meal) => isRecipePlannedMeal(meal) && recipeIds.has(meal.recipeId),
    );

    if (blockingMeal) {
      throw new DomainError(
        'No puedes vaciar recetas porque hay recetas planificadas.',
        'RECIPE_IN_USE',
      );
    }

    return this.database.deleteWhere('recipes', () => true);
  }

  /**
   * Genera una nueva planificacion para los siete dias siguientes.
   *
   * Borra primero las comidas de hoy en adelante para que la tabla no acumule
   * semanas antiguas. Las comidas pasadas se conservan hasta que el usuario las
   * confirme como hechas o no hechas.
   *
   * @param {Object} params Datos de entrada.
   * @param {number} params.servings Raciones por comida.
   * @returns {Promise<{plannedMeals: import('../domain/types.js').PlannedMeal[], missingSlots: Array<{date: string, mealType: import('../domain/types.js').MealType}>}>}
   * Resultado de la planificacion.
   */
  async planNextWeek({ servings }) {
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');
    const recipes = await this.database.getAll('recipes');

    if (recipes.length === 0) {
      throw new DomainError('Necesitas al menos una receta para planificar.', 'NO_RECIPES');
    }

    await this.clearCurrentAndFutureMeals();

    const result = buildRandomWeekPlan({
      recipes,
      referenceDate: this.now(),
      servings: parsedServings,
      random: this.random,
    });

    await this.database.bulkPut('plannedMeals', result.plannedMeals);
    return result;
  }

  /**
   * Rellena aleatoriamente los huecos de los proximos siete dias sin borrar el plan actual.
   *
   * @param {Object} params Datos de entrada.
   * @param {number} params.servings Raciones para cada comida nueva.
   * @returns {Promise<{plannedMeals: import('../domain/types.js').PlannedMeal[], missingSlots: import('../domain/types.js').MealSlot[]}>}
   * Comidas creadas y huecos que no se pudieron completar por falta de receta compatible.
   */
  async completeWeekPlan({ servings }) {
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');
    const [recipes, allMeals] = await Promise.all([
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
    ]);

    if (recipes.length === 0) {
      throw new DomainError('Necesitas al menos una receta para completar el plan.', 'NO_RECIPES');
    }

    const today = toISODate(this.now());
    const plannedMeals = allMeals.filter((meal) => meal.date >= today);
    const slots = findMissingMealSlots({
      plannedMeals,
      referenceDate: this.now(),
    });

    if (slots.length === 0) {
      return { plannedMeals: [], missingSlots: [] };
    }

    const result = buildRandomMealsForSlots({
      recipes,
      slots,
      servings: parsedServings,
      random: this.random,
    });

    await this.database.bulkPut('plannedMeals', result.plannedMeals);
    return result;
  }

  /**
   * Anade una comida manual a un hueco libre de la semana planificada.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.date Fecha YYYY-MM-DD.
   * @param {import('../domain/types.js').MealType} params.mealType Franja del dia.
   * @param {string} params.recipeId Receta seleccionada.
   * @param {number} params.servings Raciones.
   * @returns {Promise<import('../domain/types.js').PlannedMeal>} Comida creada.
   */
  async createPlannedMeal({ date, mealType, recipeId, servings }) {
    const cleanDate = cleanText(date);
    const cleanMealType = cleanText(mealType);
    const cleanRecipeId = cleanText(recipeId);
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');
    const allowedDates = getNextSevenDates(this.now());

    if (!allowedDates.includes(cleanDate)) {
      throw new DomainError('Solo puedes añadir comidas dentro de los proximos siete dias.', 'DATE_OUT_OF_PLAN');
    }

    if (!MEAL_TYPES.includes(cleanMealType)) {
      throw new DomainError('La franja de comida no es valida.', 'MEAL_TYPE_INVALID');
    }

    const [recipe, plannedMeals] = await Promise.all([
      this.database.get('recipes', cleanRecipeId),
      this.database.getAll('plannedMeals'),
    ]);

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    if (!recipe.mealTypes.includes(cleanMealType)) {
      throw new DomainError('La receta no esta indicada para esa franja.', 'RECIPE_NOT_COMPATIBLE');
    }

    const occupiedMeal = plannedMeals.find(
      (meal) => meal.date === cleanDate && meal.mealType === cleanMealType,
    );

    if (occupiedMeal) {
      throw new DomainError('Ya existe una comida planificada para ese hueco.', 'PLANNED_MEAL_DUPLICATED');
    }

    const now = this.now().toISOString();
    const plannedMeal = {
      id: createId('meal'),
      kind: 'recipe',
      date: cleanDate,
      mealType: cleanMealType,
      recipeId: cleanRecipeId,
      servings: parsedServings,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('plannedMeals', plannedMeal);
  }

  /**
   * Anade una entrada de No cocinar a un hueco libre de la semana planificada.
   *
   * Estas entradas ocupan franja y fecha, pero no tienen receta, raciones ni compra asociada.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.date Fecha YYYY-MM-DD.
   * @param {import('../domain/types.js').MealType} params.mealType Franja del dia.
   * @param {string} params.title Motivo predefinido.
   * @param {string} [params.note] Detalle libre opcional.
   * @returns {Promise<import('../domain/types.js').PlannedMeal>} Entrada creada.
   */
  async createPlannedNote({ date, mealType, title, note = '' }) {
    const cleanDate = cleanText(date);
    const cleanMealType = cleanText(mealType);
    const { title: cleanTitle, note: cleanNote } = normalizePlanNoteInput({ title, note });
    const allowedDates = getNextSevenDates(this.now());

    if (!allowedDates.includes(cleanDate)) {
      throw new DomainError('Solo puedes marcar no cocinar dentro de los proximos siete dias.', 'DATE_OUT_OF_PLAN');
    }

    if (!MEAL_TYPES.includes(cleanMealType)) {
      throw new DomainError('La franja de comida no es valida.', 'MEAL_TYPE_INVALID');
    }

    const plannedMeals = await this.database.getAll('plannedMeals');
    const occupiedMeal = plannedMeals.find(
      (meal) => meal.date === cleanDate && meal.mealType === cleanMealType,
    );

    if (occupiedMeal) {
      throw new DomainError('Ya existe una comida planificada para ese hueco.', 'PLANNED_MEAL_DUPLICATED');
    }

    const now = this.now().toISOString();
    const plannedNote = {
      id: createId('meal'),
      kind: 'note',
      date: cleanDate,
      mealType: cleanMealType,
      title: cleanTitle,
      note: cleanNote,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('plannedMeals', plannedNote);
  }

  /**
   * Actualiza una comida planificada existente.
   *
   * @param {string} plannedMealId Identificador de la comida.
   * @param {Object} params Datos de entrada.
   * @param {string} params.recipeId Receta seleccionada.
   * @param {number} params.servings Raciones.
   * @returns {Promise<import('../domain/types.js').PlannedMeal>} Comida actualizada.
   */
  async updatePlannedMeal(plannedMealId, { recipeId, servings }) {
    const cleanRecipeId = cleanText(recipeId);
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');

    const [plannedMeal, recipe] = await Promise.all([
      this.database.get('plannedMeals', plannedMealId),
      this.database.get('recipes', cleanRecipeId),
    ]);

    if (!plannedMeal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    if (!isRecipePlannedMeal(plannedMeal)) {
      throw new DomainError('Esta planificacion es de no cocinar, no una receta.', 'PLANNED_MEAL_KIND_INVALID');
    }

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    if (!recipe.mealTypes.includes(plannedMeal.mealType)) {
      throw new DomainError('La receta no esta indicada para esa franja.', 'RECIPE_NOT_COMPATIBLE');
    }

    const updatedMeal = {
      ...plannedMeal,
      recipeId: cleanRecipeId,
      servings: parsedServings,
      updatedAt: this.now().toISOString(),
    };

    return this.database.put('plannedMeals', updatedMeal);
  }

  /**
   * Actualiza una entrada de No cocinar conservando fecha y franja.
   *
   * @param {string} plannedMealId Identificador de la entrada.
   * @param {Object} params Datos de entrada.
   * @param {string} params.title Titulo predefinido.
   * @param {string} [params.note] Detalle libre opcional.
   * @returns {Promise<import('../domain/types.js').PlannedMeal>} Entrada actualizada.
   */
  async updatePlannedNote(plannedMealId, { title, note = '' }) {
    const plannedMeal = await this.database.get('plannedMeals', plannedMealId);
    const { title: cleanTitle, note: cleanNote } = normalizePlanNoteInput({ title, note });

    if (!plannedMeal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    if (!isNotePlannedMeal(plannedMeal)) {
      throw new DomainError('Esta planificacion no es de no cocinar.', 'PLANNED_MEAL_KIND_INVALID');
    }

    const updatedMeal = {
      ...plannedMeal,
      kind: 'note',
      title: cleanTitle,
      note: cleanNote,
      updatedAt: this.now().toISOString(),
    };

    return this.database.put('plannedMeals', updatedMeal);
  }

  /**
   * Elimina una comida planificada.
   *
   * @param {string} plannedMealId Identificador de la comida.
   * @returns {Promise<void>}
   */
  async deletePlannedMeal(plannedMealId) {
    const plannedMeal = await this.database.get('plannedMeals', plannedMealId);

    if (!plannedMeal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    await this.database.delete('plannedMeals', plannedMealId);
  }

  /**
   * Borra todas las comidas desde hoy en adelante.
   *
   * @returns {Promise<number>} Numero de comidas eliminadas.
   */
  async clearCurrentAndFutureMeals() {
    const today = toISODate(this.now());
    const deletedCount = await this.database.deleteWhere('plannedMeals', (meal) => meal.date >= today);
    await this.database.deleteWhere('shoppingItems', (shoppingItem) => shoppingItem.kind === 'generated');

    return deletedCount;
  }

  /**
   * Resuelve una comida pasada y, si se hizo, descuenta ingredientes.
   *
   * @param {string} plannedMealId Identificador de la comida.
   * @param {boolean} wasCooked Indica si finalmente se preparo.
   * @returns {Promise<void>}
   */
  async resolvePastMeal(plannedMealId, wasCooked) {
    const meal = await this.database.get('plannedMeals', plannedMealId);

    if (!meal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    if (wasCooked && isRecipePlannedMeal(meal)) {
      await this.consumeRecipeIngredients(meal.recipeId, meal.servings);
    }

    await this.database.delete('plannedMeals', plannedMealId);
  }

  /**
   * Descuenta ingredientes de la despensa para una receta.
   *
   * @param {string} recipeId Identificador de receta.
   * @param {number} servings Raciones cocinadas.
   * @returns {Promise<void>}
   */
  async consumeRecipeIngredients(recipeId, servings) {
    const [recipe, pantryItems] = await Promise.all([
      this.database.get('recipes', recipeId),
      this.database.getAll('pantryItems'),
    ]);

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    const pantryById = new Map(pantryItems.map((item) => [item.id, item]));
    const now = this.now().toISOString();
    const updatedItems = recipe.ingredients.map((ingredient) => {
      const pantryItem = pantryById.get(ingredient.pantryItemId);

      if (!pantryItem) {
        throw new DomainError('La receta contiene un alimento que ya no existe.', 'PANTRY_NOT_FOUND');
      }

      return {
        ...pantryItem,
        quantity: roundQuantity(Math.max(0, pantryItem.quantity - ingredient.quantity * servings)),
        updatedAt: now,
      };
    });

    await this.database.bulkPut('pantryItems', updatedItems);
    await this.clearGeneratedShoppingItemsForPantryItems(
      recipe.ingredients.map((ingredient) => ingredient.pantryItemId),
    );
  }

  /**
   * Limpia estados generados de compra cuando cambia el stock de alimentos.
   *
   * @param {string[]} pantryItemIds Identificadores afectados.
   * @returns {Promise<number>} Numero de entradas eliminadas.
   */
  async clearGeneratedShoppingItemsForPantryItems(pantryItemIds) {
    const affectedPantryItemIds = new Set(pantryItemIds);

    if (affectedPantryItemIds.size === 0) {
      return 0;
    }

    return this.database.deleteWhere(
      'shoppingItems',
      (shoppingItem) =>
        shoppingItem.kind === 'generated' &&
        affectedPantryItemIds.has(shoppingItem.pantryItemId),
    );
  }
}

/**
 * Ordena entidades que tienen nombre visible.
 *
 * @template T
 * @param {(T & {name: string})[]} records Registros.
 * @returns {T[]} Nueva lista ordenada.
 */
function sortByName(records) {
  return [...records].sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

/**
 * Normaliza comidas antiguas que no tienen `kind`.
 *
 * @param {import('../domain/types.js').PlannedMeal[]} plannedMeals Comidas guardadas.
 * @returns {import('../domain/types.js').PlannedMeal[]} Comidas normalizadas.
 */
function normalizePlannedMeals(plannedMeals) {
  return plannedMeals.map((meal) => ({
    ...meal,
    kind: meal.kind ?? 'recipe',
    title: meal.kind === 'note' ? normalizePlanNoteTitle(meal.title) : meal.title,
  }));
}

/**
 * Indica si una planificacion consume una receta.
 *
 * @param {import('../domain/types.js').PlannedMeal} plannedMeal Planificacion.
 * @returns {boolean} True si es comida con receta.
 */
function isRecipePlannedMeal(plannedMeal) {
  return (plannedMeal.kind ?? 'recipe') === 'recipe';
}

/**
 * Indica si una planificacion es una nota sin receta.
 *
 * @param {import('../domain/types.js').PlannedMeal} plannedMeal Planificacion.
 * @returns {boolean} True si es nota.
 */
function isNotePlannedMeal(plannedMeal) {
  return plannedMeal.kind === 'note';
}

/**
 * Valida y sanea una nota de plan.
 *
 * @param {Object} params Datos de entrada.
 * @param {string} params.title Titulo.
 * @param {string} params.note Detalle opcional.
 * @returns {{title: string, note: string}} Nota saneada.
 */
function normalizePlanNoteInput({ title, note }) {
  const cleanTitle = normalizePlanNoteTitle(cleanText(title));
  const cleanNote = cleanText(note);

  if (!PLAN_NOTE_TITLES.includes(cleanTitle)) {
    throw new DomainError('Selecciona un motivo valido para no cocinar.', 'PLAN_NOTE_TITLE_INVALID');
  }

  if (cleanTitle === 'Otro motivo' && !cleanNote) {
    throw new DomainError('Escribe el motivo para no cocinar.', 'PLAN_NOTE_REQUIRED');
  }

  return {
    title: cleanTitle,
    note: cleanNote,
  };
}

/**
 * Normaliza titulos antiguos de notas de plan.
 *
 * @param {string} title Titulo guardado o introducido.
 * @returns {string} Titulo actual.
 */
function normalizePlanNoteTitle(title) {
  return title === 'Nota libre' ? 'Otro motivo' : title;
}

/**
 * Ordena entradas persistidas de compra de forma estable.
 *
 * @param {import('../domain/types.js').ShoppingItem[]} shoppingItems Entradas.
 * @returns {import('../domain/types.js').ShoppingItem[]} Entradas ordenadas.
 */
function sortShoppingItems(shoppingItems) {
  return [...shoppingItems].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind, 'es');
    }

    const leftLabel = left.name ?? left.pantryItemId ?? '';
    const rightLabel = right.name ?? right.pantryItemId ?? '';
    return leftLabel.localeCompare(rightLabel, 'es');
  });
}

/**
 * Devuelve solo extras manuales ordenados por nombre.
 *
 * @param {import('../domain/types.js').ShoppingItem[]} shoppingItems Entradas persistidas.
 * @returns {import('../domain/types.js').ShoppingItem[]} Extras manuales.
 */
function sortShoppingExtras(shoppingItems) {
  return shoppingItems
    .filter((shoppingItem) => shoppingItem.kind === 'extra')
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

/**
 * Anade estado persistido a los faltantes generados por el plan.
 *
 * @param {Object} params Parametros.
 * @param {import('../domain/types.js').ShoppingListItem[]} params.shoppingList Faltantes calculados.
 * @param {import('../domain/types.js').ShoppingItem[]} params.shoppingItems Estado persistido.
 * @returns {import('../domain/types.js').ShoppingListItem[]} Lista accionable.
 */
function buildShoppingListWithState({ shoppingList, shoppingItems }) {
  const statesByPantryItemId = new Map(
    shoppingItems
      .filter((shoppingItem) => shoppingItem.kind === 'generated')
      .map((shoppingItem) => [shoppingItem.pantryItemId, shoppingItem]),
  );

  return shoppingList.map((item) => {
    const state = statesByPantryItemId.get(item.pantryItemId);

    return {
      ...item,
      shoppingItemId: state?.id ?? createGeneratedShoppingItemId(item.pantryItemId),
      checked: state?.checked === true,
    };
  });
}

/**
 * Crea el id estable para guardar estado de un faltante generado.
 *
 * @param {string} pantryItemId Identificador de alimento.
 * @returns {string} Identificador de compra.
 */
function createGeneratedShoppingItemId(pantryItemId) {
  return `${GENERATED_SHOPPING_PREFIX}${pantryItemId}`;
}

/**
 * Comprueba si un id pertenece a una compra generada.
 *
 * @param {string} shoppingItemId Identificador de compra.
 * @returns {boolean} True si es generado.
 */
function isGeneratedShoppingItemId(shoppingItemId) {
  return shoppingItemId.startsWith(GENERATED_SHOPPING_PREFIX);
}

/**
 * Extrae el alimento desde un id de compra generada.
 *
 * @param {string} shoppingItemId Identificador de compra generada.
 * @returns {string} Identificador de alimento.
 */
function getPantryItemIdFromGeneratedShoppingId(shoppingItemId) {
  return shoppingItemId.slice(GENERATED_SHOPPING_PREFIX.length);
}

/**
 * Limpia texto de formularios.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Texto normalizado.
 */
function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Parsea una cantidad mayor o igual que cero.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Cantidad.
 */
function parseNonNegativeQuantity(value, errorMessage) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new DomainError(errorMessage, 'INVALID_QUANTITY');
  }

  return roundQuantity(parsedValue);
}

/**
 * Parsea una cantidad estrictamente positiva.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Cantidad.
 */
function parsePositiveQuantity(value, errorMessage) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new DomainError(errorMessage, 'INVALID_QUANTITY');
  }

  return roundQuantity(parsedValue);
}

/**
 * Valida tipos de comida de una receta.
 *
 * @param {unknown[]} mealTypes Tipos seleccionados.
 * @returns {import('../domain/types.js').MealType[]} Tipos validos.
 */
function normalizeMealTypes(mealTypes) {
  const selectedMealTypes = [...new Set(mealTypes)].filter((mealType) => MEAL_TYPES.includes(mealType));

  if (selectedMealTypes.length === 0) {
    throw new DomainError('Selecciona al menos un momento del dia para la receta.', 'MEAL_TYPE_REQUIRED');
  }

  return selectedMealTypes;
}

/**
 * Valida ingredientes y garantiza que todos existan en la despensa.
 *
 * @param {import('../domain/types.js').RecipeIngredient[]} ingredients Ingredientes de entrada.
 * @param {import('../domain/types.js').PantryItem[]} pantryItems Alimentos disponibles.
 * @returns {import('../domain/types.js').RecipeIngredient[]} Ingredientes normalizados.
 */
function normalizeIngredients(ingredients, pantryItems) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new DomainError('La receta necesita al menos un ingrediente.', 'INGREDIENT_REQUIRED');
  }

  const pantryById = new Map(pantryItems.map((item) => [item.id, item]));
  const usedItemIds = new Set();

  return ingredients.map((ingredient) => {
    const pantryItemId = cleanText(ingredient.pantryItemId);

    if (!pantryById.has(pantryItemId)) {
      throw new DomainError('Todos los ingredientes deben existir en la despensa.', 'INGREDIENT_NOT_FOUND');
    }

    if (usedItemIds.has(pantryItemId)) {
      throw new DomainError('No repitas alimentos dentro de la misma receta.', 'INGREDIENT_DUPLICATED');
    }

    usedItemIds.add(pantryItemId);

    return {
      pantryItemId,
      quantity: parsePositiveQuantity(ingredient.quantity, 'La cantidad del ingrediente no es valida.'),
    };
  });
}

/**
 * Valida cantidades de recetas afectadas por un cambio de alimento.
 *
 * @param {Object} params Parametros.
 * @param {Array<{recipeId: string, quantity: number}>} params.recipeIngredientUpdates Actualizaciones de entrada.
 * @param {import('../domain/types.js').Recipe[]} params.affectedRecipes Recetas que usan el alimento.
 * @param {boolean} params.mustUpdateAll Indica si todas las recetas afectadas son obligatorias.
 * @returns {Map<string, number>} Cantidades por receta.
 */
function normalizeRecipeIngredientUpdates({
  recipeIngredientUpdates,
  affectedRecipes,
  mustUpdateAll,
}) {
  const affectedRecipeIds = new Set(affectedRecipes.map((recipe) => recipe.id));
  const updatesByRecipeId = new Map();

  for (const update of recipeIngredientUpdates) {
    const recipeId = cleanText(update.recipeId);

    if (!affectedRecipeIds.has(recipeId)) {
      throw new DomainError('Hay una receta no relacionada en la edicion del alimento.', 'PANTRY_RECIPE_UPDATE_INVALID');
    }

    if (updatesByRecipeId.has(recipeId)) {
      throw new DomainError('Hay una receta repetida en la edicion del alimento.', 'PANTRY_RECIPE_UPDATE_DUPLICATED');
    }

    updatesByRecipeId.set(
      recipeId,
      parsePositiveQuantity(update.quantity, 'La cantidad de receta debe ser mayor que cero.'),
    );
  }

  if (mustUpdateAll) {
    const missingRecipe = affectedRecipes.find((recipe) => !updatesByRecipeId.has(recipe.id));

    if (missingRecipe) {
      throw new DomainError(
        `Actualiza la cantidad de "${missingRecipe.name}" antes de cambiar la unidad.`,
        'PANTRY_UNIT_RECIPE_UPDATE_REQUIRED',
      );
    }
  }

  if (affectedRecipes.length === 0 && updatesByRecipeId.size > 0) {
    throw new DomainError('El alimento no se usa en recetas.', 'PANTRY_RECIPE_UPDATE_INVALID');
  }

  return updatesByRecipeId;
}

/**
 * Aplica cambios de cantidad a los ingredientes que usan un alimento.
 *
 * @param {Object} params Parametros.
 * @param {import('../domain/types.js').Recipe[]} params.affectedRecipes Recetas que usan el alimento.
 * @param {Map<string, number>} params.recipeIngredientUpdates Cantidades por receta.
 * @param {string} params.pantryItemId Alimento editado.
 * @param {string} params.updatedAt Fecha ISO de actualizacion.
 * @returns {import('../domain/types.js').Recipe[]} Recetas actualizadas.
 */
function applyRecipeIngredientUpdates({
  affectedRecipes,
  recipeIngredientUpdates,
  pantryItemId,
  updatedAt,
}) {
  if (recipeIngredientUpdates.size === 0) {
    return [];
  }

  return affectedRecipes
    .filter((recipe) => recipeIngredientUpdates.has(recipe.id))
    .map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) =>
        ingredient.pantryItemId === pantryItemId
          ? { ...ingredient, quantity: recipeIngredientUpdates.get(recipe.id) }
          : ingredient,
      ),
      updatedAt,
    }));
}
