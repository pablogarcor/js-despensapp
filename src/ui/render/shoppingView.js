import { fromISODate } from '../../domain/planning.js';
import {
  escapeAttribute,
  escapeHtml,
  formatQuantity,
  renderUnitOptions,
} from '../renderUtils.js';

/**
 * Metodos de render de la vista de compra accionable.
 */
export const shoppingViewMethods = {
  renderShoppingPlanSummary(dashboard) {
    const summary = getShoppingSummary(dashboard);

    return `
      <section class="status-panel shopping-plan-summary ${summary.hasShoppingItems ? '' : 'ok'}">
        <div class="shopping-summary">
          <span>
            <strong>Lista de la compra</strong>
            <small>${summary.statusText} · ${summary.affectedText}</small>
          </span>
          <button class="shopping-badge ${summary.hasShoppingItems ? 'is-warning' : 'is-ok'}" type="button" data-view="shopping">
            ${summary.hasShoppingItems ? 'Comprar' : 'Suficiente'}
          </button>
        </div>
      </section>
    `;
  },

  renderShoppingView(dashboard) {
    const summary = getShoppingSummary(dashboard);

    return `
      <section class="view-heading">
        <div>
          <h2>Lista de la Compra</h2>
          <p>${summary.hasShoppingItems ? 'Faltan para tu plan semanal' : 'Tu plan esta cubierto'}</p>
        </div>
      </section>

      <section class="shopping-view-panel">
        <p class="shopping-view-status">${summary.statusText}</p>

        <div class="shopping-content shopping-view-content">
          ${summary.hasShoppingItems ? this.renderShoppingItems(dashboard) : '<p class="shopping-ok-text">Tienes alimentos suficientes para el plan actual.</p>'}
          ${this.renderShoppingExtraSheet()}
          ${this.renderShoppingActions({
            totalShoppingItems: summary.totalShoppingItems,
            checkedShoppingItems: summary.checkedShoppingItems,
          })}
        </div>
      </section>
    `;
  },

  renderShoppingItems(dashboard) {
    return `
      ${
        dashboard.shoppingList.length > 0
          ? `
            <section class="shopping-group">
              <div class="shopping-group-header">
                ${this.renderIcon('weeklyPlan')}
                <h3>Plan semanal</h3>
              </div>
              <ul class="shopping-list">
                ${dashboard.shoppingList.map((item) => this.renderGeneratedShoppingItem(item, dashboard.unavailableMeals)).join('')}
              </ul>
            </section>
          `
          : ''
      }
      ${
        dashboard.shoppingExtras.length > 0
          ? `
            <section class="shopping-group">
              <div class="shopping-group-header">
                ${this.renderIcon('add')}
                <h3>Extras</h3>
              </div>
              <ul class="shopping-list">
                ${dashboard.shoppingExtras.map((item) => this.renderExtraShoppingItem(item)).join('')}
              </ul>
            </section>
          `
          : ''
      }
    `;
  },

  renderGeneratedShoppingItem(item, unavailableMeals) {
    const affectedMeals = getAffectedMealsForItem(item, unavailableMeals);

    return `
      <li class="shopping-list-row ${item.checked ? 'is-checked' : ''}">
        <label class="shopping-item-check">
          <input
            class="shopping-card-checkbox"
            type="checkbox"
            data-shopping-check
            value="${escapeAttribute(item.shoppingItemId)}"
            ${item.checked ? 'checked' : ''}
          />
          <span class="shopping-checkmark" aria-hidden="true">${this.renderIcon('check')}</span>
          <span class="shopping-item-copy">
            <strong class="shopping-item-name">${escapeHtml(item.name)}</strong>
            ${renderShoppingMealChips(affectedMeals)}
          </span>
          <strong class="shopping-item-quantity">${formatQuantity(item.missingQuantity)} ${escapeHtml(item.unit)}</strong>
        </label>
      </li>
    `;
  },

  renderExtraShoppingItem(item) {
    return `
      <li class="shopping-list-row ${item.checked ? 'is-checked' : ''}">
        <label class="shopping-item-check">
          <input
            class="shopping-card-checkbox"
            type="checkbox"
            data-shopping-check
            value="${escapeAttribute(item.id)}"
            ${item.checked ? 'checked' : ''}
          />
          <span class="shopping-checkmark" aria-hidden="true">${this.renderIcon('check')}</span>
          <span class="shopping-item-copy">
            <strong class="shopping-item-name">${escapeHtml(item.name)}</strong>
            <span class="shopping-chip-row">
              <small class="shopping-context-chip">Articulo extra</small>
            </span>
          </span>
          <strong class="shopping-item-quantity">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</strong>
        </label>
        <button class="icon-button shopping-extra-remove" type="button" aria-label="Eliminar extra ${escapeAttribute(item.name)}" data-action="delete-shopping-extra" data-id="${escapeAttribute(item.id)}">
          ${this.renderIcon('delete')}
        </button>
      </li>
    `;
  },

  renderShoppingExtraSheet() {
    if (!this.state.shoppingExtraFormOpen) {
      return '';
    }

    return this.renderActionSheet({
      title: 'Añadir articulo extra',
      titleId: 'create-shopping-extra-title',
      dismissAction: 'hide-shopping-extra-form',
      className: 'meal-edit-sheet recipe-edit-sheet shopping-extra-sheet',
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form recipe-edit-sheet-form shopping-extra-sheet-form',
        dataForm: 'shopping-extra',
      },
      body: `
        <div class="meal-edit-sheet-body recipe-edit-sheet-body shopping-extra-sheet-body">
          <div class="meal-edit-recipe-context">
            <span class="meal-edit-recipe-icon" aria-hidden="true">${this.renderIcon('shoppingList')}</span>
            <div class="meal-edit-recipe-copy">
              <span>Articulo extra</span>
              <strong>Sin guardar</strong>
            </div>
          </div>

          <label class="meal-edit-field">
            <span>Nombre</span>
            <input name="name" type="text" autocomplete="off" placeholder="Ej. Cafe" required />
          </label>
          <div class="form-grid">
            <label class="meal-edit-field">
              <span>Cantidad</span>
              <input name="quantity" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0" required />
            </label>
            <label class="meal-edit-field">
              <span>Unidad</span>
              <select name="unit" required>
                ${renderUnitOptions()}
              </select>
            </label>
          </div>
        </div>
      `,
      footer: `
        <div class="meal-edit-sheet-actions">
          <button class="button full" type="submit">${this.renderIcon('add')} Añadir articulo</button>
          <button class="meal-edit-cancel" type="button" data-action="hide-shopping-extra-form">Cancelar</button>
        </div>
      `,
    });
  },

  renderShoppingActions({ totalShoppingItems, checkedShoppingItems }) {
    return `
      <div class="shopping-actions">
        <button class="shopping-action-button shopping-extra-trigger" type="button" data-action="show-shopping-extra-form">
          ${this.renderIcon('add')} <span>Añadir articulo extra</span>
        </button>
        <button
          class="shopping-action-button shopping-finish-button"
          type="button"
          data-action="apply-shopping-purchase"
          ${totalShoppingItems === 0 || checkedShoppingItems === 0 ? 'disabled' : ''}
        >
          ${this.renderIcon('done')} <span>Finalizar compra</span>
        </button>
      </div>
    `;
  },
};

/**
 * Calcula contadores visibles de compra.
 *
 * @param {import('../../domain/types.js').DashboardSnapshot} dashboard Snapshot.
 * @returns {{totalShoppingItems: number, checkedShoppingItems: number, hasShoppingItems: boolean, statusText: string, affectedText: string}} Resumen.
 */
function getShoppingSummary(dashboard) {
  const totalShoppingItems = dashboard.shoppingList.length + dashboard.shoppingExtras.length;
  const checkedShoppingItems = [
    ...dashboard.shoppingList,
    ...dashboard.shoppingExtras,
  ].filter((item) => item.checked).length;
  const hasShoppingItems = totalShoppingItems > 0;

  return {
    totalShoppingItems,
    checkedShoppingItems,
    hasShoppingItems,
    statusText: hasShoppingItems
      ? `${totalShoppingItems} alimentos en lista`
      : 'Sin compra pendiente',
    affectedText:
      dashboard.unavailableMeals.length > 0
        ? `${dashboard.unavailableMeals.length} comidas afectadas`
        : 'Sin comidas afectadas',
  };
}

/**
 * Busca las comidas afectadas por una entrada generada de compra.
 *
 * @param {import('../../domain/types.js').ShoppingListItem} item Entrada de compra.
 * @param {import('../../domain/types.js').UnavailablePlannedMeal[]} unavailableMeals Comidas con faltas.
 * @returns {import('../../domain/types.js').UnavailablePlannedMeal[]} Comidas afectadas.
 */
function getAffectedMealsForItem(item, unavailableMeals) {
  return unavailableMeals.filter((meal) =>
    meal.missingIngredients.some((ingredient) => ingredient.pantryItemId === item.pantryItemId),
  );
}

/**
 * Renderiza chips compactas con el primer uso afectado y el resto resumido.
 *
 * @param {import('../../domain/types.js').UnavailablePlannedMeal[]} affectedMeals Comidas afectadas.
 * @returns {string} HTML de chips.
 */
function renderShoppingMealChips(affectedMeals) {
  if (affectedMeals.length === 0) {
    return `
      <span class="shopping-chip-row">
        <small class="shopping-context-chip">Plan semanal</small>
      </span>
    `;
  }

  const [firstMeal] = affectedMeals;
  const remainingMeals = affectedMeals.length - 1;

  return `
    <span class="shopping-chip-row">
      <small class="shopping-context-chip">${escapeHtml(firstMeal.recipeName)} - ${escapeHtml(formatShoppingMealDay(firstMeal.date))}</small>
      ${
        remainingMeals > 0
          ? `<small class="shopping-context-chip shopping-count-chip">y ${remainingMeals} mas</small>`
          : ''
      }
    </span>
  `;
}

/**
 * Formatea el dia de una comida como etiqueta corta de compra.
 *
 * @param {string} isoDate Fecha YYYY-MM-DD.
 * @returns {string} Dia de la semana capitalizado.
 */
function formatShoppingMealDay(isoDate) {
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(fromISODate(isoDate));

  return `${weekday.charAt(0).toLocaleUpperCase('es')}${weekday.slice(1)}`;
}
