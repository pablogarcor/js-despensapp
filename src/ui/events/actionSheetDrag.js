const ACTION_SHEET_MIN_DISMISS_DISTANCE = 56;
const ACTION_SHEET_MAX_DISMISS_DISTANCE = 112;
const ACTION_SHEET_DISMISS_RATIO = 0.22;
const ACTION_SHEET_DISMISS_ANIMATION_MS = 140;

/**
 * Metodos de arrastre y cierre tactil de hojas inferiores.
 */
export const actionSheetDragMethods = {
  /**
   * Inicia el arrastre vertical de una hoja modal desde su tirador superior.
   *
   * @param {PointerEvent} event Evento de puntero.
   */
  handleActionSheetPointerDown(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const handle = event.target.closest('.action-sheet-handle');

    if (!handle || this.state.isBusy || event.button !== 0) {
      return;
    }

    const sheet = handle.closest('.action-sheet');
    const dismissAction = sheet?.dataset.dismissAction;

    if (!sheet || !dismissAction) {
      return;
    }

    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    sheet.classList.add('is-dragging');
    sheet.style.setProperty('--action-sheet-drag-offset', '0px');
    this.actionSheetDrag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      sheet,
      handle,
      dismissAction,
      sheetHeight: sheet.getBoundingClientRect().height,
    };
  },

  /**
   * Mueve la hoja activa siguiendo el dedo, solo hacia abajo.
   *
   * @param {PointerEvent} event Evento de puntero.
   */
  handleActionSheetPointerMove(event) {
    const drag = this.actionSheetDrag;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const offset = Math.max(0, event.clientY - drag.startY);
    drag.sheet.style.setProperty('--action-sheet-drag-offset', `${Math.round(offset)}px`);

    if (offset > 0) {
      event.preventDefault();
    }
  },

  /**
   * Finaliza el arrastre y cierra la hoja si se supero el umbral.
   *
   * @param {PointerEvent} event Evento de puntero.
   */
  handleActionSheetPointerUp(event) {
    const drag = this.actionSheetDrag;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const offset = Math.max(0, event.clientY - drag.startY);
    const threshold = getActionSheetDismissThreshold(drag.sheetHeight);
    this.finishActionSheetDrag(offset >= threshold);
  },

  /**
   * Cancela un arrastre activo devolviendo la hoja a su posicion inicial.
   *
   * @param {PointerEvent} event Evento de puntero.
   */
  handleActionSheetPointerCancel(event) {
    const drag = this.actionSheetDrag;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this.finishActionSheetDrag(false);
  },

  /**
   * Limpia estado visual del arrastre y ejecuta el cierre si procede.
   *
   * @param {boolean} shouldDismiss Si la hoja debe cerrarse.
   */
  finishActionSheetDrag(shouldDismiss) {
    const drag = this.actionSheetDrag;

    if (!drag) {
      return;
    }

    this.actionSheetDrag = null;
    if (drag.handle.hasPointerCapture?.(drag.pointerId)) {
      drag.handle.releasePointerCapture(drag.pointerId);
    }
    drag.sheet.classList.remove('is-dragging');

    if (!shouldDismiss) {
      drag.sheet.style.removeProperty('--action-sheet-drag-offset');
      return;
    }

    drag.sheet.classList.add('is-dismissing');
    drag.sheet.style.setProperty('--action-sheet-drag-offset', `${Math.ceil(drag.sheetHeight + 32)}px`);

    window.setTimeout(() => {
      this.dismissActionSheet(drag.dismissAction);
    }, ACTION_SHEET_DISMISS_ANIMATION_MS);
  },

  /**
   * Cierra una hoja modal usando la misma accion que sus botones de cancelar.
   *
   * @param {string} action Accion de cierre declarada por la hoja.
   */
  dismissActionSheet(action) {
    if (this.applyActionSheetDismiss(action)) {
      this.render();
    }
  },
};

/**
 * Calcula cuanto hay que arrastrar una hoja para cerrarla.
 *
 * @param {number} sheetHeight Alto actual de la hoja.
 * @returns {number} Distancia en pixeles.
 */
function getActionSheetDismissThreshold(sheetHeight) {
  const proportionalDistance = sheetHeight * ACTION_SHEET_DISMISS_RATIO;

  return Math.min(
    ACTION_SHEET_MAX_DISMISS_DISTANCE,
    Math.max(ACTION_SHEET_MIN_DISMISS_DISTANCE, proportionalDistance),
  );
}
