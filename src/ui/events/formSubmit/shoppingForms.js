/**
 * Envios de formularios de compra.
 */
export const shoppingFormSubmitMethods = {
  async handleShoppingFormSubmit({ form }) {
    if (!form.matches('[data-form="shopping-extra"]')) {
      return null;
    }

    const data = new FormData(form);
    await this.service.createShoppingExtra({
      name: data.get('name'),
      quantity: data.get('quantity'),
      unit: data.get('unit'),
    });
    form.reset();
    this.state.shoppingExtraFormOpen = false;
    this.showToast('Extra anadido a la compra.');

    return { shouldRefresh: true };
  },
};
