import { addDays, toISODate } from '../../domain/planning.js';
import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import { escapeAttribute, escapeHtml, formatDate } from '../renderUtils.js';
import { renderIcon } from './icons.js';

/**
 * Metodos de render para comidas pasadas pendientes de resolver.
 */
export const pendingMealsRenderMethods = {
  renderPendingMeals(dashboard) {
    if (!this.state.pendingMealsModalOpen || dashboard.pendingMeals.length === 0) {
      return '';
    }

    return this.renderActionSheet({
      title: 'Confirmar comidas',
      titleId: 'pending-meals-title',
      dismissAction: 'hide-pending-meals',
      className: 'pending-meals-sheet',
      visibleTitle: true,
      body: `
        <div class="pending-meals-body">
          <p class="pending-meals-question">¿Has cocinado estas comidas?</p>
          <div class="pending-meals-info">
            <span aria-hidden="true">${renderIcon('info')}</span>
            <p>Al confirmar que has cocinado, los ingredientes se restaran automaticamente de tu despensa.</p>
          </div>
          <div class="pending-list">
            ${dashboard.pendingMeals.map((meal) => this.renderPendingMeal(meal, dashboard)).join('')}
          </div>
        </div>
      `,
      footer: `
        <div class="pending-meals-footer">
          <button class="pending-meals-skip" type="button" data-action="hide-pending-meals">
            Omitir por ahora
          </button>
        </div>
      `,
    });
  },

  renderPendingMeal(meal, dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === meal.recipeId);
    const isNote = meal.kind === 'note';
    const title = isNote ? meal.title : recipe?.name ?? 'Receta eliminada';

    return `
      <article class="pending-card ${isNote ? 'note-pending-card' : ''}">
        <span class="pending-date meal-type-${escapeAttribute(meal.mealType)}">
          ${escapeHtml(formatPendingMealDateLabel(meal.date))} · ${escapeHtml(MEAL_TYPE_LABELS[meal.mealType])}
        </span>
        <div class="pending-card-main">
          <span class="pending-card-icon" aria-hidden="true">${renderIcon('utensils')}</span>
          <div class="pending-card-copy">
            <strong>${escapeHtml(title)}</strong>
          </div>
        </div>
        <div class="pending-meal-actions">
          ${
            isNote
              ? `
                <button class="button pending-note-button" type="button" data-action="resolve-meal" data-id="${escapeAttribute(meal.id)}" data-cooked="false">
                  ${renderIcon('noUtensils')} Resolver
                </button>
              `
              : `
                <button class="button pending-cooked-button" type="button" data-action="resolve-meal" data-id="${escapeAttribute(meal.id)}" data-cooked="true">
                  ${renderIcon('done')} Sí, cocinado
                </button>
                <button class="button ghost pending-skipped-button" type="button" data-action="resolve-meal" data-id="${escapeAttribute(meal.id)}" data-cooked="false">
                  ${renderIcon('close')} No cocinado
                </button>
              `
          }
        </div>
      </article>
    `;
  },
};

/**
 * Formatea una fecha pendiente usando etiquetas relativas simples.
 *
 * @param {string} isoDate Fecha YYYY-MM-DD.
 * @returns {string} Etiqueta visible.
 */
function formatPendingMealDateLabel(isoDate) {
  const today = new Date();
  const todayIsoDate = toISODate(today);
  const yesterdayIsoDate = toISODate(addDays(today, -1));

  if (isoDate === todayIsoDate) {
    return 'Hoy';
  }

  if (isoDate === yesterdayIsoDate) {
    return 'Ayer';
  }

  return formatDate(isoDate);
}
