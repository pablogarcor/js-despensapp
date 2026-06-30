import { escapeAttribute, escapeHtml, renderUnitOptions } from '../renderUtils.js';
import { renderIcon } from './icons.js';

/**
 * Metodos compartidos para hojas inferiores y formularios compactos.
 */
export const actionSheetRenderMethods = {
  renderActionSheet(options) {
    return renderActionSheet(options);
  },

  renderSheetContext({ icon, label, title, detail = '', className = '', iconClass = '' }) {
    return `
      <div class="sheet-context ${escapeAttribute(className)}">
        <span class="sheet-context-icon ${escapeAttribute(iconClass)}" aria-hidden="true">${renderIcon(icon)}</span>
        <div class="sheet-context-copy">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(title)}</strong>
          ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
        </div>
      </div>
    `;
  },

  renderSheetActions({
    submitLabel,
    cancelAction,
    submitIcon = '',
    submitType = 'submit',
    submitAction = '',
    submitData = {},
    submitClassName = '',
    submitDisabled = false,
    cancelLabel = 'Cancelar',
  }) {
    const dataAction = submitAction ? ` data-action="${escapeAttribute(submitAction)}"` : '';
    const dataAttributes = renderActionSheetDataAttributes(submitData);

    return `
      <div class="meal-edit-sheet-actions">
        <button
          class="button full ${escapeAttribute(submitClassName)}"
          type="${escapeAttribute(submitType)}"
          ${dataAction}
          ${dataAttributes}
          ${submitDisabled ? 'disabled' : ''}
        >
          ${submitIcon ? renderIcon(submitIcon) : ''}${escapeHtml(submitLabel)}
        </button>
        <button class="meal-edit-cancel" type="button" data-action="${escapeAttribute(cancelAction)}">
          ${escapeHtml(cancelLabel)}
        </button>
      </div>
    `;
  },

  renderEntityFields({
    name = '',
    namePlaceholder = '',
    quantity = '',
    quantityMin = '0',
    quantityPlaceholder = '0',
    unit = '',
  } = {}) {
    return `
      <label class="meal-edit-field">
        <span>Nombre</span>
        <input
          name="name"
          type="text"
          autocomplete="off"
          ${name ? `value="${escapeAttribute(name)}"` : ''}
          ${namePlaceholder ? `placeholder="${escapeAttribute(namePlaceholder)}"` : ''}
          required
        />
      </label>
      <div class="form-grid">
        <label class="meal-edit-field">
          <span>Cantidad</span>
          <input
            name="quantity"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="${escapeAttribute(quantityMin)}"
            ${quantity !== '' ? `value="${escapeAttribute(quantity)}"` : ''}
            ${quantityPlaceholder ? `placeholder="${escapeAttribute(quantityPlaceholder)}"` : ''}
            required
          />
        </label>
        <label class="meal-edit-field">
          <span>Unidad</span>
          <select name="unit" required>
            ${renderUnitOptions(unit)}
          </select>
        </label>
      </div>
    `;
  },

  renderDeleteConfirmationSheet({
    title,
    titleId,
    dismissAction,
    itemLabel,
    itemName,
    question,
    confirmLabel,
    confirmAction,
    itemId,
    className = '',
  }) {
    return this.renderActionSheet({
      title,
      titleId,
      dismissAction,
      className: `meal-edit-sheet delete-confirm-sheet ${className}`,
      visibleTitle: true,
      body: `
        <div class="meal-edit-sheet-body delete-confirm-sheet-body">
          ${this.renderSheetContext({
            icon: 'delete',
            label: itemLabel,
            title: itemName,
            detail: question,
            className: 'delete-confirm-context',
            iconClass: 'delete-confirm-icon',
          })}
        </div>
      `,
      footer: this.renderSheetActions({
        submitLabel: confirmLabel,
        submitIcon: 'delete',
        submitType: 'button',
        submitAction: confirmAction,
        submitData: { id: itemId },
        submitClassName: 'delete-confirm-button',
        cancelAction: dismissAction,
      }),
    });
  },
};

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
    <section
      class="${escapeAttribute(sheetClass)}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${escapeAttribute(titleId)}"
      data-dismiss-action="${escapeAttribute(dismissAction)}"
    >
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
