/**
 * Acciones de click de la pantalla de despensa.
 */
export const pantryClickActionMethods = {
  async handlePantryClickAction({ action, id }) {
    if (action === 'delete-pantry-item') {
      this.state.deletingPantryItemId = id;
      return { shouldRefresh: false };
    }

    if (action === 'confirm-delete-pantry-item') {
      await this.service.deletePantryItem(id);
      this.state.deletingPantryItemId = null;

      if (this.state.editingPantryItemId === id) {
        this.state.editingPantryItemId = null;
      }

      if (this.state.expandedPantryItemId === id) {
        this.state.expandedPantryItemId = null;
      }

      this.showToast('Alimento eliminado.');
      return { shouldRefresh: true };
    }

    if (action === 'show-pantry-form') {
      this.state.pantryFormOpen = true;
      this.state.editingPantryItemId = null;
      this.state.deletingPantryItemId = null;
      this.state.expandedPantryItemId = null;
      return { shouldRefresh: false };
    }

    if (action === 'clear-pantry-search') {
      this.state.pantrySearch = '';
      return { shouldRefresh: false };
    }

    if (action === 'edit-pantry-item') {
      this.state.editingPantryItemId = id;
      this.state.deletingPantryItemId = null;
      this.state.pantryFormOpen = false;
      this.state.expandedPantryItemId = null;
      return { shouldRefresh: false };
    }

    if (action === 'toggle-pantry-stock') {
      this.state.expandedPantryItemId = this.state.expandedPantryItemId === id ? null : id;
      return { shouldRefresh: false };
    }

    return null;
  },
};
