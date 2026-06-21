import { DomainError } from '../domain/errors.js';
import { fromISODate } from '../domain/planning.js';
import { DEFAULT_UNITS, MEAL_TYPE_LABELS, MEAL_TYPES } from '../domain/types.js';

/**
 * Controlador de UI de la SPA.
 *
 * Mantiene el estado minimo de interfaz y delega todas las reglas de negocio en
 * PantryService. Renderiza HTML declarativo porque el MVP no necesita un
 * framework de componentes.
 */
export class PantryApp {
  /**
   * @param {Object} params Dependencias.
   * @param {HTMLElement} params.root Nodo raiz de la aplicacion.
   * @param {import('../services/pantryService.js').PantryService} params.service Servicio de negocio.
   */
  constructor({ root, service }) {
    this.root = root;
    this.service = service;
    this.toastTimeoutId = null;
    this.state = {
      activeView: 'pantry',
      dashboard: null,
      editingPantryItemId: null,
      ingredientRows: [createIngredientRow()],
      editingRecipeId: null,
      editRecipeDraft: null,
      editIngredientRows: [],
      editingPlannedMealId: null,
      toast: null,
      isBusy: false,
    };
  }

  /**
   * Carga datos iniciales, renderiza y registra eventos.
   *
   * @returns {Promise<void>}
   */
  async start() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('submit', (event) => this.handleSubmit(event));
    this.root.addEventListener('change', (event) => this.handleChange(event));
    await this.refresh();
  }

  /**
   * Recarga el snapshot agregado desde el servicio.
   *
   * @returns {Promise<void>}
   */
  async refresh() {
    this.state.dashboard = await this.service.getDashboard();
    this.render();
  }

  /**
   * Pinta la aplicacion completa.
   */
  render() {
    const dashboard = this.state.dashboard;

    if (!dashboard) {
      this.root.innerHTML = '<main class="app-shell"><p>Cargando...</p></main>';
      return;
    }

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <div>
            <div class="brand-row">
              <h1>Despensapp</h1>
              <button
                class="settings-button ${this.state.activeView === 'settings' ? 'is-active' : ''}"
                type="button"
                data-view="settings"
                aria-label="Abrir configuracion"
                aria-pressed="${this.state.activeView === 'settings'}"
              >
                &#9881;
              </button>
            </div>
          </div>
          <div class="header-stat" aria-label="Resumen de despensa">
            <strong>${dashboard.pantryItems.length}</strong>
            <span>alimentos</span>
          </div>
        </header>

        ${this.renderPendingMeals(dashboard)}
        ${this.renderToast()}

        <nav class="tabs" aria-label="Secciones principales">
          ${this.renderTab('pantry', 'Despensa')}
          ${this.renderTab('recipes', 'Recetas')}
          ${this.renderTab('plan', 'Plan')}
        </nav>

        <main>
          ${this.renderActiveView(dashboard)}
        </main>
      </div>
    `;
  }

  /**
   * Gestiona clicks de botones y navegacion.
   *
   * @param {MouseEvent} event Evento de click.
   * @returns {Promise<void>}
   */
  async handleClick(event) {
    const actionElement = event.target.closest('[data-action]');
    const viewElement = event.target.closest('[data-view]');

    if (viewElement) {
      this.state.activeView = viewElement.dataset.view;
      this.render();
      return;
    }

    if (!actionElement || this.state.isBusy) {
      return;
    }

    const { action, id } = actionElement.dataset;

    await this.runSafely(async () => {
      let shouldRefresh = true;

      if (action === 'dismiss-toast') {
        this.dismissToast();
        shouldRefresh = false;
      }

      if (action === 'export-backup') {
        const backup = await this.service.exportBackup();
        this.downloadBackup(backup);
        this.showToast('Copia exportada.');
        shouldRefresh = false;
      }

      if (action === 'delete-pantry-item') {
        await this.service.deletePantryItem(id);
        this.showToast('Alimento eliminado.');
      }

      if (action === 'clear-pantry') {
        const deletedCount = await this.service.clearPantryItems();
        this.state.editingPantryItemId = null;
        this.showToast(`${deletedCount} alimentos eliminados de la despensa.`);
      }

      if (action === 'edit-pantry-item') {
        this.state.editingPantryItemId = id;
        shouldRefresh = false;
      }

      if (action === 'cancel-edit-pantry-item') {
        this.state.editingPantryItemId = null;
        shouldRefresh = false;
      }

      if (action === 'delete-recipe') {
        await this.service.deleteRecipe(id);
        this.showToast('Receta eliminada.');
      }

      if (action === 'clear-recipes') {
        const deletedCount = await this.service.clearRecipes();
        this.state.editingRecipeId = null;
        this.state.editRecipeDraft = null;
        this.state.editIngredientRows = [];
        this.showToast(`${deletedCount} recetas eliminadas.`);
      }

      if (action === 'edit-recipe') {
        const recipe = this.state.dashboard.recipes.find((candidate) => candidate.id === id);

        if (recipe) {
          this.state.editingRecipeId = recipe.id;
          this.state.editRecipeDraft = {
            name: recipe.name,
            mealTypes: [...recipe.mealTypes],
          };
          this.state.editIngredientRows = recipe.ingredients.map((ingredient) =>
            createIngredientRow({
              pantryItemId: ingredient.pantryItemId,
              quantity: String(ingredient.quantity),
            }),
          );
        }
        shouldRefresh = false;
      }

      if (action === 'cancel-edit-recipe') {
        this.state.editingRecipeId = null;
        this.state.editRecipeDraft = null;
        this.state.editIngredientRows = [];
        shouldRefresh = false;
      }

      if (action === 'delete-planned-meal') {
        await this.service.deletePlannedMeal(id);
        this.showToast('Comida eliminada del plan.');
      }

      if (action === 'edit-planned-meal') {
        this.state.editingPlannedMealId = id;
        shouldRefresh = false;
      }

      if (action === 'cancel-edit-planned-meal') {
        this.state.editingPlannedMealId = null;
        shouldRefresh = false;
      }

      if (action === 'clear-plan') {
        const deletedCount = await this.service.clearCurrentAndFutureMeals();
        this.showToast(`${deletedCount} comidas eliminadas del plan.`);
      }

      if (action === 'clear-all-data') {
        if (!window.confirm('Borrar todo eliminara despensa, recetas y planificacion.')) {
          shouldRefresh = false;
        } else {
          const summary = await this.service.clearAllData();
          this.state.editingPantryItemId = null;
          this.state.editingRecipeId = null;
          this.state.editRecipeDraft = null;
          this.state.editIngredientRows = [];
          this.state.editingPlannedMealId = null;
          this.showToast(
            `Eliminados ${summary.pantryItems} alimentos, ${summary.recipes} recetas y ${summary.plannedMeals} comidas.`,
          );
        }
      }

      if (action === 'resolve-meal') {
        await this.service.resolvePastMeal(id, actionElement.dataset.cooked === 'true');
        this.showToast('Comida pendiente resuelta.');
      }

      if (action === 'add-ingredient-row') {
        this.state.ingredientRows.push(createIngredientRow());
        shouldRefresh = false;
      }

      if (action === 'remove-ingredient-row') {
        this.state.ingredientRows = this.state.ingredientRows.filter((row) => row.id !== id);

        if (this.state.ingredientRows.length === 0) {
          this.state.ingredientRows.push(createIngredientRow());
        }
        shouldRefresh = false;
      }

      if (action === 'add-edit-ingredient-row') {
        this.syncEditIngredientRows(actionElement.closest('form'));
        this.state.editIngredientRows.push(createIngredientRow());
        shouldRefresh = false;
      }

      if (action === 'remove-edit-ingredient-row') {
        this.syncEditIngredientRows(actionElement.closest('form'));
        this.state.editIngredientRows = this.state.editIngredientRows.filter((row) => row.id !== id);

        if (this.state.editIngredientRows.length === 0) {
          this.state.editIngredientRows.push(createIngredientRow());
        }
        shouldRefresh = false;
      }

      if (shouldRefresh) {
        await this.refresh();
      } else {
        this.render();
      }
    });
  }

  /**
   * Gestiona formularios de alta y planificacion.
   *
   * @param {SubmitEvent} event Evento de submit.
   * @returns {Promise<void>}
   */
  async handleSubmit(event) {
    event.preventDefault();

    const form = event.target;

    if (this.state.isBusy) {
      return;
    }

    await this.runSafely(async () => {
      if (form.matches('[data-form="pantry-item"]')) {
        const data = new FormData(form);
        await this.service.createPantryItem({
          name: data.get('name'),
          quantity: data.get('quantity'),
          unit: data.get('unit'),
        });
        form.reset();
        this.showToast('Alimento anadido.');
      }

      if (form.matches('[data-form="pantry-stock"]')) {
        const data = new FormData(form);
        const stockAction = event.submitter?.dataset.stockAction ?? 'add';

        if (stockAction === 'subtract') {
          await this.service.subtractPantryItemQuantity(data.get('pantryItemId'), data.get('quantity'));
        } else {
          await this.service.addPantryItemQuantity(data.get('pantryItemId'), data.get('quantity'));
        }

        form.reset();
        this.showToast('Stock actualizado.');
      }

      if (form.matches('[data-form="pantry-item-edit"]')) {
        const data = new FormData(form);
        await this.service.updatePantryItem(data.get('pantryItemId'), {
          name: data.get('name'),
          quantity: data.get('quantity'),
          unit: data.get('unit'),
          recipeIngredientUpdates: this.readPantryRecipeUpdatesFromForm(data),
        });
        this.state.editingPantryItemId = null;
        this.showToast('Alimento actualizado.');
      }

      if (form.matches('[data-form="recipe"]')) {
        const data = new FormData(form);
        await this.service.createRecipe({
          name: data.get('name'),
          mealTypes: data.getAll('mealTypes'),
          ingredients: this.readIngredientsFromForm(data),
        });
        this.state.ingredientRows = [createIngredientRow()];
        this.showToast('Receta creada.');
      }

      if (form.matches('[data-form="recipe-edit"]')) {
        const data = new FormData(form);
        await this.service.updateRecipe(data.get('recipeId'), {
          name: data.get('name'),
          mealTypes: data.getAll('mealTypes'),
          ingredients: this.readIngredientsFromForm(data),
        });
        this.state.editingRecipeId = null;
        this.state.editRecipeDraft = null;
        this.state.editIngredientRows = [];
        this.showToast('Receta actualizada.');
      }

      if (form.matches('[data-form="plan-week"]')) {
        const data = new FormData(form);
        const mode = event.submitter?.dataset.planMode ?? 'reset';
        const result =
          mode === 'complete'
            ? await this.service.completeWeekPlan({ servings: data.get('servings') })
            : await this.service.planNextWeek({ servings: data.get('servings') });
        const skippedMessage =
          result.missingSlots.length > 0 ? ` ${result.missingSlots.length} huecos sin receta compatible.` : '';
        const createdMessage =
          mode === 'complete'
            ? `${result.plannedMeals.length} huecos completados.`
            : 'Semana planificada.';
        this.showToast(`${createdMessage}${skippedMessage}`);
      }

      if (form.matches('[data-form="planned-meal"]')) {
        const data = new FormData(form);
        await this.service.createPlannedMeal({
          date: data.get('date'),
          mealType: data.get('mealType'),
          recipeId: data.get('recipeId'),
          servings: data.get('servings'),
        });
        this.showToast('Comida anadida al plan.');
      }

      if (form.matches('[data-form="planned-meal-edit"]')) {
        const data = new FormData(form);
        await this.service.updatePlannedMeal(data.get('plannedMealId'), {
          recipeId: data.get('recipeId'),
          servings: data.get('servings'),
        });
        this.state.editingPlannedMealId = null;
        this.showToast('Comida actualizada.');
      }

      if (form.matches('[data-form="import-backup"]')) {
        const file = form.elements.backupFile.files[0];

        if (!file) {
          throw new DomainError('Selecciona un archivo JSON para importar.', 'BACKUP_FILE_REQUIRED');
        }

        if (!window.confirm('Importar esta copia reemplazara los datos actuales.')) {
          return;
        }

        const summary = await this.service.importBackup(await file.text());
        form.reset();
        this.state.activeView = 'settings';
        this.showToast(
          `Importados ${summary.pantryItems} alimentos, ${summary.recipes} recetas y ${summary.plannedMeals} comidas.`,
        );
      }

      await this.refresh();
    });
  }

  /**
   * Mantiene el estado de filas dinamicas de ingredientes al cambiar selects.
   *
   * @param {Event} event Evento change.
   */
  handleChange(event) {
    const rowElement = event.target.closest('[data-ingredient-row]');

    if (rowElement) {
      const row = this.state.ingredientRows.find((ingredientRow) => ingredientRow.id === rowElement.dataset.ingredientRow);

      if (!row) {
        return;
      }

      if (event.target.matches('[name="ingredientItem"]')) {
        row.pantryItemId = event.target.value;
      }

      if (event.target.matches('[name="ingredientQuantity"]')) {
        row.quantity = event.target.value;
      }

      return;
    }

    const editRowElement = event.target.closest('[data-edit-ingredient-row]');

    if (!editRowElement) {
      return;
    }

    const editRow = this.state.editIngredientRows.find(
      (ingredientRow) => ingredientRow.id === editRowElement.dataset.editIngredientRow,
    );

    if (!editRow) {
      return;
    }

    if (event.target.matches('[name="ingredientItem"]')) {
      editRow.pantryItemId = event.target.value;
    }

    if (event.target.matches('[name="ingredientQuantity"]')) {
      editRow.quantity = event.target.value;
    }
  }

  /**
   * Ejecuta una accion atrapando errores de dominio para mostrarlos como aviso.
   *
   * @param {() => Promise<void>} action Accion asyncrona.
   * @returns {Promise<void>}
   */
  async runSafely(action) {
    this.state.isBusy = true;

    try {
      await action();
    } catch (error) {
      if (error instanceof DomainError) {
        this.showToast(error.message, 'error');
        this.render();
        return;
      }

      console.error(error);
      this.showToast('Ha ocurrido un error inesperado.', 'error');
      this.render();
    } finally {
      this.state.isBusy = false;
    }
  }

  /**
   * Lee ingredientes desde FormData preservando las filas dinamicas.
   *
   * @param {FormData} data Datos del formulario.
   * @returns {import('../domain/types.js').RecipeIngredient[]} Ingredientes.
   */
  readIngredientsFromForm(data) {
    const itemIds = data.getAll('ingredientItem');
    const quantities = data.getAll('ingredientQuantity');

    return itemIds.map((pantryItemId, index) => ({
      pantryItemId,
      quantity: quantities[index],
    }));
  }

  /**
   * Lee cantidades de recetas afectadas al editar un alimento.
   *
   * @param {FormData} data Datos del formulario.
   * @returns {Array<{recipeId: string, quantity: FormDataEntryValue}>} Cantidades por receta.
   */
  readPantryRecipeUpdatesFromForm(data) {
    const recipeIds = data.getAll('recipeIngredientRecipeId');
    const quantities = data.getAll('recipeIngredientQuantity');

    return recipeIds.map((recipeId, index) => ({
      recipeId,
      quantity: quantities[index],
    }));
  }

  /**
   * Sincroniza filas de ingredientes de edicion desde el formulario visible.
   *
   * @param {HTMLFormElement | null} form Formulario de edicion.
   */
  syncEditIngredientRows(form) {
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    this.state.editRecipeDraft = {
      name: formData.get('name'),
      mealTypes: formData.getAll('mealTypes'),
    };
    this.state.editIngredientRows = [...form.querySelectorAll('[data-edit-ingredient-row]')].map((rowElement) => ({
      id: rowElement.dataset.editIngredientRow,
      pantryItemId: rowElement.querySelector('[name="ingredientItem"]').value,
      quantity: rowElement.querySelector('[name="ingredientQuantity"]').value,
    }));
  }

  /**
   * Guarda un mensaje temporal y programa su cierre automatico.
   *
   * @param {string} message Mensaje.
   * @param {'success' | 'error'} [type='success'] Tipo visual.
   */
  showToast(message, type = 'success') {
    this.clearToastTimeout();
    this.state.toast = {
      id: createUiId('toast'),
      message,
      type,
    };
    this.toastTimeoutId = window.setTimeout(() => {
      this.dismissToast();
    }, 4500);
  }

  /**
   * Cierra el aviso visible, si existe.
   */
  dismissToast() {
    this.clearToastTimeout();
    this.state.toast = null;
    this.render();
  }

  /**
   * Cancela el temporizador actual del aviso.
   */
  clearToastTimeout() {
    if (!this.toastTimeoutId) {
      return;
    }

    window.clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = null;
  }

  /**
   * Renderiza la vista seleccionada.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderActiveView(dashboard) {
    if (this.state.activeView === 'recipes') {
      return this.renderRecipesView(dashboard);
    }

    if (this.state.activeView === 'plan') {
      return this.renderPlanView(dashboard);
    }

    if (this.state.activeView === 'settings') {
      return this.renderSettingsView(dashboard);
    }

    return this.renderPantryView(dashboard);
  }

  /**
   * Descarga un backup como archivo JSON.
   *
   * @param {import('../domain/types.js').PantryBackup} backup Backup exportado.
   */
  downloadBackup(backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const exportedDate = backup.exportedAt.slice(0, 10);

    link.href = url;
    link.download = `despensapp-backup-${exportedDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Renderiza una pestana de navegacion.
   *
   * @param {string} view Nombre de vista.
   * @param {string} label Etiqueta.
   * @returns {string} HTML.
   */
  renderTab(view, label) {
    const isActive = this.state.activeView === view;
    return `
      <button class="tab ${isActive ? 'is-active' : ''}" type="button" data-view="${view}" aria-pressed="${isActive}">
        ${label}
      </button>
    `;
  }

  /**
   * Renderiza avisos de comidas pasadas pendientes.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPendingMeals(dashboard) {
    if (dashboard.pendingMeals.length === 0) {
      return '';
    }

    return `
      <section class="notice-panel" aria-label="Comidas pendientes">
        <div>
          <p class="eyebrow">Pendiente</p>
          <h2>Confirma comidas pasadas</h2>
        </div>
        <div class="pending-list">
          ${dashboard.pendingMeals.map((meal) => this.renderPendingMeal(meal, dashboard)).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Renderiza una comida pendiente de confirmar.
   *
   * @param {import('../domain/types.js').PlannedMeal} meal Comida.
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPendingMeal(meal, dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === meal.recipeId);

    return `
      <article class="pending-card">
        <div>
          <strong>${formatDate(meal.date)} · ${MEAL_TYPE_LABELS[meal.mealType]}</strong>
          <span>${escapeHtml(recipe?.name ?? 'Receta eliminada')} · ${meal.servings} raciones</span>
        </div>
        <div class="inline-actions">
          <button class="button small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="true">
            Hecha
          </button>
          <button class="button ghost small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="false">
            No hecha
          </button>
        </div>
      </article>
    `;
  }

  /**
   * Renderiza el mensaje de estado.
   *
   * @returns {string} HTML.
   */
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
  }

  /**
   * Renderiza la vista de despensa.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPantryView(dashboard) {
    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Inventario</p>
            <h2>Despensa</h2>
          </div>
          <span class="counter">${dashboard.pantryItems.length}</span>
        </div>

        <form class="stacked-form" data-form="pantry-item">
          <label>
            Nombre
            <input name="name" type="text" autocomplete="off" placeholder="Ej. Garbanzos" required />
          </label>
          <div class="form-grid">
            <label>
              Cantidad
              <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0" required />
            </label>
            <label>
              Unidad
              <select name="unit" required>
                ${renderUnitOptions()}
              </select>
            </label>
          </div>
          <button class="button full" type="submit">añadir alimento</button>
        </form>

        <div class="bulk-actions">
          <button class="button ghost full" type="button" data-action="clear-pantry" ${dashboard.pantryItems.length === 0 ? 'disabled' : ''}>
            Vaciar despensa
          </button>
        </div>
      </section>

      <section class="list-section" aria-label="Alimentos guardados">
        ${dashboard.pantryItems.length === 0 ? this.renderEmptyState('Todavia no hay alimentos.') : ''}
        ${dashboard.pantryItems.map((item) => this.renderPantryItem(item, dashboard.recipes)).join('')}
      </section>
    `;
  }

  /**
   * Renderiza un alimento.
   *
   * @param {import('../domain/types.js').PantryItem} item Alimento.
   * @param {import('../domain/types.js').Recipe[]} recipes Recetas.
   * @returns {string} HTML.
   */
  renderPantryItem(item, recipes) {
    if (this.state.editingPantryItemId === item.id) {
      return this.renderPantryItemEditForm(item, recipes);
    }

    return `
      <article class="list-card pantry-card">
        <div class="pantry-card-main">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</p>
          </div>
          <div class="inline-actions">
            <button class="button ghost small" type="button" data-action="edit-pantry-item" data-id="${item.id}">
              Editar
            </button>
            <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(item.name)}" data-action="delete-pantry-item" data-id="${item.id}">
              x
            </button>
          </div>
        </div>
        <form class="stock-form" data-form="pantry-stock">
          <input type="hidden" name="pantryItemId" value="${escapeAttribute(item.id)}" />
          <label>
            Ajustar ${escapeHtml(item.unit)}
            <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0" required />
          </label>
          <div class="stock-actions">
            <button class="button small" type="submit" data-stock-action="add">Sumar</button>
            <button class="button ghost small" type="submit" data-stock-action="subtract">Restar</button>
          </div>
        </form>
      </article>
    `;
  }

  /**
   * Renderiza el formulario inline para editar un alimento.
   *
   * @param {import('../domain/types.js').PantryItem} item Alimento.
   * @param {import('../domain/types.js').Recipe[]} recipes Recetas.
   * @returns {string} HTML.
   */
  renderPantryItemEditForm(item, recipes) {
    const affectedRecipes = recipes.filter((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.pantryItemId === item.id),
    );

    return `
      <article class="list-card pantry-card pantry-edit-card">
        <form class="stacked-form" data-form="pantry-item-edit">
          <input type="hidden" name="pantryItemId" value="${escapeAttribute(item.id)}" />
          <label>
            Nombre
            <input name="name" type="text" autocomplete="off" value="${escapeAttribute(item.name)}" required />
          </label>
          <div class="form-grid">
            <label>
              Cantidad
              <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0" value="${item.quantity}" required />
            </label>
            <label>
              Unidad
              <select name="unit" required>
                ${renderUnitOptions(item.unit)}
              </select>
            </label>
          </div>
          ${this.renderPantryRecipeUsageFields(item, affectedRecipes)}
          <div class="form-actions">
            <button class="button" type="submit">Guardar</button>
            <button class="button ghost" type="button" data-action="cancel-edit-pantry-item">Cancelar</button>
          </div>
        </form>
      </article>
    `;
  }

  /**
   * Renderiza recetas que usan un alimento para actualizar cantidades si cambia la unidad.
   *
   * @param {import('../domain/types.js').PantryItem} item Alimento editado.
   * @param {import('../domain/types.js').Recipe[]} affectedRecipes Recetas afectadas.
   * @returns {string} HTML.
   */
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

  /**
   * Renderiza la vista de recetas.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderRecipesView(dashboard) {
    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Cocina</p>
            <h2>Recetas</h2>
          </div>
          <span class="counter">${dashboard.recipes.length}</span>
        </div>

        <form class="stacked-form" data-form="recipe">
          <label>
            Nombre
            <input name="name" type="text" autocomplete="off" placeholder="Ej. Lentejas rápidas" required />
          </label>

          <fieldset class="choice-group">
            <legend>Momentos del dia</legend>
            ${MEAL_TYPES.map((mealType) => `
              <label class="checkbox-card">
                <input type="checkbox" name="mealTypes" value="${mealType}" checked />
                <span>${MEAL_TYPE_LABELS[mealType]}</span>
              </label>
            `).join('')}
          </fieldset>

          <div class="ingredient-builder">
            <div class="section-heading compact">
              <h3>Ingredientes por racion</h3>
              <button class="button ghost small" type="button" data-action="add-ingredient-row">+</button>
            </div>
            ${this.state.ingredientRows.map((row) => this.renderIngredientRow(row, dashboard.pantryItems)).join('')}
          </div>

          <button class="button full" type="submit" ${dashboard.pantryItems.length === 0 ? 'disabled' : ''}>
            Crear receta
          </button>
        </form>

        <div class="bulk-actions">
          <button class="button ghost full" type="button" data-action="clear-recipes" ${dashboard.recipes.length === 0 ? 'disabled' : ''}>
            Vaciar recetas
          </button>
        </div>
      </section>

      <section class="list-section" aria-label="Recetas guardadas">
        ${dashboard.recipes.length === 0 ? this.renderEmptyState('Todavia no hay recetas.') : ''}
        ${dashboard.recipes.map((recipe) => this.renderRecipe(recipe, dashboard.pantryItems)).join('')}
      </section>
    `;
  }

  /**
   * Renderiza una fila dinamica de ingrediente.
   *
   * @param {{id: string, pantryItemId: string, quantity: string}} row Estado de fila.
   * @param {import('../domain/types.js').PantryItem[]} pantryItems Alimentos.
   * @param {{rowAttribute?: string, removeAction?: string}} [options] Atributos y acciones para reutilizar en edicion.
   * @returns {string} HTML.
   */
  renderIngredientRow(row, pantryItems, options = {}) {
    const rowAttribute = options.rowAttribute ?? 'data-ingredient-row';
    const removeAction = options.removeAction ?? 'remove-ingredient-row';

    return `
      <div class="ingredient-row" ${rowAttribute}="${row.id}">
        <label>
          Alimento
          <select name="ingredientItem" required>
            <option value="">Selecciona</option>
            ${pantryItems.map((item) => `
              <option value="${item.id}" ${row.pantryItemId === item.id ? 'selected' : ''}>
                ${escapeHtml(item.name)} (${escapeHtml(item.unit)})
              </option>
            `).join('')}
          </select>
        </label>
        <label>
          Cantidad
          <input name="ingredientQuantity" type="number" inputmode="decimal" step="0.01" min="0.01" value="${row.quantity}" required />
        </label>
        <button class="icon-button ingredient-remove" type="button" aria-label="Quitar ingrediente" data-action="${removeAction}" data-id="${row.id}">
          x
        </button>
      </div>
    `;
  }

  /**
   * Renderiza una receta.
   *
   * @param {import('../domain/types.js').Recipe} recipe Receta.
   * @param {import('../domain/types.js').PantryItem[]} pantryItems Alimentos.
   * @returns {string} HTML.
   */
  renderRecipe(recipe, pantryItems) {
    if (this.state.editingRecipeId === recipe.id) {
      return this.renderRecipeEditForm(recipe, pantryItems);
    }

    const pantryById = new Map(pantryItems.map((item) => [item.id, item]));
    const ingredients = recipe.ingredients
      .map((ingredient) => {
        const item = pantryById.get(ingredient.pantryItemId);
        return item ? `${formatQuantity(ingredient.quantity)} ${escapeHtml(item.unit)} ${escapeHtml(item.name)}` : 'Ingrediente no encontrado';
      })
      .join(', ');

    return `
      <article class="list-card vertical">
        <div class="card-header">
          <div>
            <h3>${escapeHtml(recipe.name)}</h3>
            <p>${recipe.mealTypes.map((mealType) => MEAL_TYPE_LABELS[mealType]).join(' · ')}</p>
          </div>
          <div class="inline-actions">
            <button class="button ghost small" type="button" data-action="edit-recipe" data-id="${recipe.id}">
              Editar
            </button>
            <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(recipe.name)}" data-action="delete-recipe" data-id="${recipe.id}">
              x
            </button>
          </div>
        </div>
        <p class="muted">${ingredients}</p>
      </article>
    `;
  }

  /**
   * Renderiza el formulario inline para editar una receta existente.
   *
   * @param {import('../domain/types.js').Recipe} recipe Receta.
   * @param {import('../domain/types.js').PantryItem[]} pantryItems Alimentos.
   * @returns {string} HTML.
   */
  renderRecipeEditForm(recipe, pantryItems) {
    const draft = this.state.editRecipeDraft ?? {
      name: recipe.name,
      mealTypes: recipe.mealTypes,
    };
    const rows = this.state.editIngredientRows.length > 0
      ? this.state.editIngredientRows
      : recipe.ingredients.map((ingredient) =>
          createIngredientRow({
            pantryItemId: ingredient.pantryItemId,
            quantity: String(ingredient.quantity),
          }),
        );

    return `
      <article class="list-card vertical recipe-edit-card">
        <form class="stacked-form" data-form="recipe-edit">
          <input type="hidden" name="recipeId" value="${escapeAttribute(recipe.id)}" />
          <label>
            Nombre
            <input name="name" type="text" autocomplete="off" value="${escapeAttribute(draft.name)}" required />
          </label>

          <fieldset class="choice-group">
            <legend>Momentos del dia</legend>
            ${MEAL_TYPES.map((mealType) => `
              <label class="checkbox-card">
                <input type="checkbox" name="mealTypes" value="${mealType}" ${draft.mealTypes.includes(mealType) ? 'checked' : ''} />
                <span>${MEAL_TYPE_LABELS[mealType]}</span>
              </label>
            `).join('')}
          </fieldset>

          <div class="ingredient-builder">
            <div class="section-heading compact">
              <h3>Ingredientes por racion</h3>
              <button class="button ghost small" type="button" data-action="add-edit-ingredient-row">+</button>
            </div>
            ${rows.map((row) =>
              this.renderIngredientRow(row, pantryItems, {
                rowAttribute: 'data-edit-ingredient-row',
                removeAction: 'remove-edit-ingredient-row',
              }),
            ).join('')}
          </div>

          <div class="form-actions">
            <button class="button" type="submit">Guardar</button>
            <button class="button ghost" type="button" data-action="cancel-edit-recipe">Cancelar</button>
          </div>
        </form>
      </article>
    `;
  }

  /**
   * Renderiza la vista de planificacion.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPlanView(dashboard) {
    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Siguiente semana</p>
            <h2>Planificacion</h2>
          </div>
          <span class="counter">${dashboard.plannedMeals.length}</span>
        </div>

        <form class="plan-actions" data-form="plan-week">
          <label>
            Raciones por comida
            <input name="servings" type="number" inputmode="decimal" min="0.5" step="0.5" value="1" required />
          </label>
          <button class="button" type="submit" data-plan-mode="reset">Planificar semana</button>
          <button class="button ghost" type="submit" data-plan-mode="complete">Completar huecos</button>
          <button class="button ghost" type="button" data-action="clear-plan">Vaciar plan</button>
        </form>
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
  }

  /**
   * Renderiza herramientas de exportacion e importacion de datos locales.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderSettingsView(dashboard) {
    const totalStoredMeals = dashboard.plannedMeals.length + dashboard.pendingMeals.length;

    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Copia local</p>
            <h2>Datos</h2>
          </div>
        </div>

        <div class="data-stats" aria-label="Datos guardados">
          <span><strong>${dashboard.pantryItems.length}</strong> alimentos</span>
          <span><strong>${dashboard.recipes.length}</strong> recetas</span>
          <span><strong>${totalStoredMeals}</strong> comidas</span>
        </div>

        <div class="settings-actions">
          <button class="button full" type="button" data-action="export-backup">Exportar copia</button>
          <button class="button ghost full danger-action" type="button" data-action="clear-all-data" ${totalStoredMeals + dashboard.recipes.length + dashboard.pantryItems.length === 0 ? 'disabled' : ''}>
            Borrar todo
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="section-heading compact">
          <h2>Importar</h2>
        </div>

        <form class="stacked-form" data-form="import-backup">
          <label>
            Archivo JSON
            <input name="backupFile" type="file" accept=".json,application/json" required />
          </label>
          <button class="button full" type="submit">Importar y reemplazar</button>
        </form>
      </section>
    `;
  }

  /**
   * Renderiza lista de compra agregada.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
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
  }

  /**
   * Renderiza los alimentos agregados que faltan en el plan.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
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
  }

  /**
   * Renderiza las comidas que no se podrian preparar sin comprar antes.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
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
  }

  /**
   * Agrupa la planificacion por dia.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
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
        <section class="day-group">
          <h3>${formatDate(date)}</h3>
          ${meals.map((meal) => this.renderPlannedMeal(meal, dashboard.recipes, dashboard.unavailableMeals)).join('')}
          ${dashboard.missingPlanSlots
            .filter((slot) => slot.date === date)
            .map((slot) => this.renderMissingMealSlot(slot, dashboard.recipes))
            .join('')}
        </section>
      `)
      .join('');
  }

  /**
   * Renderiza una comida planificada.
   *
   * @param {import('../domain/types.js').PlannedMeal} meal Comida.
   * @param {import('../domain/types.js').Recipe[]} recipes Recetas.
   * @param {import('../domain/types.js').UnavailablePlannedMeal[]} unavailableMeals Comidas sin stock suficiente.
   * @returns {string} HTML.
   */
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
  }

  /**
   * Renderiza el formulario inline para editar una comida planificada.
   *
   * @param {import('../domain/types.js').PlannedMeal} meal Comida.
   * @param {import('../domain/types.js').Recipe[]} recipes Recetas disponibles.
   * @returns {string} HTML.
   */
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
  }

  /**
   * Renderiza un hueco libre para añadir una comida compatible.
   *
   * @param {import('../domain/types.js').MealSlot} slot Hueco sin comida.
   * @param {import('../domain/types.js').Recipe[]} recipes Recetas disponibles.
   * @returns {string} HTML.
   */
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
        <button class="button small" type="submit">añadir</button>
      </form>
    `;
  }

  /**
   * Renderiza un estado vacio reutilizable.
   *
   * @param {string} text Texto.
   * @returns {string} HTML.
   */
  renderEmptyState(text) {
    return `<p class="empty-state">${text}</p>`;
  }
}

/**
 * Crea una fila de ingrediente para el formulario.
 *
 * @param {{pantryItemId?: string, quantity?: string}} [initialValues] Valores iniciales.
 * @returns {{id: string, pantryItemId: string, quantity: string}} Estado inicial.
 */
function createIngredientRow(initialValues = {}) {
  return {
    id: createUiId('ingredient'),
    pantryItemId: initialValues.pantryItemId ?? '',
    quantity: initialValues.quantity ?? '',
  };
}

/**
 * Crea un identificador efimero para estado local de interfaz.
 *
 * @param {string} prefix Prefijo legible.
 * @returns {string} Identificador de UI.
 */
function createUiId(prefix) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())}`;
}

/**
 * Formatea cantidades evitando decimales innecesarios.
 *
 * @param {number} value Cantidad.
 * @returns {string} Cantidad visible.
 */
function formatQuantity(value) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatea fechas para lectura en movil.
 *
 * @param {string} isoDate Fecha YYYY-MM-DD.
 * @returns {string} Fecha visible.
 */
function formatDate(isoDate) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(fromISODate(isoDate));
}

/**
 * Renderiza opciones de unidad conservando unidades importadas no predefinidas.
 *
 * @param {string} [selectedUnit] Unidad seleccionada.
 * @returns {string} HTML de opciones.
 */
function renderUnitOptions(selectedUnit) {
  const units = selectedUnit && !DEFAULT_UNITS.includes(selectedUnit)
    ? [...DEFAULT_UNITS, selectedUnit]
    : [...DEFAULT_UNITS];

  return units
    .map((unit) => `
      <option value="${escapeAttribute(unit)}" ${selectedUnit === unit ? 'selected' : ''}>
        ${escapeHtml(unit)}
      </option>
    `)
    .join('');
}

/**
 * Escapa texto dinamico antes de insertarlo en plantillas HTML.
 *
 * @param {unknown} value Valor dinamico.
 * @returns {string} Texto seguro para contenido HTML.
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Escapa texto dinamico usado en atributos HTML.
 *
 * @param {unknown} value Valor dinamico.
 * @returns {string} Texto seguro para atributo.
 */
function escapeAttribute(value) {
  return escapeHtml(value);
}
