/**
 * Metodos para teclado, cambios de formulario y busquedas locales.
 */
export const inputEventMethods = {
  /**
   * Activa elementos interactivos no boton con teclado.
   *
   * @param {KeyboardEvent} event Evento de teclado.
   */
  handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const actionElement = event.target.closest('[role="button"][data-action]');

    if (!actionElement || event.target.closest('button, input, select, textarea')) {
      return;
    }

    event.preventDefault();
    actionElement.click();
  },

  /**
   * Mantiene el estado de filas dinamicas de ingredientes al cambiar selects.
   *
   * @param {Event} event Evento change.
   */
  async handleChange(event) {
    const shoppingCheck = event.target.closest('[data-shopping-check]');

    if (shoppingCheck) {
      if (this.state.isBusy) {
        return;
      }

      await this.runSafely(async () => {
        await this.service.setShoppingItemChecked(shoppingCheck.value, shoppingCheck.checked);
        await this.refresh();
      });
      return;
    }

    if (this.syncIngredientRowChange(event.target, {
      rowSelector: '[data-ingredient-row]',
      rowDatasetKey: 'ingredientRow',
      rowsKey: 'ingredientRows',
    })) {
      return;
    }

    this.syncIngredientRowChange(event.target, {
      rowSelector: '[data-edit-ingredient-row]',
      rowDatasetKey: 'editIngredientRow',
      rowsKey: 'editIngredientRows',
    });
  },

  /**
   * Filtra listas locales mientras el usuario escribe en los buscadores.
   *
   * @param {InputEvent} event Evento de input.
   */
  handleInput(event) {
    const searchInput = event.target.closest('[data-search]');

    if (!searchInput) {
      return;
    }

    const searchTarget = searchInput.dataset.search;
    const selectionStart = searchInput.selectionStart ?? searchInput.value.length;
    const selectionEnd = searchInput.selectionEnd ?? searchInput.value.length;

    if (searchTarget === 'pantry') {
      this.state.pantrySearch = searchInput.value;
    }

    if (searchTarget === 'recipe') {
      this.state.recipeSearch = searchInput.value;
    }

    this.render();
    this.restoreSearchFocus(searchTarget, selectionStart, selectionEnd);
  },

  /**
   * Devuelve el foco al buscador tras re-renderizar la lista filtrada.
   *
   * @param {string} searchTarget Buscador que disparo el render.
   * @param {number} selectionStart Inicio de seleccion.
   * @param {number} selectionEnd Fin de seleccion.
   */
  restoreSearchFocus(searchTarget, selectionStart, selectionEnd) {
    const searchInput = this.root.querySelector(`[data-search="${searchTarget}"]`);

    if (!searchInput) {
      return;
    }

    searchInput.focus({ preventScroll: true });

    if (typeof searchInput.setSelectionRange === 'function') {
      searchInput.setSelectionRange(selectionStart, selectionEnd);
    }
  },

  /**
   * Desplaza la planificacion hasta el dia indicado.
   *
   * @param {string} date Fecha YYYY-MM-DD.
   */
  scrollToPlanDay(date) {
    const dayElement = this.root.querySelector(`[data-plan-day="${date}"]`);

    if (!dayElement) {
      return;
    }

    dayElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};
