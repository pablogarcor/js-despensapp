import { createIngredientRow } from '../../uiState.js';

/**
 * Envios de formularios de recetas.
 */
export const recipeFormSubmitMethods = {
  async handleRecipeFormSubmit({ form }) {
    if (form.matches('[data-form="recipe"]')) {
      const data = new FormData(form);
      await this.service.createRecipe({
        name: data.get('name'),
        mealTypes: data.getAll('mealTypes'),
        ingredients: this.readIngredientsFromForm(data),
      });
      this.state.ingredientRows = [createIngredientRow()];
      this.state.createRecipeDraft = null;
      this.state.recipeFormOpen = false;
      this.showToast('Receta creada.');
      return { shouldRefresh: true };
    }

    if (!form.matches('[data-form="recipe-edit"]')) {
      return null;
    }

    const data = new FormData(form);
    await this.service.updateRecipe(data.get('recipeId'), {
      name: data.get('name'),
      mealTypes: data.getAll('mealTypes'),
      ingredients: this.readIngredientsFromForm(data),
    });
    this.state.editingRecipeId = null;
    this.state.editRecipeDraft = null;
    this.state.editIngredientRows = [];
    this.showToast('Receta actualizada.');

    return { shouldRefresh: true };
  },
};
