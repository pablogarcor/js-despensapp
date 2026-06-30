import { DomainError } from '../../domain/errors.js';
import { MEAL_TYPES } from '../../domain/types.js';
import { cleanText, parsePositiveQuantity } from './text.js';

/**
 * Valida tipos de comida de una receta.
 *
 * @param {unknown[]} mealTypes Tipos seleccionados.
 * @returns {import('../../domain/types.js').MealType[]} Tipos validos.
 */
export function normalizeMealTypes(mealTypes) {
  const selectedMealTypes = [...new Set(mealTypes)].filter((mealType) => MEAL_TYPES.includes(mealType));

  if (selectedMealTypes.length === 0) {
    throw new DomainError('Selecciona al menos un momento del dia para la receta.', 'MEAL_TYPE_REQUIRED');
  }

  return selectedMealTypes;
}

/**
 * Valida ingredientes y garantiza que todos existan en la despensa.
 *
 * @param {import('../../domain/types.js').RecipeIngredient[]} ingredients Ingredientes de entrada.
 * @param {import('../../domain/types.js').PantryItem[]} pantryItems Alimentos disponibles.
 * @returns {import('../../domain/types.js').RecipeIngredient[]} Ingredientes normalizados.
 */
export function normalizeIngredients(ingredients, pantryItems) {
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
 * @param {import('../../domain/types.js').Recipe[]} params.affectedRecipes Recetas que usan el alimento.
 * @param {boolean} params.mustUpdateAll Indica si todas las recetas afectadas son obligatorias.
 * @returns {Map<string, number>} Cantidades por receta.
 */
export function normalizeRecipeIngredientUpdates({
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
 * @param {import('../../domain/types.js').Recipe[]} params.affectedRecipes Recetas que usan el alimento.
 * @param {Map<string, number>} params.recipeIngredientUpdates Cantidades por receta.
 * @param {string} params.pantryItemId Alimento editado.
 * @param {string} params.updatedAt Fecha ISO de actualizacion.
 * @returns {import('../../domain/types.js').Recipe[]} Recetas actualizadas.
 */
export function applyRecipeIngredientUpdates({
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
