import { DomainError } from '../errors.js';
import {
  assertArray,
  assertUniqueIds,
  isPlainObject,
  parseMealType,
  parseOptionalString,
  parsePositiveNumber,
  parseRequiredString,
} from './parsers.js';

/**
 * Valida recetas y sus ingredientes.
 *
 * @param {unknown} records Registros de entrada.
 * @param {import('../types.js').PantryItem[]} pantryItems Alimentos validados.
 * @returns {import('../types.js').Recipe[]} Recetas saneadas.
 */
export function validateRecipes(records, pantryItems) {
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
 * Valida ingredientes de receta.
 *
 * @param {unknown} records Ingredientes.
 * @param {Set<string>} pantryIds Identificadores de alimentos validos.
 * @returns {import('../types.js').RecipeIngredient[]} Ingredientes saneados.
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
 * @returns {import('../types.js').MealType[]} Momentos validos.
 */
function validateMealTypes(records) {
  assertArray(records, 'Hay una receta sin momentos del dia.');

  const mealTypes = [...new Set(records.map((value) => parseMealType(value)))];

  if (mealTypes.length === 0) {
    throw new DomainError('Hay una receta sin momentos del dia.', 'BACKUP_RECIPE_MEAL_TYPES');
  }

  return mealTypes;
}
