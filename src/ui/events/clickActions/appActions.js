/**
 * Acciones globales de click que no pertenecen a una pantalla concreta.
 */
export const appClickActionMethods = {
  async handleAppClickAction({ action }) {
    if (action === 'dismiss-toast') {
      this.dismissToast();
      return { shouldRefresh: false };
    }

    if (action !== 'undo-toast') {
      return null;
    }

    const undo = this.state.toast?.undo;

    if (!undo) {
      this.dismissToast();
      return { shouldRefresh: false };
    }

    this.clearToastTimeout();
    this.state.toast = null;
    await this.applyToastUndo(undo);
    this.showToast('Accion deshecha.');

    return { shouldRefresh: true };
  },
};
