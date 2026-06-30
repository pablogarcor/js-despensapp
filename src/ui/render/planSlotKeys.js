/**
 * Crea la clave de estado de un hueco de planificacion.
 *
 * @param {{date: string, mealType: string}} slot Hueco de plan.
 * @returns {string} Clave estable del hueco.
 */
export function getPlanSlotKey(slot) {
  return `${slot.date}__${slot.mealType}`;
}
