/**
 * Acciones globales de click que no pertenecen a una pantalla concreta.
 */
export const appClickActionMethods = {
  handleAppClickAction({ action }) {
    if (action !== 'dismiss-toast') {
      return null;
    }

    this.dismissToast();
    return { shouldRefresh: false };
  },
};
