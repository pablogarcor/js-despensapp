import { createIngredientRow } from '../../uiState.js';

/**
 * Cierres locales de hojas inferiores sin ejecutar reglas de negocio.
 */
export const actionSheetDismissMethods = {
  applyActionSheetDismiss(action) {
    if (action === 'hide-plan-actions') {
      this.state.planActionsOpen = false;
      return true;
    }

    if (action === 'hide-planned-meal-slot') {
      this.state.activeMealSlotKey = null;
      return true;
    }

    if (action === 'hide-pending-meals') {
      this.omitPendingMealsForToday();
      return true;
    }

    if (action === 'cancel-edit-planned-meal') {
      this.state.editingPlannedMealId = null;
      return true;
    }

    if (action === 'hide-pantry-form') {
      this.state.pantryFormOpen = false;
      return true;
    }

    if (action === 'cancel-edit-pantry-item') {
      this.state.editingPantryItemId = null;
      return true;
    }

    if (action === 'cancel-delete-pantry-item') {
      this.state.deletingPantryItemId = null;
      return true;
    }

    if (action === 'hide-recipe-form') {
      this.state.recipeFormOpen = false;
      this.state.createRecipeDraft = null;
      this.state.ingredientRows = [createIngredientRow()];
      return true;
    }

    if (action === 'hide-recipe-ingredients') {
      this.state.viewingRecipeId = null;
      return true;
    }

    if (action === 'cancel-edit-recipe') {
      this.state.editingRecipeId = null;
      this.state.editRecipeDraft = null;
      this.state.editIngredientRows = [];
      return true;
    }

    if (action === 'cancel-delete-recipe') {
      this.state.deletingRecipeId = null;
      return true;
    }

    if (action === 'hide-shopping-extra-form') {
      this.state.shoppingExtraFormOpen = false;
      return true;
    }

    return false;
  },
};
