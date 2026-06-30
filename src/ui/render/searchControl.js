import { escapeAttribute, escapeHtml } from '../renderUtils.js';
import { renderIcon } from './icons.js';

/**
 * Metodos compartidos para controles de busqueda.
 */
export const searchControlRenderMethods = {
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
              <span class="visually-hidden">${escapeHtml(label)}</span>
              <small>${visibleCount} de ${totalCount}</small>
            </span>
            <span class="search-icon" aria-hidden="true">${renderIcon('search')}</span>
            <input
              type="search"
              data-search="${escapeAttribute(target)}"
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
};
