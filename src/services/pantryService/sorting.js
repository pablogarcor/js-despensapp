/**
 * Ordena entidades que tienen nombre visible.
 *
 * @template T
 * @param {(T & {name: string})[]} records Registros.
 * @returns {T[]} Nueva lista ordenada.
 */
export function sortByName(records) {
  return [...records].sort((left, right) => left.name.localeCompare(right.name, 'es'));
}
