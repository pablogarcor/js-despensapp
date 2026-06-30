import { createIngredientRow } from '../uiState.js';

/**
 * Metodos de lectura y sincronizacion de formularios con ingredientes dinamicos.
 */
export const recipeFormStateMethods = {
  /**
   * Ajusta el valor numerico de un input asociado a un boton de stepper.
   *
   * @param {HTMLElement} actionElement Boton que dispara el ajuste.
   */
  adjustNumberInput(actionElement) {
    const form = actionElement.closest('form');
    const targetName = actionElement.dataset.target;
    const step = Number.parseFloat(actionElement.dataset.step ?? '0');

    if (!form || !targetName || !Number.isFinite(step) || step === 0) {
      return;
    }

    const input = form.elements.namedItem(targetName);

    if (!input || typeof input.value !== 'string') {
      return;
    }

    const min = Number.parseFloat(input.min);
    const max = Number.parseFloat(input.max);
    const current = Number.parseFloat(input.value);
    const fallback = Number.isFinite(min) ? min : 0;
    const lowerLimit = Number.isFinite(min) ? min : -Infinity;
    const upperLimit = Number.isFinite(max) ? max : Infinity;
    const next = Math.min(upperLimit, Math.max(lowerLimit, (Number.isFinite(current) ? current : fallback) + step));
    const roundedNext = Math.round(next * 100) / 100;

    input.value = String(roundedNext);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  },

  /**
   * Lee ingredientes desde FormData preservando las filas dinamicas.
   *
   * @param {FormData} data Datos del formulario.
   * @returns {import('../../domain/types.js').RecipeIngredient[]} Ingredientes.
   */
  readIngredientsFromForm(data) {
    const itemIds = data.getAll('ingredientItem');
    const quantities = data.getAll('ingredientQuantity');

    return itemIds.map((pantryItemId, index) => ({
      pantryItemId,
      quantity: quantities[index],
    }));
  },

  /**
   * Lee cantidades de recetas afectadas al editar un alimento.
   *
   * @param {FormData} data Datos del formulario.
   * @returns {Array<{recipeId: string, quantity: FormDataEntryValue}>} Cantidades por receta.
   */
  readPantryRecipeUpdatesFromForm(data) {
    const recipeIds = data.getAll('recipeIngredientRecipeId');
    const quantities = data.getAll('recipeIngredientQuantity');

    return recipeIds.map((recipeId, index) => ({
      recipeId,
      quantity: quantities[index],
    }));
  },

  /**
   * Sincroniza el borrador de creacion de receta desde el formulario visible.
   *
   * @param {HTMLFormElement | null} form Formulario de creacion.
   */
  syncCreateRecipeForm(form) {
    this.syncRecipeFormState(form, {
      draftKey: 'createRecipeDraft',
      rowsKey: 'ingredientRows',
      rowSelector: '[data-ingredient-row]',
      rowDatasetKey: 'ingredientRow',
    });
  },

  /**
   * Sincroniza filas de ingredientes de edicion desde el formulario visible.
   *
   * @param {HTMLFormElement | null} form Formulario de edicion.
   */
  syncEditIngredientRows(form) {
    this.syncRecipeFormState(form, {
      draftKey: 'editRecipeDraft',
      rowsKey: 'editIngredientRows',
      rowSelector: '[data-edit-ingredient-row]',
      rowDatasetKey: 'editIngredientRow',
    });
  },

  /**
   * Sincroniza el borrador y filas de ingredientes de cualquier formulario de receta.
   *
   * @param {HTMLFormElement | null} form Formulario visible.
   * @param {{draftKey: string, rowsKey: string, rowSelector: string, rowDatasetKey: string}} options Configuracion de estado.
   */
  syncRecipeFormState(form, { draftKey, rowsKey, rowSelector, rowDatasetKey }) {
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    this.state[draftKey] = {
      name: formData.get('name'),
      mealTypes: formData.getAll('mealTypes'),
    };
    this.state[rowsKey] = [...form.querySelectorAll(rowSelector)].map((rowElement) => ({
      id: rowElement.dataset[rowDatasetKey],
      pantryItemId: rowElement.querySelector('[name="ingredientItem"]').value,
      quantity: rowElement.querySelector('[name="ingredientQuantity"]').value,
    }));
  },

  /**
   * Comprueba si una accion modifica filas dinamicas de ingredientes.
   *
   * @param {string} action Accion de UI.
   * @returns {boolean} True si modifica ingredientes.
   */
  isIngredientRowAction(action) {
    return [
      'add-ingredient-row',
      'remove-ingredient-row',
      'add-edit-ingredient-row',
      'remove-edit-ingredient-row',
    ].includes(action);
  },

  /**
   * Anade o elimina filas de ingredientes preservando el borrador visible.
   *
   * @param {string} action Accion de UI.
   * @param {HTMLFormElement | null} form Formulario visible.
   * @param {string | undefined} rowId Fila a eliminar, si aplica.
   */
  updateRecipeIngredientRows(action, form, rowId) {
    const isEditForm = action.includes('edit');
    const rowsKey = isEditForm ? 'editIngredientRows' : 'ingredientRows';

    if (isEditForm) {
      this.syncEditIngredientRows(form);
    } else {
      this.syncCreateRecipeForm(form);
    }

    if (action.startsWith('add')) {
      this.state[rowsKey].push(createIngredientRow());
      return;
    }

    this.state[rowsKey] = this.state[rowsKey].filter((row) => row.id !== rowId);

    if (this.state[rowsKey].length === 0) {
      this.state[rowsKey].push(createIngredientRow());
    }
  },

  /**
   * Actualiza en memoria una fila de ingrediente tras cambiar un campo.
   *
   * @param {EventTarget | null} target Campo modificado.
   * @param {{rowSelector: string, rowDatasetKey: string, rowsKey: string}} options Configuracion de filas.
   * @returns {boolean} True si se encontro una fila compatible.
   */
  syncIngredientRowChange(target, { rowSelector, rowDatasetKey, rowsKey }) {
    const rowElement = target?.closest?.(rowSelector);

    if (!rowElement) {
      return false;
    }

    const row = this.state[rowsKey].find((ingredientRow) => ingredientRow.id === rowElement.dataset[rowDatasetKey]);

    if (!row) {
      return true;
    }

    if (target.matches('[name="ingredientItem"]')) {
      row.pantryItemId = target.value;
    }

    if (target.matches('[name="ingredientQuantity"]')) {
      row.quantity = target.value;
    }

    return true;
  },

  /**
   * Obtiene el scroll interno de la hoja de edicion de entidad.
   *
   * @returns {number | null} Posicion vertical del contenido scrolleable.
   */
  getEntitySheetScrollTop() {
    const scrollElement = this.root.querySelector('.entity-edit-sheet-body');

    return scrollElement ? scrollElement.scrollTop : null;
  },

  /**
   * Restaura el scroll interno de la hoja de edicion de entidad tras renderizar.
   *
   * @param {number} scrollTop Posicion vertical previa.
   */
  restoreEntitySheetScroll(scrollTop) {
    const scrollElement = this.root.querySelector('.entity-edit-sheet-body');

    if (scrollElement) {
      scrollElement.scrollTop = scrollTop;
    }
  },
};
