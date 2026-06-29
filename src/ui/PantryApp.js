import { DomainError } from '../domain/errors.js';
import { commonRenderMethods } from './render/common.js';
import { pantryViewMethods } from './render/pantryView.js';
import { planViewMethods } from './render/planView.js';
import { recipeViewMethods } from './render/recipeView.js';
import { settingsViewMethods } from './render/settingsView.js';
import { shoppingViewMethods } from './render/shoppingView.js';
import { createIngredientRow, createUiId } from './uiState.js';
import {
  dismissPwaInstallPrompt,
  getPwaInstallPromptCopy,
  getPwaInstallPromptState,
  promptPwaInstall,
  watchPwaInstallPrompt,
} from '../pwa/installPrompt.js';

/**
 * Controlador de UI de la SPA.
 *
 * Mantiene el estado minimo de interfaz y delega todas las reglas de negocio en
 * PantryService. Renderiza HTML declarativo porque el MVP no necesita un
 * framework de componentes.
 */
export class PantryApp {
  /**
   * @param {Object} params Dependencias.
   * @param {HTMLElement} params.root Nodo raiz de la aplicacion.
   * @param {import('../services/pantryService.js').PantryService} params.service Servicio de negocio.
   */
  constructor({ root, service }) {
    this.root = root;
    this.service = service;
    this.toastTimeoutId = null;
    this.unwatchInstallPrompt = null;
    this.state = {
      activeView: 'plan',
      dashboard: null,
      installPrompt: getPwaInstallPromptState(),
      installPromptVisible: false,
      pantrySearch: '',
      recipeSearch: '',
      pantryFormOpen: false,
      recipeFormOpen: false,
      planActionsOpen: false,
      shoppingExtraFormOpen: false,
      settingsImportOpen: false,
      settingsInstallOpen: false,
      selectedPlanDate: null,
      activeMealSlotKey: null,
      activeNoteSlotKey: null,
      expandedPantryItemId: null,
      editingPantryItemId: null,
      deletingPantryItemId: null,
      createRecipeDraft: null,
      ingredientRows: [createIngredientRow()],
      editingRecipeId: null,
      editRecipeDraft: null,
      editIngredientRows: [],
      viewingRecipeId: null,
      deletingRecipeId: null,
      editingPlannedMealId: null,
      toast: null,
      isBusy: false,
    };
  }

  /**
   * Carga datos iniciales, renderiza y registra eventos.
   *
   * @returns {Promise<void>}
   */
  async start() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('keydown', (event) => this.handleKeyDown(event));
    this.root.addEventListener('submit', (event) => this.handleSubmit(event));
    this.root.addEventListener('change', (event) => this.handleChange(event));
    this.root.addEventListener('input', (event) => this.handleInput(event));
    this.unwatchInstallPrompt = watchPwaInstallPrompt((installPrompt) => {
      this.state.installPrompt = installPrompt;
      this.state.installPromptVisible = installPrompt.shouldShowPrompt;

      if (this.state.dashboard) {
        this.render();
      }
    });
    await this.refresh();
  }

  /**
   * Recarga el snapshot agregado desde el servicio.
   *
   * @returns {Promise<void>}
   */
  async refresh() {
    this.state.dashboard = await this.service.getDashboard();
    this.render();
  }

  /**
   * Pinta la aplicacion completa.
   */
  render() {
    const dashboard = this.state.dashboard;

    if (!dashboard) {
      this.root.innerHTML = '<main class="app-shell"><p class="loading-state">Cargando...</p></main>';
      return;
    }

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <button
            class="header-icon-button ${this.state.activeView === 'pantry' ? 'is-active' : ''}"
            type="button"
            data-view="pantry"
            aria-label="Abrir despensa"
            aria-pressed="${this.state.activeView === 'pantry'}"
          >
            ${this.renderIcon('pantry')}
          </button>
          <h1>DespensApp</h1>
          <button
            class="header-icon-button ${this.state.activeView === 'settings' ? 'is-active' : ''}"
            type="button"
            data-view="settings"
            aria-label="Abrir configuracion"
            aria-pressed="${this.state.activeView === 'settings'}"
          >
            ${this.renderIcon('settings')}
          </button>
        </header>

        ${this.renderPendingMeals(dashboard)}
        ${this.renderToast()}
        ${this.renderInstallPrompt()}

        <nav class="tabs" aria-label="Secciones principales">
          ${this.renderTab('plan', 'Plan')}
          ${this.renderTab('pantry', 'Despensa')}
          ${this.renderTab('recipes', 'Recetas')}
          ${this.renderTab('shopping', 'Compra')}
        </nav>

        <main class="view-layout view-${this.state.activeView}">
          ${this.renderActiveView(dashboard)}
        </main>
      </div>
    `;
  }

  /**
   * Gestiona clicks de botones y navegacion.
   *
   * @param {MouseEvent} event Evento de click.
   * @returns {Promise<void>}
   */
  async handleClick(event) {
    const actionElement = event.target.closest('[data-action]');
    const viewElement = event.target.closest('[data-view]');

    if (viewElement) {
      this.state.activeView = viewElement.dataset.view;
      this.render();
      return;
    }

    if (!actionElement || this.state.isBusy) {
      return;
    }

    const { action, id } = actionElement.dataset;
    let recipeSheetScrollTop = null;

    await this.runSafely(async () => {
      let shouldRefresh = true;

      if (action === 'dismiss-toast') {
        this.dismissToast();
        shouldRefresh = false;
      }

      if (action === 'dismiss-install-prompt') {
        dismissPwaInstallPrompt();
        this.state.installPrompt = getPwaInstallPromptState();
        this.state.installPromptVisible = false;
        shouldRefresh = false;
      }

      if (action === 'install-app') {
        const result = await promptPwaInstall();

        if (result?.outcome !== 'accepted') {
          dismissPwaInstallPrompt();
        }

        this.state.installPrompt = getPwaInstallPromptState();
        this.state.installPromptVisible = false;

        if (result?.outcome === 'accepted') {
          this.showToast('Instalacion iniciada.');
        }
        shouldRefresh = false;
      }

      if (action === 'toggle-settings-import') {
        this.state.settingsImportOpen = !this.state.settingsImportOpen;
        shouldRefresh = false;
      }

      if (action === 'toggle-settings-install') {
        this.state.settingsInstallOpen = !this.state.settingsInstallOpen;
        shouldRefresh = false;
      }

      if (action === 'export-backup') {
        const backup = await this.service.exportBackup();
        this.downloadBackup(backup);
        this.showToast('Copia exportada.');
        shouldRefresh = false;
      }

      if (action === 'delete-pantry-item') {
        this.state.deletingPantryItemId = id;
        shouldRefresh = false;
      }

      if (action === 'cancel-delete-pantry-item') {
        this.state.deletingPantryItemId = null;
        shouldRefresh = false;
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
      }

      if (action === 'show-pantry-form') {
        this.state.pantryFormOpen = true;
        this.state.editingPantryItemId = null;
        this.state.deletingPantryItemId = null;
        this.state.expandedPantryItemId = null;
        shouldRefresh = false;
      }

      if (action === 'hide-pantry-form') {
        this.state.pantryFormOpen = false;
        shouldRefresh = false;
      }

      if (action === 'clear-pantry-search') {
        this.state.pantrySearch = '';
        shouldRefresh = false;
      }

      if (action === 'edit-pantry-item') {
        this.state.editingPantryItemId = id;
        this.state.deletingPantryItemId = null;
        this.state.pantryFormOpen = false;
        this.state.expandedPantryItemId = null;
        shouldRefresh = false;
      }

      if (action === 'cancel-edit-pantry-item') {
        this.state.editingPantryItemId = null;
        shouldRefresh = false;
      }

      if (action === 'toggle-pantry-stock') {
        this.state.expandedPantryItemId = this.state.expandedPantryItemId === id ? null : id;
        shouldRefresh = false;
      }

      if (action === 'delete-recipe') {
        this.state.deletingRecipeId = id;
        this.state.viewingRecipeId = null;
        shouldRefresh = false;
      }

      if (action === 'cancel-delete-recipe') {
        this.state.deletingRecipeId = null;
        shouldRefresh = false;
      }

      if (action === 'confirm-delete-recipe') {
        await this.service.deleteRecipe(id);
        this.state.deletingRecipeId = null;
        this.state.recipeFormOpen = false;
        this.state.createRecipeDraft = null;

        if (this.state.editingRecipeId === id) {
          this.state.editingRecipeId = null;
          this.state.editRecipeDraft = null;
          this.state.editIngredientRows = [];
        }

        this.showToast('Receta eliminada.');
      }

      if (action === 'show-recipe-form') {
        this.state.recipeFormOpen = true;
        this.state.editingRecipeId = null;
        this.state.deletingRecipeId = null;
        this.state.viewingRecipeId = null;
        shouldRefresh = false;
      }

      if (action === 'hide-recipe-form') {
        this.state.recipeFormOpen = false;
        this.state.createRecipeDraft = null;
        this.state.ingredientRows = [createIngredientRow()];
        shouldRefresh = false;
      }

      if (action === 'clear-recipe-search') {
        this.state.recipeSearch = '';
        shouldRefresh = false;
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
        shouldRefresh = false;
      }

      if (action === 'view-recipe-ingredients') {
        this.state.viewingRecipeId = id;
        this.state.recipeFormOpen = false;
        this.state.editingRecipeId = null;
        this.state.deletingRecipeId = null;
        shouldRefresh = false;
      }

      if (action === 'hide-recipe-ingredients') {
        this.state.viewingRecipeId = null;
        shouldRefresh = false;
      }

      if (action === 'cancel-edit-recipe') {
        this.state.editingRecipeId = null;
        this.state.editRecipeDraft = null;
        this.state.editIngredientRows = [];
        shouldRefresh = false;
      }

      if (action === 'delete-planned-meal') {
        await this.service.deletePlannedMeal(id);
        this.showToast('Comida eliminada del plan.');
      }

      if (action === 'delete-shopping-extra') {
        await this.service.deleteShoppingExtra(id);
        this.showToast('Extra eliminado.');
      }

      if (action === 'show-shopping-extra-form') {
        this.state.shoppingExtraFormOpen = true;
        shouldRefresh = false;
      }

      if (action === 'hide-shopping-extra-form') {
        this.state.shoppingExtraFormOpen = false;
        shouldRefresh = false;
      }

      if (action === 'apply-shopping-purchase') {
        const summary = await this.service.applyShoppingPurchase();
        this.state.shoppingExtraFormOpen = false;
        const createdText =
          summary.createdPantryItems > 0 ? ` ${summary.createdPantryItems} alimentos nuevos.` : '';
        this.showToast(`${summary.purchasedItems} compras sumadas a la despensa.${createdText}`);
      }

      if (action === 'edit-planned-meal') {
        this.state.editingPlannedMealId = id;
        this.state.planActionsOpen = false;
        this.state.activeMealSlotKey = null;
        this.state.activeNoteSlotKey = null;
        shouldRefresh = false;
      }

      if (action === 'cancel-edit-planned-meal') {
        this.state.editingPlannedMealId = null;
        shouldRefresh = false;
      }

      if (action === 'adjust-number-input') {
        this.adjustNumberInput(actionElement);
        shouldRefresh = false;
      }

      if (action === 'clear-plan') {
        const deletedCount = await this.service.clearCurrentAndFutureMeals();
        this.state.planActionsOpen = false;
        this.state.activeMealSlotKey = null;
        this.state.activeNoteSlotKey = null;
        this.showToast(`${deletedCount} comidas eliminadas del plan.`);
      }

      if (action === 'show-plan-actions') {
        this.state.planActionsOpen = true;
        shouldRefresh = false;
      }

      if (action === 'hide-plan-actions') {
        this.state.planActionsOpen = false;
        shouldRefresh = false;
      }

      if (action === 'scroll-plan-day') {
        this.state.selectedPlanDate = actionElement.dataset.date;
        shouldRefresh = false;
      }

      if (action === 'show-note-slot') {
        this.state.activeNoteSlotKey = actionElement.dataset.slotKey;
        this.state.activeMealSlotKey = null;
        shouldRefresh = false;
      }

      if (action === 'hide-note-slot') {
        this.state.activeNoteSlotKey = null;
        shouldRefresh = false;
      }

      if (action === 'show-planned-meal-slot') {
        this.state.activeMealSlotKey = actionElement.dataset.slotKey;
        this.state.activeNoteSlotKey = null;
        this.state.editingPlannedMealId = null;
        this.state.planActionsOpen = false;
        shouldRefresh = false;
      }

      if (action === 'hide-planned-meal-slot') {
        this.state.activeMealSlotKey = null;
        shouldRefresh = false;
      }

      if (action === 'clear-all-data') {
        if (!window.confirm('Borrar todo eliminara despensa, recetas, planificacion y compra.')) {
          shouldRefresh = false;
        } else {
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
        }
      }

      if (action === 'resolve-meal') {
        await this.service.resolvePastMeal(id, actionElement.dataset.cooked === 'true');
        this.showToast('Comida pendiente resuelta.');
      }

      if (action === 'add-ingredient-row') {
        recipeSheetScrollTop = this.getRecipeSheetScrollTop();
        this.syncCreateRecipeForm(actionElement.closest('form'));
        this.state.ingredientRows.push(createIngredientRow());
        shouldRefresh = false;
      }

      if (action === 'remove-ingredient-row') {
        recipeSheetScrollTop = this.getRecipeSheetScrollTop();
        this.syncCreateRecipeForm(actionElement.closest('form'));
        this.state.ingredientRows = this.state.ingredientRows.filter((row) => row.id !== id);

        if (this.state.ingredientRows.length === 0) {
          this.state.ingredientRows.push(createIngredientRow());
        }
        shouldRefresh = false;
      }

      if (action === 'add-edit-ingredient-row') {
        recipeSheetScrollTop = this.getRecipeSheetScrollTop();
        this.syncEditIngredientRows(actionElement.closest('form'));
        this.state.editIngredientRows.push(createIngredientRow());
        shouldRefresh = false;
      }

      if (action === 'remove-edit-ingredient-row') {
        recipeSheetScrollTop = this.getRecipeSheetScrollTop();
        this.syncEditIngredientRows(actionElement.closest('form'));
        this.state.editIngredientRows = this.state.editIngredientRows.filter((row) => row.id !== id);

        if (this.state.editIngredientRows.length === 0) {
          this.state.editIngredientRows.push(createIngredientRow());
        }
        shouldRefresh = false;
      }

      if (shouldRefresh) {
        await this.refresh();
      } else {
        this.render();
      }

      if (recipeSheetScrollTop !== null) {
        this.restoreRecipeSheetScroll(recipeSheetScrollTop);
      }

      if (action === 'scroll-plan-day') {
        this.scrollToPlanDay(actionElement.dataset.date);
      }
    });
  }

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
  }

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
  }

  /**
   * Gestiona formularios de alta y planificacion.
   *
   * @param {SubmitEvent} event Evento de submit.
   * @returns {Promise<void>}
   */
  async handleSubmit(event) {
    event.preventDefault();

    const form = event.target;

    if (this.state.isBusy) {
      return;
    }

    await this.runSafely(async () => {
      if (form.matches('[data-form="pantry-item"]')) {
        const data = new FormData(form);
        await this.service.createPantryItem({
          name: data.get('name'),
          quantity: data.get('quantity'),
          unit: data.get('unit'),
        });
        form.reset();
        this.state.pantryFormOpen = false;
        this.showToast('Alimento anadido.');
      }

      if (form.matches('[data-form="pantry-stock"]')) {
        const data = new FormData(form);
        const stockAction = event.submitter?.dataset.stockAction ?? 'add';

        if (stockAction === 'subtract') {
          await this.service.subtractPantryItemQuantity(data.get('pantryItemId'), data.get('quantity'));
        } else {
          await this.service.addPantryItemQuantity(data.get('pantryItemId'), data.get('quantity'));
        }

        form.reset();
        this.showToast('Stock actualizado.');
      }

      if (form.matches('[data-form="pantry-item-edit"]')) {
        const data = new FormData(form);
        await this.service.updatePantryItem(data.get('pantryItemId'), {
          name: data.get('name'),
          quantity: data.get('quantity'),
          unit: data.get('unit'),
          recipeIngredientUpdates: this.readPantryRecipeUpdatesFromForm(data),
        });
        this.state.editingPantryItemId = null;
        this.showToast('Alimento actualizado.');
      }

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
      }

      if (form.matches('[data-form="recipe-edit"]')) {
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
      }

      if (form.matches('[data-form="plan-week"]')) {
        const data = new FormData(form);
        const mode = event.submitter?.dataset.planMode ?? 'reset';
        const result =
          mode === 'complete'
            ? await this.service.completeWeekPlan({ servings: data.get('servings') })
            : await this.service.planNextWeek({ servings: data.get('servings') });
        const skippedMessage =
          result.missingSlots.length > 0 ? ` ${result.missingSlots.length} huecos sin receta compatible.` : '';
        const createdMessage =
          mode === 'complete'
            ? `${result.plannedMeals.length} huecos completados.`
            : 'Semana planificada.';
        this.state.planActionsOpen = false;
        this.showToast(`${createdMessage}${skippedMessage}`);
      }

      if (form.matches('[data-form="planned-meal"]')) {
        const data = new FormData(form);
        if (data.get('noCook') === 'true') {
          await this.service.createPlannedNote({
            date: data.get('date'),
            mealType: data.get('mealType'),
            title: data.get('noCookTitle'),
            note: data.get('noCookNote'),
          });
        } else {
          await this.service.createPlannedMeal({
            date: data.get('date'),
            mealType: data.get('mealType'),
            recipeId: data.get('recipeId'),
            servings: data.get('servings'),
          });
        }
        this.state.activeMealSlotKey = null;
        this.state.activeNoteSlotKey = null;
        this.showToast(data.get('noCook') === 'true' ? 'Hueco marcado como no cocinar.' : 'Comida anadida al plan.');
      }

      if (form.matches('[data-form="planned-meal-edit"]')) {
        const data = new FormData(form);
        if (data.get('noCook') === 'true') {
          await this.service.convertPlannedMealToNote(data.get('plannedMealId'), {
            title: data.get('noCookTitle'),
            note: data.get('noCookNote'),
          });
        } else {
          await this.service.updatePlannedMeal(data.get('plannedMealId'), {
            recipeId: data.get('recipeId'),
            servings: data.get('servings'),
          });
        }
        this.state.editingPlannedMealId = null;
        this.showToast('Comida actualizada.');
      }

      if (form.matches('[data-form="planned-note"]')) {
        const data = new FormData(form);
        await this.service.createPlannedNote({
          date: data.get('date'),
          mealType: data.get('mealType'),
          title: data.get('title'),
          note: data.get('note'),
        });
        this.state.activeMealSlotKey = null;
        this.state.activeNoteSlotKey = null;
        this.showToast('Hueco marcado como no cocinar.');
      }

      if (form.matches('[data-form="planned-note-edit"]')) {
        const data = new FormData(form);
        await this.service.updatePlannedNote(data.get('plannedMealId'), {
          title: data.get('title'),
          note: data.get('note'),
        });
        this.state.editingPlannedMealId = null;
        this.showToast('No cocinar actualizado.');
      }

      if (form.matches('[data-form="import-backup"]')) {
        const file = form.elements.backupFile.files[0];

        if (!file) {
          throw new DomainError('Selecciona un archivo JSON para importar.', 'BACKUP_FILE_REQUIRED');
        }

        if (!window.confirm('Importar esta copia reemplazara los datos actuales.')) {
          return;
        }

        const summary = await this.service.importBackup(await file.text());
        form.reset();
        this.state.activeView = 'settings';
        this.state.settingsImportOpen = false;
        this.showToast(
          `Importados ${summary.pantryItems} alimentos, ${summary.recipes} recetas, ${summary.plannedMeals} comidas y ${summary.shoppingItems} compras.`,
        );
      }

      if (form.matches('[data-form="shopping-extra"]')) {
        const data = new FormData(form);
        await this.service.createShoppingExtra({
          name: data.get('name'),
          quantity: data.get('quantity'),
          unit: data.get('unit'),
        });
        form.reset();
        this.state.shoppingExtraFormOpen = false;
        this.showToast('Extra anadido a la compra.');
      }

      await this.refresh();
    });
  }

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

    const rowElement = event.target.closest('[data-ingredient-row]');

    if (rowElement) {
      const row = this.state.ingredientRows.find((ingredientRow) => ingredientRow.id === rowElement.dataset.ingredientRow);

      if (!row) {
        return;
      }

      if (event.target.matches('[name="ingredientItem"]')) {
        row.pantryItemId = event.target.value;
      }

      if (event.target.matches('[name="ingredientQuantity"]')) {
        row.quantity = event.target.value;
      }

      return;
    }

    const editRowElement = event.target.closest('[data-edit-ingredient-row]');

    if (!editRowElement) {
      return;
    }

    const editRow = this.state.editIngredientRows.find(
      (ingredientRow) => ingredientRow.id === editRowElement.dataset.editIngredientRow,
    );

    if (!editRow) {
      return;
    }

    if (event.target.matches('[name="ingredientItem"]')) {
      editRow.pantryItemId = event.target.value;
    }

    if (event.target.matches('[name="ingredientQuantity"]')) {
      editRow.quantity = event.target.value;
    }
  }

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
  }

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
  }

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
  }

  /**
   * Ejecuta una accion atrapando errores de dominio para mostrarlos como aviso.
   *
   * @param {() => Promise<void>} action Accion asyncrona.
   * @returns {Promise<void>}
   */
  async runSafely(action) {
    this.state.isBusy = true;

    try {
      await action();
    } catch (error) {
      if (error instanceof DomainError) {
        this.showToast(error.message, 'error');
        this.render();
        return;
      }

      console.error(error);
      this.showToast('Ha ocurrido un error inesperado.', 'error');
      this.render();
    } finally {
      this.state.isBusy = false;
    }
  }

  /**
   * Lee ingredientes desde FormData preservando las filas dinamicas.
   *
   * @param {FormData} data Datos del formulario.
   * @returns {import('../domain/types.js').RecipeIngredient[]} Ingredientes.
   */
  readIngredientsFromForm(data) {
    const itemIds = data.getAll('ingredientItem');
    const quantities = data.getAll('ingredientQuantity');

    return itemIds.map((pantryItemId, index) => ({
      pantryItemId,
      quantity: quantities[index],
    }));
  }

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
  }

  /**
   * Sincroniza el borrador de creacion de receta desde el formulario visible.
   *
   * @param {HTMLFormElement | null} form Formulario de creacion.
   */
  syncCreateRecipeForm(form) {
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    this.state.createRecipeDraft = {
      name: formData.get('name'),
      mealTypes: formData.getAll('mealTypes'),
    };
    this.state.ingredientRows = [...form.querySelectorAll('[data-ingredient-row]')].map((rowElement) => ({
      id: rowElement.dataset.ingredientRow,
      pantryItemId: rowElement.querySelector('[name="ingredientItem"]').value,
      quantity: rowElement.querySelector('[name="ingredientQuantity"]').value,
    }));
  }

  /**
   * Sincroniza filas de ingredientes de edicion desde el formulario visible.
   *
   * @param {HTMLFormElement | null} form Formulario de edicion.
   */
  syncEditIngredientRows(form) {
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    this.state.editRecipeDraft = {
      name: formData.get('name'),
      mealTypes: formData.getAll('mealTypes'),
    };
    this.state.editIngredientRows = [...form.querySelectorAll('[data-edit-ingredient-row]')].map((rowElement) => ({
      id: rowElement.dataset.editIngredientRow,
      pantryItemId: rowElement.querySelector('[name="ingredientItem"]').value,
      quantity: rowElement.querySelector('[name="ingredientQuantity"]').value,
    }));
  }

  /**
   * Obtiene el scroll interno de la modal de receta.
   *
   * @returns {number | null} Posicion vertical del contenido scrolleable.
   */
  getRecipeSheetScrollTop() {
    const scrollElement = this.root.querySelector('.recipe-edit-sheet-body');

    return scrollElement ? scrollElement.scrollTop : null;
  }

  /**
   * Restaura el scroll interno de la modal de receta tras renderizar.
   *
   * @param {number} scrollTop Posicion vertical previa.
   */
  restoreRecipeSheetScroll(scrollTop) {
    const scrollElement = this.root.querySelector('.recipe-edit-sheet-body');

    if (scrollElement) {
      scrollElement.scrollTop = scrollTop;
    }
  }

  /**
   * Guarda un mensaje temporal y programa su cierre automatico.
   *
   * @param {string} message Mensaje.
   * @param {'success' | 'error'} [type='success'] Tipo visual.
   */
  showToast(message, type = 'success') {
    this.clearToastTimeout();
    this.state.toast = {
      id: createUiId('toast'),
      message,
      type,
    };
    this.toastTimeoutId = window.setTimeout(() => {
      this.dismissToast();
    }, 4500);
  }

  /**
   * Cierra el aviso visible, si existe.
   */
  dismissToast() {
    this.clearToastTimeout();
    this.state.toast = null;
    this.render();
  }

  /**
   * Cancela el temporizador actual del aviso.
   */
  clearToastTimeout() {
    if (!this.toastTimeoutId) {
      return;
    }

    window.clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = null;
  }

  /**
   * Renderiza la vista seleccionada.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderActiveView(dashboard) {
    if (this.state.activeView === 'recipes') {
      return this.renderRecipesView(dashboard);
    }

    if (this.state.activeView === 'plan') {
      return this.renderPlanView(dashboard);
    }

    if (this.state.activeView === 'shopping') {
      return this.renderShoppingView(dashboard);
    }

    if (this.state.activeView === 'settings') {
      return this.renderSettingsView(dashboard);
    }

    return this.renderPantryView(dashboard);
  }

  /**
   * Renderiza el aviso de instalacion PWA cuando procede.
   *
   * @returns {string} HTML del aviso.
   */
  renderInstallPrompt() {
    const installPrompt = this.state.installPrompt;

    if (!this.state.installPromptVisible || !installPrompt?.shouldShowPrompt) {
      return '';
    }

    return `
      <section class="install-prompt-backdrop" role="presentation">
        ${this.renderInstallPromptCard()}
      </section>
    `;
  }

  /**
   * Renderiza la seccion estatica de instalacion en configuracion.
   *
   * @returns {string} HTML de la seccion o cadena vacia.
   */
  renderInstallSettingsPanel() {
    if (this.state.installPrompt?.isInstalled) {
      return `
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-row-icon">${this.renderIcon('done')}</span>
            <span class="settings-row-copy">
              <strong>App instalada</strong>
              <small>DespensApp ya se ejecuta como aplicacion instalada</small>
            </span>
          </div>
        </div>
      `;
    }

    const copy = getPwaInstallPromptCopy(this.state.installPrompt);

    return `
      <div class="settings-list">
        <div class="settings-disclosure ${this.state.settingsInstallOpen ? 'is-open' : ''}">
          <button
            class="settings-row settings-row-disclosure"
            type="button"
            data-action="toggle-settings-install"
            aria-expanded="${this.state.settingsInstallOpen}"
            aria-controls="settings-install-panel"
          >
            <span class="settings-row-icon">${this.renderIcon('import')}</span>
            <span class="settings-row-copy">
              <strong>Instalar App</strong>
              <small>Anadir a la pantalla de inicio</small>
            </span>
            <span class="settings-row-chevron">${this.renderIcon(this.state.settingsInstallOpen ? 'chevronDown' : 'chevronRight')}</span>
          </button>

          ${
            this.state.settingsInstallOpen
              ? `
                <div id="settings-install-panel" class="settings-disclosure-panel settings-install-panel">
                  <ol class="settings-install-steps">
                    ${copy.steps.map((step) => `<li>${step}</li>`).join('')}
                  </ol>
                  ${
                    this.state.installPrompt.canUseNativePrompt
                      ? `<button class="button small" type="button" data-action="install-app">${copy.nativeButtonLabel}</button>`
                      : ''
                  }
                </div>
              `
              : ''
          }
        </div>
      </div>
    `;
  }

  /**
   * Renderiza la tarjeta modal de instalacion PWA.
   *
   * @returns {string} HTML de la tarjeta.
   */
  renderInstallPromptCard() {
    const installPrompt = this.state.installPrompt;
    const copy = getPwaInstallPromptCopy(installPrompt);
    const actions = [
      installPrompt.canUseNativePrompt
        ? `<button class="button" type="button" data-action="install-app">${copy.nativeButtonLabel}</button>`
        : '',
      '<button class="button ghost" type="button" data-action="dismiss-install-prompt">Ahora no</button>',
    ].filter(Boolean);

    return `
      <div class="install-prompt" role="dialog" aria-modal="true" aria-labelledby="install-prompt-title">
        <div>
          <p class="eyebrow">Acceso directo</p>
          <h2 id="install-prompt-title">${copy.title}</h2>
        </div>
        <ol class="install-steps">
          ${copy.steps.map((step) => `<li>${step}</li>`).join('')}
        </ol>
        ${actions.length > 0 ? `<div class="install-actions">${actions.join('')}</div>` : ''}
      </div>
    `;
  }

  /**
   * Descarga un backup como archivo JSON.
   *
   * @param {import('../domain/types.js').PantryBackup} backup Backup exportado.
   */
  downloadBackup(backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const exportedDate = backup.exportedAt.slice(0, 10);

    link.href = url;
    link.download = `despensapp-backup-${exportedDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

Object.assign(
  PantryApp.prototype,
  commonRenderMethods,
  pantryViewMethods,
  recipeViewMethods,
  planViewMethods,
  shoppingViewMethods,
  settingsViewMethods,
);
