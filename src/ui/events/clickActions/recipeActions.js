import { createIngredientRow } from '../../uiState.js';

/**
 * Acciones de click de la pantalla de recetas.
 */
export const recipeClickActionMethods = {
  async handleRecipeClickAction({ action, id }) {
    if (action === 'delete-recipe') {
      this.state.deletingRecipeId = id;
      this.state.viewingRecipeId = null;
      return { shouldRefresh: false };
    }

    if (action === 'confirm-delete-recipe') {
      const recipe = await this.service.deleteRecipe(id);
      this.state.deletingRecipeId = null;
      this.state.recipeFormOpen = false;
      this.state.createRecipeDraft = null;

      if (this.state.editingRecipeId === id) {
        this.state.editingRecipeId = null;
        this.state.editRecipeDraft = null;
        this.state.editIngredientRows = [];
      }

      this.showToast('Receta eliminada.', 'success', {
        undo: { kind: 'deleted-recipe', payload: recipe },
      });
      return { shouldRefresh: true };
    }

    if (action === 'show-recipe-form') {
      this.state.recipeFormOpen = true;
      this.state.editingRecipeId = null;
      this.state.deletingRecipeId = null;
      this.state.viewingRecipeId = null;
      return { shouldRefresh: false };
    }

    if (action === 'clear-recipe-search') {
      this.state.recipeSearch = '';
      return { shouldRefresh: false };
    }

    if (action === 'edit-recipe') {
      const recipe = this.state.dashboard.recipes.find((candidate) => candidate.id === id);

      if (recipe) {
        this.state.recipeFormOpen = false;
        this.state.createRecipeDraft = null;
        this.state.deletingRecipeId = null;
        this.state.viewingRecipeId = null;
        this.state.editingRecipeId = recipe.id;
        this.state.editRecipeDraft = {
          name: recipe.name,
          mealTypes: [...recipe.mealTypes],
        };
        this.state.editIngredientRows = recipe.ingredients.map((ingredient) =>
          createIngredientRow({
            pantryItemId: ingredient.pantryItemId,
            quantity: String(ingredient.quantity),
          }),
        );
      }

      return { shouldRefresh: false };
    }

    if (action === 'view-recipe-ingredients') {
      this.state.viewingRecipeId = id;
      this.state.recipeFormOpen = false;
      this.state.editingRecipeId = null;
      this.state.deletingRecipeId = null;
      return { shouldRefresh: false };
    }

    return null;
  },

  handleIngredientRowClickAction({ action, id, actionElement }) {
    if (!this.isIngredientRowAction(action)) {
      return null;
    }

    const recipeSheetScrollTop = this.getEntitySheetScrollTop();
    this.updateRecipeIngredientRows(action, actionElement.closest('form'), id);

    return {
      shouldRefresh: false,
      recipeSheetScrollTop,
    };
  },
};
