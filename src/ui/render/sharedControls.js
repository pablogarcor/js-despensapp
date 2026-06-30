import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import { escapeAttribute, escapeHtml } from '../renderUtils.js';
import { renderIcon } from './icons.js';

const TAB_ICONS = Object.freeze({
  plan: 'weeklyPlan',
  pantry: 'pantry',
  recipes: 'recipes',
  shopping: 'shoppingList',
});

/**
 * Metodos compartidos para controles pequenos de navegacion y feedback.
 */
export const sharedControlRenderMethods = {
  renderFloatingActionButton({ action, label, icon = 'add', className = '' }) {
    return `
      <button
        class="floating-action-button ${escapeAttribute(className)}"
        type="button"
        data-action="${escapeAttribute(action)}"
        aria-label="${escapeAttribute(label)}"
      >
        ${renderIcon(icon)}
      </button>
    `;
  },

  renderIconActionButton({ action, id, label, icon, variant = 'neutral', className = '' }) {
    const buttonClass = variant === 'danger' ? 'icon-button' : 'meal-icon-action';

    return `
      <button
        class="${buttonClass} ${escapeAttribute(className)}"
        type="button"
        aria-label="${escapeAttribute(label)}"
        data-action="${escapeAttribute(action)}"
        data-id="${escapeAttribute(id)}"
      >
        ${renderIcon(icon)}
      </button>
    `;
  },

  renderEditDeleteActions({ id, editAction, deleteAction, editLabel, deleteLabel, className = '' }) {
    return `
      <div class="inline-actions ${escapeAttribute(className)}">
        ${this.renderIconActionButton({
          action: editAction,
          id,
          label: editLabel,
          icon: 'edit',
        })}
        ${this.renderIconActionButton({
          action: deleteAction,
          id,
          label: deleteLabel,
          icon: 'delete',
          variant: 'danger',
        })}
      </div>
    `;
  },

  renderTab(view, label) {
    const isActive = this.state.activeView === view;
    return `
      <button class="tab ${isActive ? 'is-active' : ''}" type="button" data-view="${view}" aria-pressed="${isActive}" ${isActive ? 'aria-current="page"' : ''}>
        ${renderIcon(TAB_ICONS[view] ?? 'calendar')}
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  },

  renderMealTypeBadge(mealType, extraClass = '') {
    return `<span class="meal-type-badge meal-type-${escapeAttribute(mealType)} ${escapeAttribute(extraClass)}">${escapeHtml(MEAL_TYPE_LABELS[mealType] ?? mealType)}</span>`;
  },

  renderToast() {
    if (!this.state.toast) {
      return '';
    }

    const toast = this.state.toast;
    const role = toast.type === 'error' ? 'alert' : 'status';
    const icon = getToastIcon(toast);
    const variant = getToastVariant(toast);
    const placement = isToastInModalContext(this.state) ? 'is-top' : 'is-bottom';
    const action = toast.undo ? 'undo-toast' : 'dismiss-toast';
    const actionLabel = toast.undo ? 'Deshacer' : 'Cerrar';

    return `
      <div class="toast ${escapeAttribute(`${variant} ${placement}`)}" role="${role}" aria-live="${toast.type === 'error' ? 'assertive' : 'polite'}">
        <span class="toast-content">
          <span class="toast-icon" aria-hidden="true">${renderIcon(icon)}</span>
          <span class="toast-message">${escapeHtml(toast.message)}</span>
        </span>
        <button class="toast-action" type="button" data-action="${escapeAttribute(action)}" aria-label="${escapeAttribute(actionLabel)} aviso">
          ${escapeHtml(actionLabel)}
        </button>
      </div>
    `;
  },

  renderEmptyState(text) {
    return `<p class="empty-state">${escapeHtml(text)}</p>`;
  },
};

/**
 * Elige el icono del snackbar segun el tipo y el mensaje.
 *
 * @param {{message: string, type: 'success' | 'error'}} toast Aviso actual.
 * @returns {string} Nombre de icono.
 */
function getToastIcon(toast) {
  if (toast.type === 'error') {
    return 'warning';
  }

  if (isDeleteToast(toast.message)) {
    return 'delete';
  }

  return 'check';
}

/**
 * Devuelve la variante visual del snackbar.
 *
 * @param {{message: string, type: 'success' | 'error'}} toast Aviso actual.
 * @returns {string} Clase variante.
 */
function getToastVariant(toast) {
  if (toast.type === 'error') {
    return 'is-error';
  }

  return isDeleteToast(toast.message) ? 'is-delete' : 'is-success';
}

/**
 * Detecta avisos de eliminacion para usar la segunda insignia de Stich.
 *
 * @param {string} message Mensaje visible.
 * @returns {boolean} True si el aviso representa una eliminacion.
 */
function isDeleteToast(message) {
  return /\b(eliminad|borrad|vaciar|vaciad)\w*/i.test(message);
}

/**
 * Detecta si un aviso debe aparecer por encima de una hoja modal abierta.
 *
 * @param {import('../PantryApp.js').PantryApp['state']} state Estado de UI.
 * @returns {boolean} True si hay una modal o hoja inferior activa.
 */
function isToastInModalContext(state) {
  return Boolean(
    state.planActionsOpen ||
      state.pendingMealsModalOpen ||
      state.pantryFormOpen ||
      state.recipeFormOpen ||
      state.shoppingExtraFormOpen ||
      state.installPromptVisible ||
      state.activeMealSlotKey ||
      state.editingPantryItemId ||
      state.deletingPantryItemId ||
      state.editingRecipeId ||
      state.viewingRecipeId ||
      state.deletingRecipeId ||
      state.editingPlannedMealId,
  );
}
