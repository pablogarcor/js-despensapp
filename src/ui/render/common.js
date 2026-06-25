import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import { escapeAttribute, escapeHtml, formatDate } from '../renderUtils.js';

/**
 * Metodos de render compartidos por varias vistas.
 */
export const commonRenderMethods = {
  renderTab(view, label) {
    const isActive = this.state.activeView === view;
    return `
      <button class="tab ${isActive ? 'is-active' : ''}" type="button" data-view="${view}" aria-pressed="${isActive}" ${isActive ? 'aria-current="page"' : ''}>
        ${label}
      </button>
    `;
  },

  renderPendingMeals(dashboard) {
    if (dashboard.pendingMeals.length === 0) {
      return '';
    }

    return `
      <section class="notice-panel" aria-label="Comidas pendientes">
        <div>
          <p class="eyebrow">Pendiente</p>
          <h2>Resuelve plan pasado</h2>
        </div>
        <div class="pending-list">
          ${dashboard.pendingMeals.map((meal) => this.renderPendingMeal(meal, dashboard)).join('')}
        </div>
      </section>
    `;
  },

  renderPendingMeal(meal, dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === meal.recipeId);
    const isNote = meal.kind === 'note';

    return `
      <article class="pending-card ${isNote ? 'note-pending-card' : ''}">
        <div>
          <strong>${formatDate(meal.date)} · ${MEAL_TYPE_LABELS[meal.mealType]}</strong>
          <span>
            ${
              isNote
                ? `${escapeHtml(meal.title)}${meal.note ? ` · ${escapeHtml(meal.note)}` : ''}`
                : `${escapeHtml(recipe?.name ?? 'Receta eliminada')} · ${meal.servings} raciones`
            }
          </span>
        </div>
        <div class="inline-actions">
          ${
            isNote
              ? `
                <button class="button small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="false">
                  Resolver
                </button>
              `
              : `
                <button class="button small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="true">
                  Hecha
                </button>
                <button class="button ghost small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="false">
                  No hecha
                </button>
              `
          }
        </div>
      </article>
    `;
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
        <button class="toast-close" type="button" data-action="dismiss-toast" aria-label="Cerrar aviso">x</button>
      </div>
    `;
  },

  renderSearchControl({ target, label, placeholder, value, visibleCount, totalCount }) {
    if (totalCount === 0) {
      return '';
    }

    const clearAction = target === 'pantry' ? 'clear-pantry-search' : 'clear-recipe-search';

    return `
      <div class="search-toolbar" role="search">
        <div class="search-row">
          <label>
            <span class="search-label-row">
              <span>${label}</span>
              <small>${visibleCount} de ${totalCount}</small>
            </span>
            <input
              type="search"
              data-search="${target}"
              autocomplete="off"
              placeholder="${escapeAttribute(placeholder)}"
              value="${escapeAttribute(value)}"
              aria-label="${escapeAttribute(label)}"
            />
          </label>
          ${
            value
              ? `<button class="search-clear" type="button" data-action="${clearAction}" aria-label="Limpiar busqueda">x</button>`
              : ''
          }
        </div>
      </div>
    `;
  },

  renderEmptyState(text) {
    return `<p class="empty-state">${text}</p>`;
  }
};
