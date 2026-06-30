import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import { escapeHtml, formatDate } from '../renderUtils.js';
import { renderIcon } from './icons.js';

/**
 * Metodos de render para comidas pasadas pendientes de resolver.
 */
export const pendingMealsRenderMethods = {
  renderPendingMeals(dashboard) {
    if (dashboard.pendingMeals.length === 0) {
      return '';
    }

    return `
      <section class="notice-panel" aria-label="Comidas pendientes">
        <div>
          <p class="eyebrow">Pendiente</p>
          <h2>Confirmar comidas</h2>
          <p>¿Has cocinado estas comidas?</p>
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
        <div class="pending-card-copy">
          <span class="pending-date">${formatDate(meal.date)} · ${MEAL_TYPE_LABELS[meal.mealType]}</span>
          <strong>
            ${isNote ? escapeHtml(meal.title) : escapeHtml(recipe?.name ?? 'Receta eliminada')}
          </strong>
          <span>
            ${
              isNote
                ? (meal.note ? escapeHtml(meal.note) : 'Nota de plan')
                : `${meal.servings} raciones`
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
                  ${renderIcon('done')} Hecha
                </button>
                <button class="button ghost small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="false">
                  ${renderIcon('skipped')} No hecha
                </button>
              `
          }
        </div>
      </article>
    `;
  },
};
