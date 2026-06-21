/**
 * Base de datos en memoria con la misma API que IndexedDbClient.
 *
 * Se usa en tests para validar reglas de negocio sin depender del navegador.
 */
export class MemoryDatabase {
  constructor() {
    this.stores = new Map([
      ['pantryItems', new Map()],
      ['recipes', new Map()],
      ['plannedMeals', new Map()],
      ['meta', new Map()],
    ]);
  }

  /**
   * Mantiene paridad con IndexedDbClient.
   *
   * @returns {Promise<void>}
   */
  async open() {}

  /**
   * Lee todos los registros de una tabla.
   *
   * @template T
   * @param {string} storeName Nombre de la tabla.
   * @returns {Promise<T[]>} Copia de los registros.
   */
  async getAll(storeName) {
    return [...this.requireStore(storeName).values()].map((record) => structuredClone(record));
  }

  /**
   * Lee un registro por id.
   *
   * @template T
   * @param {string} storeName Nombre de la tabla.
   * @param {string} id Identificador.
   * @returns {Promise<T | undefined>} Copia del registro.
   */
  async get(storeName, id) {
    const record = this.requireStore(storeName).get(id);
    return record ? structuredClone(record) : undefined;
  }

  /**
   * Inserta o reemplaza un registro.
   *
   * @template T
   * @param {string} storeName Nombre de la tabla.
   * @param {T & {id?: string, key?: string}} record Registro.
   * @returns {Promise<T>} Registro persistido.
   */
  async put(storeName, record) {
    const key = record.id ?? record.key;
    this.requireStore(storeName).set(key, structuredClone(record));
    return structuredClone(record);
  }

  /**
   * Inserta varios registros.
   *
   * @template T
   * @param {string} storeName Nombre de la tabla.
   * @param {T[]} records Registros.
   * @returns {Promise<T[]>} Registros persistidos.
   */
  async bulkPut(storeName, records) {
    for (const record of records) {
      await this.put(storeName, record);
    }

    return records;
  }

  /**
   * Elimina un registro por id.
   *
   * @param {string} storeName Nombre de la tabla.
   * @param {string} id Identificador.
   * @returns {Promise<void>}
   */
  async delete(storeName, id) {
    this.requireStore(storeName).delete(id);
  }

  /**
   * Elimina registros que cumplan un predicado.
   *
   * @template T
   * @param {string} storeName Nombre de la tabla.
   * @param {(record: T) => boolean} predicate Condicion.
   * @returns {Promise<number>} Numero de registros eliminados.
   */
  async deleteWhere(storeName, predicate) {
    const records = await this.getAll(storeName);
    const recordsToDelete = records.filter(predicate);

    for (const record of recordsToDelete) {
      await this.delete(storeName, record.id);
    }

    return recordsToDelete.length;
  }

  /**
   * Reemplaza por completo varias tablas.
   *
   * @param {Record<string, Array<unknown>>} recordsByStore Registros por tabla.
   * @returns {Promise<void>}
   */
  async replaceStores(recordsByStore) {
    for (const [storeName, records] of Object.entries(recordsByStore)) {
      const store = this.requireStore(storeName);
      store.clear();

      for (const record of records) {
        const key = record.id ?? record.key;
        store.set(key, structuredClone(record));
      }
    }
  }

  /**
   * Obtiene una store o lanza error si no existe.
   *
   * @param {string} storeName Nombre de la tabla.
   * @returns {Map<string, unknown>} Store interna.
   */
  requireStore(storeName) {
    const store = this.stores.get(storeName);

    if (!store) {
      throw new Error(`La tabla ${storeName} no existe.`);
    }

    return store;
  }
}
