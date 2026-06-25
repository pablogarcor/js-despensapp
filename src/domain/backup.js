import { DomainError } from './errors.js';
import { MEAL_TYPES } from './types.js';

export const BACKUP_APP_ID = 'despensapp';
export const BACKUP_SCHEMA_VERSION = 2;
const SUPPORTED_BACKUP_SCHEMA_VERSIONS = Object.freeze([1, 2]);

/**
 * Construye un backup JSON versionado de los datos locales.
 *
 * @param {Object} params Datos a exportar.
 * @param {import('./types.js').PantryItem[]} params.pantryItems Alimentos.
 * @param {import('./types.js').Recipe[]} params.recipes Recetas.
 * @param {import('./types.js').PlannedMeal[]} params.plannedMeals Comidas planificadas.
 * @param {import('./types.js').ShoppingItem[]} [params.shoppingItems] Entradas de compra.
 * @param {string} params.exportedAt Fecha ISO de exportacion.
 * @returns {import('./types.js').PantryBackup} Backup serializable.
 */
export function createBackup({ pantryItems, recipes, plannedMeals, shoppingItems = [], exportedAt }) {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: {
      pantryItems,
      recipes,
      plannedMeals,
      shoppingItems,
    },
  };
}

/**
 * Valida y sanea un backup antes de importarlo.
 *
 * @param {unknown} backup Backup parseado desde JSON.
 * @returns {import('./types.js').BackupData} Datos validados.
 */
export function validateBackup(backup) {
  if (!isPlainObject(backup)) {
    throw new DomainError('El archivo de importacion no tiene un formato valido.', 'BACKUP_INVALID');
  }

  if (
    backup.app !== BACKUP_APP_ID ||
    !SUPPORTED_BACKUP_SCHEMA_VERSIONS.includes(backup.schemaVersion)
  ) {
    throw new DomainError('El archivo no pertenece a una version compatible de DespensApp.', 'BACKUP_VERSION');
  }

  if (!isPlainObject(backup.data)) {
    throw new DomainError('El archivo no contiene datos importables.', 'BACKUP_DATA_INVALID');
  }

  const pantryItems = validatePantryItems(backup.data.pantryItems);
  const recipes = validateRecipes(backup.data.recipes, pantryItems);
  const plannedMeals = validatePlannedMeals(backup.data.plannedMeals, recipes);
  const shoppingItems =
    backup.schemaVersion >= 2
      ? validateShoppingItems(backup.data.shoppingItems, pantryItems)
      : [];

  return {
    pantryItems,
    recipes,
    plannedMeals,
    shoppingItems,
  };
}

/**
 * Valida alimentos de despensa.
 *
 * @param {unknown} records Registros de entrada.
 * @returns {import('./types.js').PantryItem[]} Alimentos saneados.
 */
function validatePantryItems(records) {
  assertArray(records, 'El backup debe incluir una lista de alimentos.');
  assertUniqueIds(records, 'Hay alimentos duplicados en el backup.');

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay un alimento con formato invalido.', 'BACKUP_PANTRY_INVALID');
    }

    const id = parseRequiredString(record.id, 'Hay un alimento sin identificador.');
    const name = parseRequiredString(record.name, 'Hay un alimento sin nombre.');
    const unit = parseRequiredString(record.unit, 'Hay un alimento sin unidad.');
    const quantity = parseNonNegativeNumber(record.quantity, 'Hay un alimento con cantidad invalida.');

    return {
      id,
      name,
      quantity,
      unit,
      createdAt: parseOptionalString(record.createdAt),
      updatedAt: parseOptionalString(record.updatedAt),
    };
  });
}

/**
 * Valida recetas y sus ingredientes.
 *
 * @param {unknown} records Registros de entrada.
 * @param {import('./types.js').PantryItem[]} pantryItems Alimentos validados.
 * @returns {import('./types.js').Recipe[]} Recetas saneadas.
 */
function validateRecipes(records, pantryItems) {
  assertArray(records, 'El backup debe incluir una lista de recetas.');
  assertUniqueIds(records, 'Hay recetas duplicadas en el backup.');

  const pantryIds = new Set(pantryItems.map((item) => item.id));

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay una receta con formato invalido.', 'BACKUP_RECIPE_INVALID');
    }

    const id = parseRequiredString(record.id, 'Hay una receta sin identificador.');
    const name = parseRequiredString(record.name, 'Hay una receta sin nombre.');
    const mealTypes = validateMealTypes(record.mealTypes);
    const ingredients = validateRecipeIngredients(record.ingredients, pantryIds);

    return {
      id,
      name,
      mealTypes,
      ingredients,
      createdAt: parseOptionalString(record.createdAt),
      updatedAt: parseOptionalString(record.updatedAt),
    };
  });
}

/**
 * Valida comidas planificadas y su relacion con recetas.
 *
 * @param {unknown} records Registros de entrada.
 * @param {import('./types.js').Recipe[]} recipes Recetas validadas.
 * @returns {import('./types.js').PlannedMeal[]} Comidas saneadas.
 */
function validatePlannedMeals(records, recipes) {
  assertArray(records, 'El backup debe incluir una lista de comidas planificadas.');
  assertUniqueIds(records, 'Hay comidas planificadas duplicadas en el backup.');

  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const occupiedSlots = new Set();

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay una comida planificada con formato invalido.', 'BACKUP_MEAL_INVALID');
    }

    const id = parseRequiredString(record.id, 'Hay una comida planificada sin identificador.');
    const date = parseDate(record.date);
    const mealType = parseMealType(record.mealType);
    const recipeId = parseRequiredString(record.recipeId, 'Hay una comida planificada sin receta.');
    const servings = parsePositiveNumber(record.servings, 'Hay una comida planificada con raciones invalidas.');
    const recipe = recipesById.get(recipeId);

    if (!recipe) {
      throw new DomainError('Hay una comida planificada con una receta inexistente.', 'BACKUP_MEAL_RECIPE');
    }

    if (!recipe.mealTypes.includes(mealType)) {
      throw new DomainError('Hay una comida planificada con una receta incompatible.', 'BACKUP_MEAL_COMPATIBILITY');
    }

    const slotKey = `${date}__${mealType}`;

    if (occupiedSlots.has(slotKey)) {
      throw new DomainError('Hay dos comidas planificadas en la misma fecha y franja.', 'BACKUP_MEAL_DUPLICATED');
    }

    occupiedSlots.add(slotKey);

    return {
      id,
      date,
      mealType,
      recipeId,
      servings,
      createdAt: parseOptionalString(record.createdAt),
      updatedAt: parseOptionalString(record.updatedAt),
    };
  });
}

/**
 * Valida estado y extras de lista de compra.
 *
 * @param {unknown} records Registros de entrada.
 * @param {import('./types.js').PantryItem[]} pantryItems Alimentos validados.
 * @returns {import('./types.js').ShoppingItem[]} Entradas saneadas.
 */
function validateShoppingItems(records, pantryItems) {
  assertArray(records, 'El backup debe incluir una lista de compra.');
  assertUniqueIds(records, 'Hay entradas de compra duplicadas en el backup.');

  const pantryIds = new Set(pantryItems.map((item) => item.id));
  const generatedPantryIds = new Set();

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay una entrada de compra con formato invalido.', 'BACKUP_SHOPPING_INVALID');
    }

    const id = parseRequiredString(record.id, 'Hay una entrada de compra sin identificador.');
    const kind = parseShoppingItemKind(record.kind);
    const checked = parseBoolean(record.checked, 'Hay una entrada de compra con marcado invalido.');
    const createdAt = parseOptionalString(record.createdAt);
    const updatedAt = parseOptionalString(record.updatedAt);

    if (kind === 'generated') {
      const pantryItemId = parseRequiredString(record.pantryItemId, 'Hay una compra generada sin alimento.');

      if (!pantryIds.has(pantryItemId)) {
        throw new DomainError('Hay una compra generada con un alimento inexistente.', 'BACKUP_SHOPPING_PANTRY');
      }

      if (generatedPantryIds.has(pantryItemId)) {
        throw new DomainError('Hay compras generadas duplicadas para un alimento.', 'BACKUP_SHOPPING_DUPLICATED');
      }

      generatedPantryIds.add(pantryItemId);

      return {
        id,
        kind,
        pantryItemId,
        checked,
        createdAt,
        updatedAt,
      };
    }

    return {
      id,
      kind,
      name: parseRequiredString(record.name, 'Hay un extra de compra sin nombre.'),
      quantity: parsePositiveNumber(record.quantity, 'Hay un extra de compra con cantidad invalida.'),
      unit: parseRequiredString(record.unit, 'Hay un extra de compra sin unidad.'),
      checked,
      createdAt,
      updatedAt,
    };
  });
}

/**
 * Valida ingredientes de receta.
 *
 * @param {unknown} records Ingredientes.
 * @param {Set<string>} pantryIds Identificadores de alimentos validos.
 * @returns {import('./types.js').RecipeIngredient[]} Ingredientes saneados.
 */
function validateRecipeIngredients(records, pantryIds) {
  assertArray(records, 'Hay una receta sin lista de ingredientes.');

  if (records.length === 0) {
    throw new DomainError('Hay una receta sin ingredientes.', 'BACKUP_RECIPE_EMPTY');
  }

  const usedPantryIds = new Set();

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay un ingrediente con formato invalido.', 'BACKUP_INGREDIENT_INVALID');
    }

    const pantryItemId = parseRequiredString(record.pantryItemId, 'Hay un ingrediente sin alimento.');
    const quantity = parsePositiveNumber(record.quantity, 'Hay un ingrediente con cantidad invalida.');

    if (!pantryIds.has(pantryItemId)) {
      throw new DomainError('Hay una receta con un alimento inexistente.', 'BACKUP_INGREDIENT_PANTRY');
    }

    if (usedPantryIds.has(pantryItemId)) {
      throw new DomainError('Hay una receta con ingredientes duplicados.', 'BACKUP_INGREDIENT_DUPLICATED');
    }

    usedPantryIds.add(pantryItemId);

    return {
      pantryItemId,
      quantity,
    };
  });
}

/**
 * Valida momentos del dia.
 *
 * @param {unknown} records Valores de entrada.
 * @returns {import('./types.js').MealType[]} Momentos validos.
 */
function validateMealTypes(records) {
  assertArray(records, 'Hay una receta sin momentos del dia.');

  const mealTypes = [...new Set(records.map((value) => parseMealType(value)))];

  if (mealTypes.length === 0) {
    throw new DomainError('Hay una receta sin momentos del dia.', 'BACKUP_RECIPE_MEAL_TYPES');
  }

  return mealTypes;
}

/**
 * Valida un valor de franja.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {import('./types.js').MealType} Franja valida.
 */
function parseMealType(value) {
  if (!MEAL_TYPES.includes(value)) {
    throw new DomainError('Hay una franja de comida invalida en el backup.', 'BACKUP_MEAL_TYPE');
  }

  return value;
}

/**
 * Valida el origen de una entrada de compra.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {import('./types.js').ShoppingItemKind} Tipo valido.
 */
function parseShoppingItemKind(value) {
  if (value !== 'generated' && value !== 'extra') {
    throw new DomainError('Hay un tipo de compra invalido en el backup.', 'BACKUP_SHOPPING_KIND');
  }

  return value;
}

/**
 * Valida un booleano de backup.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {boolean} Booleano validado.
 */
function parseBoolean(value, errorMessage) {
  if (typeof value !== 'boolean') {
    throw new DomainError(errorMessage, 'BACKUP_BOOLEAN_INVALID');
  }

  return value;
}

/**
 * Valida una fecha YYYY-MM-DD.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Fecha valida.
 */
function parseDate(value) {
  const date = parseRequiredString(value, 'Hay una comida planificada sin fecha.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DomainError('Hay una comida planificada con fecha invalida.', 'BACKUP_MEAL_DATE');
  }

  return date;
}

/**
 * Valida texto obligatorio.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {string} Texto saneado.
 */
function parseRequiredString(value, errorMessage) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError(errorMessage, 'BACKUP_STRING_REQUIRED');
  }

  return value.trim();
}

/**
 * Valida texto opcional, rellenando con fecha actual si falta.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Texto saneado.
 */
function parseOptionalString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : new Date().toISOString();
}

/**
 * Valida numero mayor o igual a cero.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Numero valido.
 */
function parseNonNegativeNumber(value, errorMessage) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new DomainError(errorMessage, 'BACKUP_NUMBER_INVALID');
  }

  return number;
}

/**
 * Valida numero positivo.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 * @returns {number} Numero valido.
 */
function parsePositiveNumber(value, errorMessage) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new DomainError(errorMessage, 'BACKUP_NUMBER_INVALID');
  }

  return number;
}

/**
 * Comprueba que una entrada sea un array.
 *
 * @param {unknown} value Valor de entrada.
 * @param {string} errorMessage Mensaje si falla.
 */
function assertArray(value, errorMessage) {
  if (!Array.isArray(value)) {
    throw new DomainError(errorMessage, 'BACKUP_ARRAY_REQUIRED');
  }
}

/**
 * Comprueba ids unicos en una coleccion.
 *
 * @param {unknown[]} records Registros.
 * @param {string} errorMessage Mensaje si falla.
 */
function assertUniqueIds(records, errorMessage) {
  const ids = new Set();

  for (const record of records) {
    if (!isPlainObject(record) || typeof record.id !== 'string') {
      continue;
    }

    if (ids.has(record.id)) {
      throw new DomainError(errorMessage, 'BACKUP_DUPLICATED_ID');
    }

    ids.add(record.id);
  }
}

/**
 * Comprueba que un valor sea un objeto plano.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {boolean} Resultado.
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
