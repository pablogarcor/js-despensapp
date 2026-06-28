import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import { escapeAttribute, escapeHtml, formatDate } from '../renderUtils.js';

/**
 * Metodos de render compartidos por varias vistas.
 */
export const commonRenderMethods = {
  renderIcon(name) {
    return renderIcon(name);
  },

  renderActionSheet(options) {
    return renderActionSheet(options);
  },

  renderTab(view, label) {
    const isActive = this.state.activeView === view;
    return `
      <button class="tab ${isActive ? 'is-active' : ''}" type="button" data-view="${view}" aria-pressed="${isActive}" ${isActive ? 'aria-current="page"' : ''}>
        ${renderIcon(TAB_ICONS[view] ?? 'calendar')}
        <span>${label}</span>
      </button>
    `;
  },

  renderMealTypeBadge(mealType, extraClass = '') {
    return `<span class="meal-type-badge meal-type-${mealType} ${extraClass}">${MEAL_TYPE_LABELS[mealType]}</span>`;
  },

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

  renderToast() {
    if (!this.state.toast) {
      return '';
    }

    const toast = this.state.toast;
    const role = toast.type === 'error' ? 'alert' : 'status';

    return `
      <div class="toast ${toast.type === 'error' ? 'is-error' : ''}" role="${role}" aria-live="${toast.type === 'error' ? 'assertive' : 'polite'}">
        <span>${escapeHtml(toast.message)}</span>
        <button class="toast-close" type="button" data-action="dismiss-toast" aria-label="Cerrar aviso">${renderIcon('close')}</button>
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
          <label class="search-field">
            <span class="search-label-row">
              <span class="visually-hidden">${label}</span>
              <small>${visibleCount} de ${totalCount}</small>
            </span>
            <span class="search-icon" aria-hidden="true">${renderIcon('search')}</span>
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
              ? `<button class="search-clear" type="button" data-action="${clearAction}" aria-label="Limpiar busqueda">${renderIcon('close')}</button>`
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

const TAB_ICONS = Object.freeze({
  plan: 'weeklyPlan',
  pantry: 'pantry',
  recipes: 'recipes',
  shopping: 'shoppingList',
});

/**
 * Renderiza una hoja modal inferior reusable para grupos de acciones.
 *
 * @param {{
 *   title: string,
 *   titleId?: string,
 *   dismissAction: string,
 *   className?: string,
 *   visibleTitle?: boolean,
 *   form?: {
 *     className?: string,
 *     dataForm?: string,
 *     hiddenInputs?: Array<{ name: string, value: string }>
 *   },
 *   body?: string,
 *   footer?: string,
 *   actions?: Array<{
 *     label: string,
 *     icon: string,
 *     type?: string,
 *     action?: string,
 *     variant?: string,
 *     data?: Record<string, string>,
 *     separated?: boolean
 *   }>
 * }} options Configuracion de la hoja.
 * @returns {string} HTML de la hoja.
 */
function renderActionSheet({
  title,
  titleId = 'action-sheet-title',
  dismissAction,
  className = '',
  visibleTitle = false,
  form,
  body = '',
  footer = '',
  actions = [],
}) {
  const list = actions.length > 0
    ? `
      <div class="action-sheet-list">
        ${actions.map(renderActionSheetAction).join('')}
      </div>
    `
    : '';
  const content = `
    ${renderActionSheetHiddenInputs(form?.hiddenInputs ?? [])}
    ${body}
    ${list}
    ${footer}
  `;
  const formAttributes = form ? renderActionSheetFormAttributes(form) : '';
  const sheetClass = ['action-sheet', visibleTitle ? 'has-visible-title' : '', className]
    .filter(Boolean)
    .join(' ');
  const titleMarkup = visibleTitle
    ? `
      <header class="action-sheet-header">
        <h2 id="${escapeAttribute(titleId)}">${escapeHtml(title)}</h2>
        <button class="action-sheet-close" type="button" data-action="${escapeAttribute(dismissAction)}" aria-label="Cerrar">
          ${renderIcon('close')}
        </button>
      </header>
    `
    : `<h2 class="visually-hidden" id="${escapeAttribute(titleId)}">${escapeHtml(title)}</h2>`;

  return `
    <div class="action-sheet-backdrop" role="presentation" data-action="${escapeAttribute(dismissAction)}"></div>
    <section class="${escapeAttribute(sheetClass)}" role="dialog" aria-modal="true" aria-labelledby="${escapeAttribute(titleId)}">
      <div class="action-sheet-handle" aria-hidden="true"></div>
      ${titleMarkup}
      ${
        form
          ? `<form${formAttributes ? ` ${formAttributes}` : ''}>${content}</form>`
          : content
      }
    </section>
  `;
}

/**
 * Renderiza una fila de accion para una hoja modal inferior.
 *
 * @param {{
 *   label: string,
 *   icon: string,
 *   type?: string,
 *   action?: string,
 *   variant?: string,
 *   data?: Record<string, string>,
 *   separated?: boolean
 * }} action Accion a renderizar.
 * @returns {string} HTML de la fila.
 */
function renderActionSheetAction(action) {
  const type = action.type ?? 'button';
  const variant = action.variant ? ` is-${action.variant}` : '';
  const dataAction = action.action ? ` data-action="${escapeAttribute(action.action)}"` : '';
  const dataAttributes = renderActionSheetDataAttributes(action.data ?? {});
  const separator = action.separated ? '<div class="action-sheet-divider" aria-hidden="true"></div>' : '';

  return `
    ${separator}
    <button class="action-sheet-action${variant}" type="${escapeAttribute(type)}"${dataAction}${dataAttributes}>
      <span class="action-sheet-icon">${renderIcon(action.icon)}</span>
      <span>${escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Renderiza atributos seguros del formulario de una hoja de acciones.
 *
 * @param {{ className?: string, dataForm?: string }} form Configuracion del formulario.
 * @returns {string} Atributos HTML.
 */
function renderActionSheetFormAttributes(form) {
  const attributes = [];

  if (form.className) {
    attributes.push(`class="${escapeAttribute(form.className)}"`);
  }

  if (form.dataForm) {
    attributes.push(`data-form="${escapeAttribute(form.dataForm)}"`);
  }

  return attributes.join(' ');
}

/**
 * Renderiza campos ocultos seguros para formularios de hojas de acciones.
 *
 * @param {Array<{ name: string, value: string }>} hiddenInputs Campos ocultos.
 * @returns {string} Inputs ocultos.
 */
function renderActionSheetHiddenInputs(hiddenInputs) {
  return hiddenInputs.map((input) => `
    <input type="hidden" name="${escapeAttribute(input.name)}" value="${escapeAttribute(input.value)}" />
  `).join('');
}

/**
 * Renderiza atributos data-* de una accion.
 *
 * @param {Record<string, string>} data Datos de la accion.
 * @returns {string} Atributos data-*.
 */
function renderActionSheetDataAttributes(data) {
  return Object.entries(data)
    .map(([name, value]) => ` data-${toKebabCase(name)}="${escapeAttribute(value)}"`)
    .join('');
}

/**
 * Convierte una clave camelCase sencilla a kebab-case.
 *
 * @param {string} value Clave a convertir.
 * @returns {string} Clave en kebab-case.
 */
function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const ICON_PATHS = Object.freeze({
  add: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  autoFill: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/>',
  breakfast: '<path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9Z"/><path d="M12 8v4l3 3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  delete: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  dinner: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  done: '<polyline points="20 6 9 17 4 12"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  import: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  lunch: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  pantry: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  noUtensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/><line x1="2" y1="2" x2="22" y2="22"/>',
  recipes: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  shoppingList: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  skipped: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  stockMinus: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
  stockPlus: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  weeklyPlan: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
});

/**
 * Renderiza iconos SVG inline sin depender de librerias externas.
 *
 * @param {string} name Nombre del icono.
 * @returns {string} SVG seguro.
 */
function renderIcon(name) {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.calendar;

  return `
    <svg class="ui-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      ${paths}
    </svg>
  `;
}
