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

    return `
      <div class="toast ${toast.type === 'error' ? 'is-error' : ''}" role="${role}" aria-live="${toast.type === 'error' ? 'assertive' : 'polite'}">
        <span>${escapeHtml(toast.message)}</span>
        <button class="toast-close" type="button" data-action="dismiss-toast" aria-label="Cerrar aviso">${renderIcon('close')}</button>
      </div>
    `;
  },

  renderEmptyState(text) {
    return `<p class="empty-state">${escapeHtml(text)}</p>`;
  },
};
