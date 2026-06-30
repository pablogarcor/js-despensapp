import { escapeAttribute, escapeHtml, formatQuantity, matchesSearchText, normalizeSearchText } from '../renderUtils.js';

/**
 * Metodos de render y filtrado de la vista de despensa.
 */
export const pantryViewMethods = {
  filterPantryItems(pantryItems) {
    const query = normalizeSearchText(this.state.pantrySearch);

    if (!query) {
      return pantryItems;
    }

    return pantryItems.filter((item) => matchesSearchText(item.name, query));
  },

  renderPantryView(dashboard) {
    const filteredPantryItems = this.filterPantryItems(dashboard.pantryItems);
    const isFormOpen = this.state.pantryFormOpen;

    return `
      <section class="view-heading">
        <div>
          <h2>Despensa</h2>
          <p>${dashboard.pantryItems.length} alimentos guardados</p>
        </div>
      </section>

      ${this.renderSearchControl({
        target: 'pantry',
        label: 'Buscar alimento',
        placeholder: 'Buscar en despensa...',
        value: this.state.pantrySearch,
        visibleCount: filteredPantryItems.length,
        totalCount: dashboard.pantryItems.length,
      })}

      ${this.renderPantryItemCreateSheet()}
      ${this.renderPantryItemEditSheet(dashboard)}
      ${this.renderPantryItemDeleteSheet(dashboard)}
      ${
        isFormOpen
          ? ''
          : this.renderFloatingActionButton({
              action: 'show-pantry-form',
              label: 'Añadir alimento',
              className: 'pantry-fab',
            })
      }

      <section class="list-section" aria-label="Alimentos guardados">
        ${
          dashboard.pantryItems.length === 0 ? this.renderEmptyState('Todavia no hay alimentos.') : ''
        }
        ${
          dashboard.pantryItems.length > 0 && filteredPantryItems.length === 0
            ? this.renderEmptyState('No hay alimentos que coincidan.')
            : ''
        }
        ${filteredPantryItems.map((item) => this.renderPantryItem(item, dashboard.recipes)).join('')}
      </section>
    `;
  },

  renderPantryItemCreateSheet() {
    if (!this.state.pantryFormOpen) {
      return '';
    }

    return this.renderActionSheet({
      title: 'Añadir alimento',
      titleId: 'create-pantry-item-title',
      dismissAction: 'hide-pantry-form',
      className: 'meal-edit-sheet entity-edit-sheet pantry-create-sheet',
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form entity-edit-sheet-form pantry-create-sheet-form',
        dataForm: 'pantry-item',
      },
      body: `
        <div class="meal-edit-sheet-body entity-edit-sheet-body pantry-create-sheet-body">
          ${this.renderSheetContext({
            icon: 'pantry',
            label: 'Nuevo alimento',
            title: 'Sin guardar',
          })}
          ${this.renderEntityFields({
            namePlaceholder: 'Ej. Garbanzos',
          })}
        </div>
      `,
      footer: this.renderSheetActions({
        submitLabel: 'Añadir alimento',
        submitIcon: 'add',
        cancelAction: 'hide-pantry-form',
      }),
    });
  },

  renderPantryItemEditSheet(dashboard) {
    const item = dashboard.pantryItems.find((candidate) => candidate.id === this.state.editingPantryItemId);

    if (!item) {
      return '';
    }

    return this.renderPantryItemEditForm(item, dashboard.recipes);
  },

  renderPantryItemDeleteSheet(dashboard) {
    const item = dashboard.pantryItems.find((candidate) => candidate.id === this.state.deletingPantryItemId);

    if (!item) {
      return '';
    }

    return this.renderDeleteConfirmationSheet({
      title: 'Borrar alimento',
      titleId: 'delete-pantry-item-title',
      dismissAction: 'cancel-delete-pantry-item',
      itemLabel: 'Alimento seleccionado',
      itemName: item.name,
      question: '¿Quieres borrar este alimento?',
      confirmLabel: 'Borrar alimento',
      confirmAction: 'confirm-delete-pantry-item',
      itemId: item.id,
      className: 'pantry-delete-sheet',
    });
  },

  renderPantryItem(item, recipes) {
    const isExpanded = this.state.expandedPantryItemId === item.id;

    return `
      <article class="list-card pantry-card ${isExpanded ? 'is-expanded' : ''}">
        <div class="pantry-card-main">
          <button
            class="pantry-card-toggle"
            type="button"
            data-action="toggle-pantry-stock"
            data-id="${escapeAttribute(item.id)}"
            aria-expanded="${isExpanded}"
            aria-label="${isExpanded ? 'Ocultar ajuste de' : 'Mostrar ajuste de'} ${escapeAttribute(item.name)}"
          >
            <span class="pantry-card-copy">
              <span class="item-title-row">
                <span class="pantry-card-title">${escapeHtml(item.name)}</span>
                ${renderStockBadge(item)}
              </span>
              <span class="pantry-card-quantity">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</span>
            </span>
            <span class="pantry-card-chevron" aria-hidden="true">${this.renderIcon('chevronDown')}</span>
          </button>
          ${this.renderEditDeleteActions({
            id: item.id,
            editAction: 'edit-pantry-item',
            deleteAction: 'delete-pantry-item',
            editLabel: `Editar ${item.name}`,
            deleteLabel: `Eliminar ${item.name}`,
            className: 'pantry-card-actions',
          })}
        </div>
        ${
          isExpanded
            ? `
              <form class="stock-form" data-form="pantry-stock">
                <input type="hidden" name="pantryItemId" value="${escapeAttribute(item.id)}" />
                <div class="stock-form-heading">
                  <span>Ajuste</span>
                  <small>en ${escapeHtml(item.unit)}</small>
                </div>
                <div class="stock-adjust-controls">
                  <label class="stock-adjust-label">
                    <span class="visually-hidden">Cantidad a ajustar en ${escapeHtml(item.unit)}</span>
                    <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0" required />
                  </label>
                  <button class="button small stock-action-add" type="submit" data-stock-action="add">${this.renderIcon('stockPlus')} Sumar</button>
                  <button class="button small stock-action-subtract" type="submit" data-stock-action="subtract">${this.renderIcon('stockMinus')} Restar</button>
                </div>
              </form>
            `
            : ''
        }
      </article>
    `;
  },

  renderPantryItemEditForm(item, recipes) {
    const affectedRecipes = recipes.filter((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.pantryItemId === item.id),
    );

    return this.renderActionSheet({
      title: 'Editar alimento',
      titleId: 'edit-pantry-item-title',
      dismissAction: 'cancel-edit-pantry-item',
      className: 'meal-edit-sheet entity-edit-sheet pantry-edit-sheet',
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form entity-edit-sheet-form pantry-edit-sheet-form',
        dataForm: 'pantry-item-edit',
        hiddenInputs: [{ name: 'pantryItemId', value: item.id }],
      },
      body: `
        <div class="meal-edit-sheet-body entity-edit-sheet-body pantry-edit-sheet-body">
          ${this.renderSheetContext({
            icon: 'pantry',
            label: 'Alimento seleccionado',
            title: item.name,
            detail: `${formatQuantity(item.quantity)} ${item.unit}`,
          })}
          ${this.renderEntityFields({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          })}
          ${this.renderPantryRecipeUsageFields(item, affectedRecipes)}
        </div>
      `,
      footer: this.renderSheetActions({
        submitLabel: 'Guardar cambios',
        submitIcon: 'save',
        cancelAction: 'cancel-edit-pantry-item',
      }),
    });
  },

  renderPantryRecipeUsageFields(item, affectedRecipes) {
    if (affectedRecipes.length === 0) {
      return '';
    }

    return `
      <div class="recipe-usage-editor">
        <div class="section-heading compact">
          <h3>Recetas que usan ${escapeHtml(item.name)}</h3>
        </div>
        ${affectedRecipes.map((recipe) => {
          const ingredient = recipe.ingredients.find((candidate) => candidate.pantryItemId === item.id);

          return `
            <div class="recipe-usage-row">
              <input type="hidden" name="recipeIngredientRecipeId" value="${escapeAttribute(recipe.id)}" />
              <label>
                ${escapeHtml(recipe.name)}
                <input
                  name="recipeIngredientQuantity"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0.01"
                  value="${ingredient.quantity}"
                  required
                />
              </label>
              <span>${formatQuantity(ingredient.quantity)} ${escapeHtml(item.unit)} actuales</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
};

/**
 * Renderiza una etiqueta visual de estado de stock sin cambiar reglas de negocio.
 *
 * @param {import('../../domain/types.js').PantryItem} item Alimento.
 * @returns {string} HTML de la etiqueta o cadena vacia.
 */
function renderStockBadge(item) {
  if (item.quantity <= 0) {
    return '<span class="stock-badge is-empty">Agotado</span>';
  }

  return '';
}
