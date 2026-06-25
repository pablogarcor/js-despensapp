import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import {
  escapeAttribute,
  escapeHtml,
  formatDate,
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
          <span class="shopping-badge ${summary.hasShoppingItems ? 'is-warning' : 'is-ok'}">
            ${summary.hasShoppingItems ? 'Comprar' : 'Suficiente'}
          </span>
        </div>
        <button class="button ghost small" type="button" data-view="shopping">Abrir compra</button>
      </section>
    `;
  },

  renderShoppingView(dashboard) {
    const summary = getShoppingSummary(dashboard);

    return `
      <section class="panel shopping-view-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Tienda</p>
            <h2>Compra</h2>
          </div>
          <span class="shopping-badge ${summary.hasShoppingItems ? 'is-warning' : 'is-ok'}">
            ${summary.hasShoppingItems ? 'Comprar' : 'Suficiente'}
          </span>
        </div>

        <p class="shopping-view-status">${summary.statusText} · ${summary.affectedText}</p>

        <div class="shopping-content shopping-view-content">
          ${summary.hasShoppingItems ? this.renderShoppingItems(dashboard) : '<p class="shopping-ok-text">Tienes alimentos suficientes para el plan actual.</p>'}
          ${this.renderShoppingExtraForm()}
          ${this.renderShoppingPurchaseActions({
            totalShoppingItems: summary.totalShoppingItems,
            checkedShoppingItems: summary.checkedShoppingItems,
          })}
          ${this.renderUnavailableMeals(dashboard)}
        </div>
      </section>
    `;
  },

  renderShoppingItems(dashboard) {
    return `
      <ul class="shopping-list">
        ${dashboard.shoppingList.map((item) => this.renderGeneratedShoppingItem(item)).join('')}
        ${dashboard.shoppingExtras.map((item) => this.renderExtraShoppingItem(item)).join('')}
      </ul>
    `;
  },

  renderGeneratedShoppingItem(item) {
    return `
      <li class="shopping-list-row ${item.checked ? 'is-checked' : ''}">
        <label class="shopping-item-check">
          <input
            type="checkbox"
            data-shopping-check
            value="${escapeAttribute(item.shoppingItemId)}"
            ${item.checked ? 'checked' : ''}
          />
          <span class="shopping-item-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <small>Plan</small>
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
            type="checkbox"
            data-shopping-check
            value="${escapeAttribute(item.id)}"
            ${item.checked ? 'checked' : ''}
          />
          <span class="shopping-item-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <small>Extra</small>
          </span>
          <strong class="shopping-item-quantity">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</strong>
        </label>
        <button class="icon-button shopping-extra-remove" type="button" aria-label="Eliminar extra ${escapeAttribute(item.name)}" data-action="delete-shopping-extra" data-id="${escapeAttribute(item.id)}">
          x
        </button>
      </li>
    `;
  },

  renderShoppingExtraForm() {
    return `
      <form class="shopping-extra-form" data-form="shopping-extra">
        <label>
          Extra
          <input name="name" type="text" autocomplete="off" placeholder="Ej. Cafe" required />
        </label>
        <label>
          Cantidad
          <input name="quantity" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0" required />
        </label>
        <label>
          Unidad
          <select name="unit" required>
            ${renderUnitOptions()}
          </select>
        </label>
        <button class="button small" type="submit">Añadir</button>
      </form>
    `;
  },

  renderShoppingPurchaseActions({ totalShoppingItems, checkedShoppingItems }) {
    if (totalShoppingItems === 0) {
      return '';
    }

    return `
      <div class="shopping-purchase-actions">
        <span>${checkedShoppingItems} marcados</span>
        <button class="button small" type="button" data-action="apply-shopping-purchase" ${checkedShoppingItems === 0 ? 'disabled' : ''}>
          Compra hecha
        </button>
      </div>
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
