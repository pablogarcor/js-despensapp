/**
 * Error de negocio que puede mostrarse al usuario sin exponer detalles internos.
 */
export class DomainError extends Error {
  /**
   * Crea un error de dominio.
   *
   * @param {string} message Mensaje claro para interfaz y tests.
   * @param {string} [code='DOMAIN_ERROR'] Codigo estable para ramificaciones.
   */
  constructor(message, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
