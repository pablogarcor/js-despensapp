import { downloadBackup } from '../../downloadBackup.js';

/**
 * Acciones de configuracion, backup y borrado global.
 */
export const settingsClickActionMethods = {
  async handleSettingsClickAction({ action }) {
    if (action === 'toggle-settings-import') {
      this.state.settingsImportOpen = !this.state.settingsImportOpen;
      return { shouldRefresh: false };
    }

    if (action === 'toggle-settings-install') {
      this.state.settingsInstallOpen = !this.state.settingsInstallOpen;
      return { shouldRefresh: false };
    }

    if (action === 'export-backup') {
      const backup = await this.service.exportBackup();
      downloadBackup(backup);
      this.showToast('Copia exportada.');
      return { shouldRefresh: false };
    }

    if (action !== 'clear-all-data') {
      return null;
    }

    if (!window.confirm('Borrar todo eliminara despensa, recetas, planificacion y compra.')) {
      return { shouldRefresh: false };
    }

    const summary = await this.service.clearAllData();
    this.state.editingPantryItemId = null;
    this.state.deletingPantryItemId = null;
    this.state.expandedPantryItemId = null;
    this.state.shoppingExtraFormOpen = false;
    this.state.createRecipeDraft = null;
    this.state.editingRecipeId = null;
    this.state.editRecipeDraft = null;
    this.state.editIngredientRows = [];
    this.state.viewingRecipeId = null;
    this.state.deletingRecipeId = null;
    this.state.editingPlannedMealId = null;
    this.state.activeMealSlotKey = null;
    this.state.activeNoteSlotKey = null;
    this.state.pantrySearch = '';
    this.state.recipeSearch = '';
    this.state.pantryFormOpen = true;
    this.state.recipeFormOpen = true;
    this.state.planActionsOpen = false;
    this.showToast(
      `Eliminados ${summary.pantryItems} alimentos, ${summary.recipes} recetas, ${summary.plannedMeals} planes y ${summary.shoppingItems} compras.`,
    );

    return { shouldRefresh: true };
  },
};
