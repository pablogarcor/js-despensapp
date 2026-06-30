import { DomainError } from '../domain/errors.js';
import { toISODate } from '../domain/planning.js';
import { actionSheetDragMethods } from './events/actionSheetDrag.js';
import { clickActionMethods } from './events/clickActions.js';
import { formSubmitMethods } from './events/formSubmit.js';
import { inputEventMethods } from './events/inputEvents.js';
import { recipeFormStateMethods } from './events/recipeFormState.js';
import { commonRenderMethods } from './render/common.js';
import { installPromptViewMethods } from './render/installPromptView.js';
import { pantryViewMethods } from './render/pantryView.js';
import { planViewMethods } from './render/planView.js';
import { recipeViewMethods } from './render/recipeView.js';
import { settingsViewMethods } from './render/settingsView.js';
import { shoppingViewMethods } from './render/shoppingView.js';
import { createIngredientRow, createUiId } from './uiState.js';
import {
  getPwaInstallPromptState,
  watchPwaInstallPrompt,
} from '../pwa/installPrompt.js';

const APP_ICON_URL = `${import.meta.env.BASE_URL}icons/despensapp-icon.svg`;
const PENDING_MEALS_OMITTED_DATE_STORAGE_KEY = 'despensapp.pendingMealsOmittedDate';

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
    this.actionSheetDrag = null;
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
      pendingMealsModalOpen: false,
      pendingMealsOmittedDate: readPendingMealsOmittedDate(),
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
    this.root.addEventListener('pointerdown', (event) => this.handleActionSheetPointerDown(event));
    this.root.addEventListener('pointermove', (event) => this.handleActionSheetPointerMove(event));
    this.root.addEventListener('pointerup', (event) => this.handleActionSheetPointerUp(event));
    this.root.addEventListener('pointercancel', (event) => this.handleActionSheetPointerCancel(event));
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

    this.syncPendingMealsModalState(dashboard);

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <img class="app-header-logo" src="${APP_ICON_URL}" alt="" aria-hidden="true" />
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
   * Guarda un mensaje temporal y programa su cierre automatico.
   *
   * @param {string} message Mensaje.
   * @param {'success' | 'error'} [type='success'] Tipo visual.
   * @param {{undo?: {kind: string, payload: unknown}}} [options] Opciones del aviso.
   */
  showToast(message, type = 'success', options = {}) {
    this.clearToastTimeout();
    this.state.toast = {
      id: createUiId('toast'),
      message,
      type,
      undo: options.undo ?? null,
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
   * Abre automaticamente la confirmacion de comidas al entrar en Plan.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   */
  syncPendingMealsModalState(dashboard) {
    if (dashboard.pendingMeals.length === 0 || this.state.activeView !== 'plan') {
      this.state.pendingMealsModalOpen = false;
      return;
    }

    if (this.state.pendingMealsModalOpen) {
      return;
    }

    if (this.state.pendingMealsOmittedDate !== toISODate(new Date())) {
      this.openPendingMealsModal();
    }
  }

  /**
   * Muestra la modal de confirmacion cerrando otras hojas del plan.
   */
  openPendingMealsModal() {
    this.state.pendingMealsModalOpen = true;
    this.state.planActionsOpen = false;
    this.state.activeMealSlotKey = null;
    this.state.activeNoteSlotKey = null;
    this.state.editingPlannedMealId = null;
  }

  /**
   * Omite la confirmacion de comidas hasta el siguiente dia natural.
   */
  omitPendingMealsForToday() {
    const today = toISODate(new Date());

    this.state.pendingMealsOmittedDate = today;
    this.state.pendingMealsModalOpen = false;
    writePendingMealsOmittedDate(today);
  }

  /**
   * Ejecuta la operacion inversa guardada en un snackbar.
   *
   * @param {{kind: string, payload: unknown}} undo Operacion a revertir.
   * @returns {Promise<void>}
   */
  async applyToastUndo(undo) {
    if (undo.kind === 'created-pantry-item') {
      await this.service.deletePantryItem(undo.payload.id);
      return;
    }

    if (undo.kind === 'deleted-pantry-item') {
      await this.service.restorePantryItem(undo.payload);
      return;
    }

    if (undo.kind === 'created-recipe') {
      await this.service.deleteRecipe(undo.payload.id);
      return;
    }

    if (undo.kind === 'deleted-recipe') {
      await this.service.restoreRecipe(undo.payload);
      return;
    }

    throw new Error(`Accion de deshacer no soportada: ${undo.kind}`);
  }
}

/**
 * Lee la fecha en la que el usuario omitio la confirmacion de comidas.
 *
 * @returns {string} Fecha ISO corta guardada, si existe.
 */
function readPendingMealsOmittedDate() {
  try {
    return globalThis.localStorage?.getItem(PENDING_MEALS_OMITTED_DATE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Persiste la fecha en la que se omite la confirmacion de comidas.
 *
 * @param {string} isoDate Fecha YYYY-MM-DD.
 */
function writePendingMealsOmittedDate(isoDate) {
  try {
    globalThis.localStorage?.setItem(PENDING_MEALS_OMITTED_DATE_STORAGE_KEY, isoDate);
  } catch {
    // La omision diaria es una mejora de UX; la app puede continuar sin almacenamiento.
  }
}

Object.assign(
  PantryApp.prototype,
  actionSheetDragMethods,
  clickActionMethods,
  formSubmitMethods,
  inputEventMethods,
  recipeFormStateMethods,
  commonRenderMethods,
  installPromptViewMethods,
  pantryViewMethods,
  recipeViewMethods,
  planViewMethods,
  shoppingViewMethods,
  settingsViewMethods,
);
