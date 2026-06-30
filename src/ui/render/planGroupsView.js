import { toISODate } from '../../domain/planning.js';
import { MEAL_TYPE_LABELS, MEAL_TYPES, PLAN_NOTE_TITLES } from '../../domain/types.js';
import { escapeAttribute, escapeHtml, formatDate, getPlanDaySummaries } from '../renderUtils.js';
import { getPlanSlotKey } from './planSlotKeys.js';

/**
 * Metodos de render para dias, huecos y tarjetas de comidas planificadas.
 */
export const planGroupRenderMethods = {
  renderPlanDayStrip(dashboard) {
    const days = getPlanDaySummaries(dashboard);

    if (days.length === 0) {
      return '';
    }

    return `
      <nav class="plan-day-strip" aria-label="Dias del plan">
        ${days.map((day) => `
          <button
            class="plan-day-chip ${day.statusClass} ${this.state.selectedPlanDate === day.date ? 'is-selected' : ''}"
            type="button"
            data-action="scroll-plan-day"
            data-date="${escapeAttribute(day.date)}"
            aria-label="Ir a ${escapeAttribute(day.longLabel)}"
          >
            <span>${escapeHtml(day.weekday)}</span>
            <strong>${escapeHtml(day.dayNumber)}</strong>
          </button>
        `).join('')}
      </nav>
    `;
  },

  renderPlanGroups(dashboard) {
    if (dashboard.plannedMeals.length === 0 && dashboard.missingPlanSlots.length === 0) {
      return '';
    }

    const groups = new Map();

    for (const meal of dashboard.plannedMeals) {
      if (!groups.has(meal.date)) {
        groups.set(meal.date, { meals: [], missingSlots: [] });
      }

      groups.get(meal.date).meals.push(meal);
    }

    for (const slot of dashboard.missingPlanSlots) {
      if (!groups.has(slot.date)) {
        groups.set(slot.date, { meals: [], missingSlots: [] });
      }

      groups.get(slot.date).missingSlots.push(slot);
    }

    return [...groups.entries()]
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([date, group]) => `
        <section class="day-group" id="plan-day-${escapeAttribute(date)}" data-plan-day="${escapeAttribute(date)}">
          <div class="day-group-header">
            <h3>${formatDate(date)}</h3>
            ${date === toISODate(new Date()) ? '<span>Hoy</span>' : ''}
          </div>
          <div class="plan-slot-list">
            ${MEAL_TYPES.map((mealType) => {
              const meal = group.meals.find((candidate) => candidate.mealType === mealType);
              const slot = group.missingSlots.find((candidate) => candidate.mealType === mealType);

              if (meal) {
                return this.renderPlannedMeal(meal, dashboard.recipes, dashboard.unavailableMeals);
              }

              if (slot) {
                return this.renderMissingMealSlot(slot);
              }

              return '';
            }).join('')}
          </div>
        </section>
      `)
      .join('');
  },

  renderPlannedMeal(meal, recipes, unavailableMeals) {
    if (meal.kind === 'note') {
      return this.renderPlannedNote(meal);
    }

    const recipe = recipes.find((candidate) => candidate.id === meal.recipeId);
    const unavailableMeal = unavailableMeals.find((candidate) => candidate.plannedMealId === meal.id);

    return `
      <article class="meal-card ${unavailableMeal ? 'is-unavailable' : ''}">
        ${this.renderMealTypeBadge(meal.mealType)}
        <div class="meal-card-copy">
          <strong>${escapeHtml(recipe?.name ?? 'Receta eliminada')}</strong>
          ${unavailableMeal ? '<small class="meal-shortage">Faltan alimentos</small>' : ''}
        </div>
        <span class="meal-row-icon" aria-label="Se cocina">${this.renderIcon('utensils')}</span>
        ${this.renderEditDeleteActions({
          id: meal.id,
          editAction: 'edit-planned-meal',
          deleteAction: 'delete-planned-meal',
          editLabel: 'Editar comida',
          deleteLabel: 'Eliminar comida',
        })}
      </article>
    `;
  },

  renderPlannedNote(meal) {
    return `
      <article class="meal-card note-meal-card">
        ${this.renderMealTypeBadge(meal.mealType)}
        <div class="meal-card-copy">
          <strong>${escapeHtml(meal.title)}</strong>
        </div>
        <span class="meal-row-icon no-cook-icon" aria-label="No se cocina">${this.renderIcon('noUtensils')}</span>
        ${this.renderEditDeleteActions({
          id: meal.id,
          editAction: 'edit-planned-meal',
          deleteAction: 'delete-planned-meal',
          editLabel: 'Editar no cocinar',
          deleteLabel: 'Eliminar no cocinar',
        })}
      </article>
    `;
  },

  renderMissingMealSlot(slot) {
    const slotKey = getPlanSlotKey(slot);

    if (this.state.activeNoteSlotKey === slotKey) {
      return this.renderPlannedNoteForm(slot, slotKey);
    }

    return this.renderEmptyMealSlot(slot, slotKey);
  },

  renderEmptyMealSlot(slot, slotKey) {
    return `
      <article class="empty-meal-slot">
        ${this.renderMealTypeBadge(slot.mealType)}
        <button
          class="empty-meal-add"
          type="button"
          data-action="show-planned-meal-slot"
          data-slot-key="${escapeAttribute(slotKey)}"
          aria-label="Planificar ${MEAL_TYPE_LABELS[slot.mealType]}"
        >
          ${this.renderIcon('add')}
        </button>
      </article>
    `;
  },

  renderPlannedNoteForm(slot, slotKey) {
    return `
      <form class="missing-meal-card note-meal-form" data-form="planned-note">
        <input type="hidden" name="date" value="${escapeAttribute(slot.date)}" />
        <input type="hidden" name="mealType" value="${escapeAttribute(slot.mealType)}" />
        ${this.renderMealTypeBadge(slot.mealType)}
        <label>
          Motivo
          <select name="title" required>
            ${PLAN_NOTE_TITLES.map((title) => `
              <option value="${escapeAttribute(title)}">${escapeHtml(title)}</option>
            `).join('')}
          </select>
        </label>
        <label>
          Detalle
          <input name="note" type="text" autocomplete="off" placeholder="Ej. cena fuera" />
        </label>
        <button class="button small" type="submit">${this.renderIcon('save')} Guardar</button>
        <button class="button ghost small" type="button" data-action="hide-note-slot" data-slot-key="${escapeAttribute(slotKey)}">
          Cancelar
        </button>
      </form>
    `;
  },
};
