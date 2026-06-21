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
import { MEAL_TYPES } from '../domain/types.js';

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
    const [pantryItems, recipes, allMeals] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
    ]);
    const today = toISODate(this.now());
    const plannedMeals = sortPlannedMeals(allMeals.filter((meal) => meal.date >= today));
    const pendingMeals = sortPlannedMeals(allMeals.filter((meal) => meal.date < today));
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
      shoppingList: calculateShoppingList({ pantryItems, recipes, plannedMeals }),
      unavailableMeals: calculateUnavailablePlannedMeals({ pantryItems, recipes, plannedMeals }),
    };
  }

  /**
   * Exporta todos los datos locales de usuario a un backup versionado.
   *
   * @returns {Promise<import('../domain/types.js').PantryBackup>} Backup serializable.
   */
  async exportBackup() {
    const [pantryItems, recipes, plannedMeals] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
    ]);

    return createBackup({
      pantryItems: sortByName(pantryItems),
      recipes: sortByName(recipes),
      plannedMeals: sortPlannedMeals(plannedMeals),
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
    });

    return {
      pantryItems: backupData.pantryItems.length,
      recipes: backupData.recipes.length,
      plannedMeals: backupData.plannedMeals.length,
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
   * Suma cantidad a un alimento existente manteniendo su unidad.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @param {number} quantityToAdd Cantidad positiva que se anadira al stock.
   * @returns {Promise<import('../domain/types.js').PantryItem>} Alimento actualizado.
   */
  async addPantryItemQuantity(pantryItemId, quantityToAdd) {
    const pantryItem = await this.database.get('pantryItems', pantryItemId);

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    const parsedQuantity = parsePositiveQuantity(
      quantityToAdd,
      'La cantidad a anadir debe ser mayor que cero.',
    );
    const updatedItem = {
      ...pantryItem,
      quantity: roundQuantity(pantryItem.quantity + parsedQuantity),
      updatedAt: this.now().toISOString(),
    };

    return this.database.put('pantryItems', updatedItem);
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

    return this.database.put('pantryItems', updatedItem);
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
      (meal) => meal.recipeId === recipeId && !normalizedMealTypes.includes(meal.mealType),
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

    const blockingMeal = plannedMeals.find((meal) => meal.recipeId === recipeId);

    if (blockingMeal) {
      throw new DomainError(
        `No puedes borrar "${recipe.name}" porque esta planificada.`,
        'RECIPE_IN_USE',
      );
    }

    await this.database.delete('recipes', recipeId);
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
      throw new DomainError('Solo puedes anadir comidas dentro de los proximos siete dias.', 'DATE_OUT_OF_PLAN');
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
    return this.database.deleteWhere('plannedMeals', (meal) => meal.date >= today);
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

    if (wasCooked) {
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
