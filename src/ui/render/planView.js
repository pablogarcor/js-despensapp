import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import { escapeAttribute, escapeHtml, formatDate, formatQuantity, getPlanDaySummaries } from '../renderUtils.js';

/**
 * Metodos de render de planificacion, lista de compra y comidas.
 */
export const planViewMethods = {
  renderPlanView(dashboard) {
    const isActionsOpen = this.state.planActionsOpen;

    return `
      <section class="panel action-panel plan-toolbar ${isActionsOpen ? '' : 'is-collapsed'}">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Siguiente semana</p>
            <h2>Planificacion</h2>
          </div>
          <button class="button ghost small" type="button" data-action="${isActionsOpen ? 'hide-plan-actions' : 'show-plan-actions'}">
            ${isActionsOpen ? 'Ocultar' : 'Acciones'}
          </button>
        </div>

        ${this.renderPlanDayStrip(dashboard)}

        ${
          isActionsOpen
            ? `
              <form class="plan-actions" data-form="plan-week">
                <label>
                  Raciones por comida
                  <input name="servings" type="number" inputmode="decimal" min="0.5" step="0.5" value="1" required />
                </label>
                <button class="button" type="submit" data-plan-mode="reset">Planificar semana</button>
                <button class="button ghost" type="submit" data-plan-mode="complete">Completar huecos</button>
                <button class="button ghost" type="button" data-action="clear-plan">Vaciar plan</button>
              </form>
            `
            : ''
        }
      </section>

      ${this.renderShoppingList(dashboard)}

      <section class="list-section" aria-label="Comidas planificadas">
        ${
          dashboard.plannedMeals.length === 0 && dashboard.missingPlanSlots.length === 0
            ? this.renderEmptyState('Aun no hay comidas planificadas.')
            : ''
        }
        ${this.renderPlanGroups(dashboard)}
      </section>
    `;
  },

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

  renderShoppingList(dashboard) {
    if (dashboard.plannedMeals.length === 0) {
      return '';
    }

    const hasMissingFood = dashboard.shoppingList.length > 0;
    const statusText = hasMissingFood
      ? `${dashboard.shoppingList.length} alimentos pendientes`
      : 'Plan cubierto';
    const affectedText =
      dashboard.unavailableMeals.length > 0
        ? `${dashboard.unavailableMeals.length} comidas afectadas`
        : 'Sin comidas afectadas';

    return `
      <details class="status-panel shopping-dropdown ${hasMissingFood ? '' : 'ok'}">
        <summary class="shopping-summary">
          <span>
            <strong>Lista de la compra</strong>
            <small>${statusText} · ${affectedText}</small>
          </span>
          <span class="shopping-badge ${hasMissingFood ? 'is-warning' : 'is-ok'}">
            ${hasMissingFood ? 'Falta compra' : 'Suficiente'}
          </span>
        </summary>
        <div class="shopping-dropdown-content">
          ${hasMissingFood ? this.renderShoppingItems(dashboard) : '<p class="shopping-ok-text">Tienes alimentos suficientes para el plan actual.</p>'}
          ${this.renderUnavailableMeals(dashboard)}
        </div>
      </details>
    `;
  },

  renderShoppingItems(dashboard) {
    return `
      <ul class="shopping-list">
        ${dashboard.shoppingList.map((item) => `
          <li>
            <span>${escapeHtml(item.name)}</span>
            <strong>${formatQuantity(item.missingQuantity)} ${escapeHtml(item.unit)}</strong>
          </li>
        `).join('')}
      </ul>
    `;
  },

  renderUnavailableMeals(dashboard) {
    if (dashboard.unavailableMeals.length === 0) {
      return '';
    }

    return `
      <div class="unavailable-meals" aria-label="Comidas afectadas por falta de alimentos">
        <h4>Comidas afectadas</h4>
        ${dashboard.unavailableMeals.map((meal) => `
          <article class="unavailable-meal">
            <div>
              <strong>${escapeHtml(meal.recipeName)}</strong>
              <span>${formatDate(meal.date)} · ${MEAL_TYPE_LABELS[meal.mealType]} · ${formatQuantity(meal.servings)} raciones</span>
            </div>
            <ul>
              ${meal.missingIngredients.map((ingredient) => `
                <li>${escapeHtml(ingredient.name)}: faltan ${formatQuantity(ingredient.missingQuantity)} ${escapeHtml(ingredient.unit)}</li>
              `).join('')}
            </ul>
          </article>
        `).join('')}
      </div>
    `;
  },

  renderPlanGroups(dashboard) {
    if (dashboard.plannedMeals.length === 0 && dashboard.missingPlanSlots.length === 0) {
      return '';
    }

    const groups = new Map();

    for (const meal of dashboard.plannedMeals) {
      if (!groups.has(meal.date)) {
        groups.set(meal.date, []);
      }

      groups.get(meal.date).push(meal);
    }

    for (const slot of dashboard.missingPlanSlots) {
      if (!groups.has(slot.date)) {
        groups.set(slot.date, []);
      }
    }

    return [...groups.entries()]
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([date, meals]) => `
        <section class="day-group" id="plan-day-${escapeAttribute(date)}" data-plan-day="${escapeAttribute(date)}">
          <h3>${formatDate(date)}</h3>
          ${meals.map((meal) => this.renderPlannedMeal(meal, dashboard.recipes, dashboard.unavailableMeals)).join('')}
          ${dashboard.missingPlanSlots
            .filter((slot) => slot.date === date)
            .map((slot) => this.renderMissingMealSlot(slot, dashboard.recipes))
            .join('')}
        </section>
      `)
      .join('');
  },

  renderPlannedMeal(meal, recipes, unavailableMeals) {
    if (this.state.editingPlannedMealId === meal.id) {
      return this.renderPlannedMealEditForm(meal, recipes);
    }

    const recipe = recipes.find((candidate) => candidate.id === meal.recipeId);
    const unavailableMeal = unavailableMeals.find((candidate) => candidate.plannedMealId === meal.id);
    const missingIngredientNames = unavailableMeal?.missingIngredients
      .map((ingredient) => ingredient.name)
      .join(', ');

    return `
      <article class="meal-card ${unavailableMeal ? 'is-unavailable' : ''}">
        <div>
          <span>${MEAL_TYPE_LABELS[meal.mealType]}</span>
          <strong>${escapeHtml(recipe?.name ?? 'Receta eliminada')}</strong>
          <small>${meal.servings} raciones</small>
          ${
            unavailableMeal
              ? `<small class="meal-shortage">Faltan: ${escapeHtml(missingIngredientNames)}</small>`
              : ''
          }
        </div>
        ${unavailableMeal ? '<span class="meal-status-badge">Faltan alimentos</span>' : ''}
        <div class="inline-actions">
          <button class="button ghost small" type="button" data-action="edit-planned-meal" data-id="${meal.id}">
            Editar
          </button>
          <button class="icon-button" type="button" aria-label="Eliminar comida" data-action="delete-planned-meal" data-id="${meal.id}">
            x
          </button>
        </div>
      </article>
    `;
  },

  renderPlannedMealEditForm(meal, recipes) {
    const compatibleRecipes = recipes.filter((recipe) => recipe.mealTypes.includes(meal.mealType));

    return `
      <form class="meal-card meal-edit-card" data-form="planned-meal-edit">
        <input type="hidden" name="plannedMealId" value="${escapeAttribute(meal.id)}" />
        <p class="meal-edit-date">${formatDate(meal.date)} · ${MEAL_TYPE_LABELS[meal.mealType]}</p>
        <label>
          Receta
          <select name="recipeId" required>
            ${compatibleRecipes.map((recipe) => `
              <option value="${escapeAttribute(recipe.id)}" ${meal.recipeId === recipe.id ? 'selected' : ''}>
                ${escapeHtml(recipe.name)}
              </option>
            `).join('')}
          </select>
        </label>
        <label>
          Raciones
          <input name="servings" type="number" inputmode="decimal" min="0.5" step="0.5" value="${meal.servings}" required />
        </label>
        <div class="form-actions">
          <button class="button small" type="submit">Guardar</button>
          <button class="button ghost small" type="button" data-action="cancel-edit-planned-meal">Cancelar</button>
        </div>
      </form>
    `;
  },

  renderMissingMealSlot(slot, recipes) {
    const compatibleRecipes = recipes.filter((recipe) => recipe.mealTypes.includes(slot.mealType));

    if (compatibleRecipes.length === 0) {
      return `
        <article class="missing-meal-card">
          <div>
            <span>${MEAL_TYPE_LABELS[slot.mealType]}</span>
            <strong>Sin receta compatible</strong>
          </div>
        </article>
      `;
    }

    return `
      <form class="missing-meal-card" data-form="planned-meal">
        <input type="hidden" name="date" value="${escapeAttribute(slot.date)}" />
        <input type="hidden" name="mealType" value="${escapeAttribute(slot.mealType)}" />
        <label>
          ${MEAL_TYPE_LABELS[slot.mealType]}
          <select name="recipeId" required>
            ${compatibleRecipes.map((recipe) => `
              <option value="${escapeAttribute(recipe.id)}">${escapeHtml(recipe.name)}</option>
            `).join('')}
          </select>
        </label>
        <label>
          Raciones
          <input name="servings" type="number" inputmode="decimal" min="0.5" step="0.5" value="1" required />
        </label>
        <button class="button small" type="submit">Añadir</button>
      </form>
    `;
  }
};
