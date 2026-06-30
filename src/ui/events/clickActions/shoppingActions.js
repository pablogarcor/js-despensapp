/**
 * Acciones de click de lista de la compra.
 */
export const shoppingClickActionMethods = {
  async handleShoppingClickAction({ action, id }) {
    if (action === 'delete-shopping-extra') {
      await this.service.deleteShoppingExtra(id);
      this.showToast('Extra eliminado.');
      return { shouldRefresh: true };
    }

    if (action === 'show-shopping-extra-form') {
      this.state.shoppingExtraFormOpen = true;
      return { shouldRefresh: false };
    }

    if (action !== 'apply-shopping-purchase') {
      return null;
    }

    const summary = await this.service.applyShoppingPurchase();
    this.state.shoppingExtraFormOpen = false;
    const createdText = summary.createdPantryItems > 0 ? ` ${summary.createdPantryItems} alimentos nuevos.` : '';
    this.showToast(`${summary.purchasedItems} compras sumadas a la despensa.${createdText}`);

    return { shouldRefresh: true };
  },
};
