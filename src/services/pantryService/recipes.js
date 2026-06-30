import { DomainError } from '../../domain/errors.js';
import { createId, normalizeName } from '../../domain/planning.js';
import {
  cleanText,
  isRecipePlannedMeal,
  normalizeIngredients,
  normalizeMealTypes,
} from './helpers.js';

/**
 * Operaciones de recetas e integridad con planificacion.
 */
export const recipeServiceMethods = {
  /**
   * Crea una receta con ingredientes existentes en la despensa.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {import('../../domain/types.js').MealType[]} params.mealTypes Tipos de comida.
   * @param {import('../../domain/types.js').RecipeIngredient[]} params.ingredients Ingredientes por racion.
   * @returns {Promise<import('../../domain/types.js').Recipe>} Receta creada.
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
  },

  /**
   * Actualiza una receta existente conservando su identificador.
   *
   * Si la receta esta planificada, sus nuevas franjas compatibles deben seguir
   * cubriendo todas las comidas planificadas que ya la usan.
   *
   * @param {string} recipeId Identificador de la receta.
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {import('../../domain/types.js').MealType[]} params.mealTypes Tipos de comida.
   * @param {import('../../domain/types.js').RecipeIngredient[]} params.ingredients Ingredientes por racion.
   * @returns {Promise<import('../../domain/types.js').Recipe>} Receta actualizada.
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
  },

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
  },

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
  },
};
