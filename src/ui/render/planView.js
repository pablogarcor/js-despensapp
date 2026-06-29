import { fromISODate, toISODate } from '../../domain/planning.js';
import { MEAL_TYPE_LABELS, MEAL_TYPES, PLAN_NOTE_TITLES } from '../../domain/types.js';
import { escapeAttribute, escapeHtml, formatDate, getPlanDaySummaries } from '../renderUtils.js';

/**
 * Metodos de render de planificacion, lista de compra y comidas.
 */
export const planViewMethods = {
  renderPlanView(dashboard) {
    const isActionsOpen = this.state.planActionsOpen;
    const days = getPlanDaySummaries(dashboard);
    const planRange = formatPlanRange(days);

    return `
      <section class="panel action-panel plan-toolbar">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Siguiente semana</p>
            <h3>Huecos del plan</h3>
          </div>
        </div>

        ${this.renderPlanDayStrip(dashboard)}
      </section>

      ${isActionsOpen ? this.renderPlanActionsSheet() : ''}
      ${
        isActionsOpen
          ? ''
          : `<button class="recipe-fab plan-fab" type="button" data-action="show-plan-actions" aria-label="Acciones del plan">
              ${this.renderIcon('action')}
            </button>`
      }
      ${this.renderPlannedMealSheet(dashboard)}

      ${this.renderShoppingPlanSummary(dashboard)}

      <section class="plan-list-heading">
        <h2>Plan Semanal</h2>
        ${planRange ? `<span class="plan-range">${planRange}</span>` : ''}
      </section>

      <section class="list-section" aria-label="Comidas planificadas">
        ${
          dashboard.plannedMeals.length === 0 && dashboard.missingPlanSlots.length === 0
            ? this.renderEmptyState('Aun no hay planificacion.')
            : ''
        }
        ${this.renderPlanGroups(dashboard)}
      </section>
    `;
  },

  renderPlanActionsSheet() {
    return this.renderActionSheet({
      title: 'Acciones del plan',
      titleId: 'plan-actions-title',
      dismissAction: 'hide-plan-actions',
      form: {
        className: 'action-sheet-form',
        dataForm: 'plan-week',
        hiddenInputs: [{ name: 'servings', value: '1' }],
      },
      actions: [
        {
          label: 'Planificar semana',
          icon: 'weeklyPlan',
          type: 'submit',
          variant: 'primary',
          data: { planMode: 'reset' },
        },
        {
          label: 'Completar huecos',
          icon: 'autoFill',
          type: 'submit',
          data: { planMode: 'complete' },
        },
        {
          label: 'Vaciar plan',
          icon: 'delete',
          action: 'clear-plan',
          variant: 'danger',
        },
        {
          label: 'Ocultar acciones',
          icon: 'chevronDown',
          action: 'hide-plan-actions',
          separated: true,
        },
      ],
    });
  },

  renderPlannedMealSheet(dashboard) {
    const editingMeal = dashboard.plannedMeals.find((candidate) => candidate.id === this.state.editingPlannedMealId);

    if (editingMeal?.kind === 'note') {
      return this.renderPlannedNoteEditor(editingMeal);
    }

    if (editingMeal && editingMeal.kind !== 'note') {
      const recipe = dashboard.recipes.find((candidate) => candidate.id === editingMeal.recipeId);

      return this.renderPlannedMealEditor({
        title: 'Editar comida',
        titleId: 'edit-planned-meal-title',
        dismissAction: 'cancel-edit-planned-meal',
        dataForm: 'planned-meal-edit',
        hiddenInputs: [
          { name: 'plannedMealId', value: editingMeal.id },
          { name: 'recipeId', value: editingMeal.recipeId },
        ],
        recipeField: this.renderSelectedRecipeField(recipe?.name ?? 'Receta eliminada'),
        servings: editingMeal.servings,
        submitLabel: 'Guardar cambios',
      });
    }

    const slot = dashboard.missingPlanSlots.find((candidate) => getSlotKey(candidate) === this.state.activeMealSlotKey);

    if (!slot) {
      return '';
    }

    const compatibleRecipes = dashboard.recipes.filter((recipe) => recipe.mealTypes.includes(slot.mealType));
    const noRecipeAvailable = compatibleRecipes.length === 0;

    return this.renderPlannedMealEditor({
      title: 'Añadir comida',
      titleId: 'add-planned-meal-title',
      dismissAction: 'hide-planned-meal-slot',
      dataForm: 'planned-meal',
      hiddenInputs: [
        { name: 'date', value: slot.date },
        { name: 'mealType', value: slot.mealType },
        ...(noRecipeAvailable ? [{ name: 'noCook', value: 'true' }] : []),
      ],
      recipeField: this.renderRecipeSelectField(compatibleRecipes),
      servings: 1,
      submitLabel: 'Añadir comida',
      noCookChecked: noRecipeAvailable,
      noCookDisabled: noRecipeAvailable,
    });
  },

  renderPlannedNoteEditor(meal) {
    return this.renderActionSheet({
      title: 'Editar comida',
      titleId: 'edit-planned-note-title',
      dismissAction: 'cancel-edit-planned-meal',
      className: 'meal-edit-sheet',
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form',
        dataForm: 'planned-note-edit',
        hiddenInputs: [{ name: 'plannedMealId', value: meal.id }],
      },
      body: `
        <div class="meal-edit-sheet-body">
          <div class="meal-edit-recipe-context">
            <span class="meal-edit-recipe-icon meal-edit-no-cook-context-icon" aria-hidden="true">${this.renderIcon('noUtensils')}</span>
            <div class="meal-edit-recipe-copy">
              <span>No cocinar seleccionado</span>
              <strong>${escapeHtml(meal.title)}</strong>
              ${meal.note ? `<small>${escapeHtml(meal.note)}</small>` : ''}
            </div>
          </div>

          <label class="meal-edit-field">
            <span>Motivo</span>
            <select name="title" required>
              ${PLAN_NOTE_TITLES.map((title) => `
                <option value="${escapeAttribute(title)}" ${meal.title === title ? 'selected' : ''}>
                  ${escapeHtml(title)}
                </option>
              `).join('')}
            </select>
          </label>

          <label class="meal-edit-field">
            <span>Detalle</span>
            <input name="note" type="text" autocomplete="off" value="${escapeAttribute(meal.note ?? '')}" />
          </label>

          <label class="meal-edit-no-cook">
            <span class="meal-edit-no-cook-icon" aria-hidden="true">${this.renderIcon('noUtensils')}</span>
            <span class="meal-edit-no-cook-copy">
              <strong>No cocinar esta vez</strong>
              <small>Comer fuera o sobras</small>
            </span>
            <input type="checkbox" value="true" checked disabled />
            <span class="meal-edit-switch" aria-hidden="true"></span>
          </label>
        </div>
      `,
      footer: `
        <div class="meal-edit-sheet-actions">
          <button class="button full" type="submit">Guardar cambios</button>
          <button class="meal-edit-cancel" type="button" data-action="cancel-edit-planned-meal">Cancelar</button>
        </div>
      `,
    });
  },

  renderPlannedMealEditor({
    title,
    titleId,
    dismissAction,
    dataForm,
    hiddenInputs,
    recipeField,
    servings,
    submitLabel,
    noCookChecked = false,
    noCookDisabled = false,
  }) {
    const servingsInputId = `${titleId}-servings`;

    return this.renderActionSheet({
      title,
      titleId,
      dismissAction,
      className: 'meal-edit-sheet',
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form',
        dataForm,
        hiddenInputs: [
          ...hiddenInputs,
          { name: 'noCookTitle', value: 'Comer fuera' },
          { name: 'noCookNote', value: 'Sobras' },
        ],
      },
      body: `
        <div class="meal-edit-sheet-body">
          <div class="meal-edit-recipe-context">
            <span class="meal-edit-recipe-icon" aria-hidden="true">${this.renderIcon('utensils')}</span>
            ${recipeField}
          </div>

          <label class="meal-edit-servings" for="${escapeAttribute(servingsInputId)}">
            <span>Raciones a cocinar</span>
          </label>
          <div class="meal-servings-stepper">
            <button
              type="button"
              data-action="adjust-number-input"
              data-target="servings"
              data-step="-0.5"
              aria-label="Restar raciones"
            >
              ${this.renderIcon('minus')}
            </button>
            <input
              id="${escapeAttribute(servingsInputId)}"
              name="servings"
              type="number"
              inputmode="decimal"
              min="0.5"
              step="0.5"
              max="99"
              value="${escapeAttribute(String(servings))}"
              required
            />
            <button
              type="button"
              data-action="adjust-number-input"
              data-target="servings"
              data-step="0.5"
              aria-label="Sumar raciones"
            >
              ${this.renderIcon('add')}
            </button>
          </div>

          <label class="meal-edit-no-cook">
            <span class="meal-edit-no-cook-icon" aria-hidden="true">${this.renderIcon('noUtensils')}</span>
            <span class="meal-edit-no-cook-copy">
              <strong>No cocinar esta vez</strong>
              <small>Comer fuera o sobras</small>
            </span>
            <input type="checkbox" name="noCook" value="true" ${noCookChecked ? 'checked' : ''} ${noCookDisabled ? 'disabled' : ''} />
            <span class="meal-edit-switch" aria-hidden="true"></span>
          </label>
        </div>
      `,
      footer: `
        <div class="meal-edit-sheet-actions">
          <button class="button full" type="submit">${escapeHtml(submitLabel)}</button>
          <button class="meal-edit-cancel" type="button" data-action="${escapeAttribute(dismissAction)}">Cancelar</button>
        </div>
      `,
    });
  },

  renderSelectedRecipeField(recipeName) {
    return `
      <div class="meal-edit-recipe-copy">
        <span>Receta seleccionada</span>
        <strong>${escapeHtml(recipeName)}</strong>
      </div>
    `;
  },

  renderRecipeSelectField(recipes) {
    if (recipes.length === 0) {
      return `
        <div class="meal-edit-recipe-copy">
          <span>Receta seleccionada</span>
          <strong>Sin receta compatible</strong>
          <small>Crea una receta para esta franja o guarda como no cocinar.</small>
        </div>
      `;
    }

    return `
      <label class="meal-edit-recipe-copy">
        <span>Receta seleccionada</span>
        <select class="meal-edit-recipe-select" name="recipeId" required>
          ${recipes.map((recipe) => `
            <option value="${escapeAttribute(recipe.id)}">${escapeHtml(recipe.name)}</option>
          `).join('')}
        </select>
      </label>
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
          ${unavailableMeal ? '<small class="meal-shortage">No hay alimentos</small>' : ''}
        </div>
        <span class="meal-row-icon" aria-label="Se cocina">${this.renderIcon('utensils')}</span>
        <div class="inline-actions">
          <button class="meal-icon-action" type="button" aria-label="Editar comida" data-action="edit-planned-meal" data-id="${meal.id}">
            ${this.renderIcon('edit')}
          </button>
          <button class="icon-button" type="button" aria-label="Eliminar comida" data-action="delete-planned-meal" data-id="${meal.id}">
            ${this.renderIcon('delete')}
          </button>
        </div>
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
        <div class="inline-actions">
          <button class="meal-icon-action" type="button" aria-label="Editar no cocinar" data-action="edit-planned-meal" data-id="${meal.id}">
            ${this.renderIcon('edit')}
          </button>
          <button class="icon-button" type="button" aria-label="Eliminar no cocinar" data-action="delete-planned-meal" data-id="${meal.id}">
            ${this.renderIcon('delete')}
          </button>
        </div>
      </article>
    `;
  },

  renderMissingMealSlot(slot) {
    const slotKey = getSlotKey(slot);

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
  }
};

/**
 * Formatea el rango visible de la semana planificada.
 *
 * @param {Array<{date: string}>} days Resumenes de dias.
 * @returns {string} Rango visible.
 */
function formatPlanRange(days) {
  if (days.length === 0) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  return `${formatter.format(fromISODate(days[0].date))} - ${formatter.format(fromISODate(days.at(-1).date))}`;
}

/**
 * Crea la clave de estado de un hueco de planificacion.
 *
 * @param {{date: string, mealType: string}} slot Hueco de plan.
 * @returns {string} Clave estable del hueco.
 */
function getSlotKey(slot) {
  return `${slot.date}__${slot.mealType}`;
}
