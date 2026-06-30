/**
 * Envios de formularios de despensa y ajuste de stock.
 */
export const pantryFormSubmitMethods = {
  async handlePantryFormSubmit({ form, submitter }) {
    if (form.matches('[data-form="pantry-item"]')) {
      const data = new FormData(form);
      const pantryItem = await this.service.createPantryItem({
        name: data.get('name'),
        quantity: data.get('quantity'),
        unit: data.get('unit'),
      });
      form.reset();
      this.state.pantryFormOpen = false;
      this.showToast('Alimento anadido.', 'success', {
        undo: { kind: 'created-pantry-item', payload: pantryItem },
      });
      return { shouldRefresh: true };
    }

    if (form.matches('[data-form="pantry-stock"]')) {
      const data = new FormData(form);
      const stockAction = submitter?.dataset.stockAction ?? 'add';

      if (stockAction === 'subtract') {
        await this.service.subtractPantryItemQuantity(data.get('pantryItemId'), data.get('quantity'));
      } else {
        await this.service.addPantryItemQuantity(data.get('pantryItemId'), data.get('quantity'));
      }

      form.reset();
      this.showToast('Stock actualizado.');
      return { shouldRefresh: true };
    }

    if (!form.matches('[data-form="pantry-item-edit"]')) {
      return null;
    }

    const data = new FormData(form);
    await this.service.updatePantryItem(data.get('pantryItemId'), {
      name: data.get('name'),
      quantity: data.get('quantity'),
      unit: data.get('unit'),
      recipeIngredientUpdates: this.readPantryRecipeUpdatesFromForm(data),
    });
    this.state.editingPantryItemId = null;
    this.showToast('Alimento actualizado.');

    return { shouldRefresh: true };
  },
};
