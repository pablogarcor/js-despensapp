const DB_NAME = 'despensapp';
const DB_VERSION = 1;

/**
 * Cliente minimo para IndexedDB con una API basada en promesas.
 *
 * La aplicacion usa IndexedDB porque funciona en navegadores moviles modernos,
 * no requiere backend para el MVP y permite persistir datos estructurados.
 */
export class IndexedDbClient {
  constructor() {
    /** @type {IDBDatabase | null} */
    this.db = null;
  }

  /**
   * Abre la base de datos y aplica las migraciones de object stores.
   *
   * @returns {Promise<void>}
   */
  async open() {
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains('pantryItems')) {
          const pantryStore = database.createObjectStore('pantryItems', { keyPath: 'id' });
          pantryStore.createIndex('by_name', 'name', { unique: false });
        }

        if (!database.objectStoreNames.contains('recipes')) {
          const recipeStore = database.createObjectStore('recipes', { keyPath: 'id' });
          recipeStore.createIndex('by_name', 'name', { unique: false });
        }

        if (!database.objectStoreNames.contains('plannedMeals')) {
          const mealStore = database.createObjectStore('plannedMeals', { keyPath: 'id' });
          mealStore.createIndex('by_date', 'date', { unique: false });
          mealStore.createIndex('by_recipe', 'recipeId', { unique: false });
        }

        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Lee todos los registros de una tabla.
   *
   * @template T
   * @param {string} storeName Nombre de la object store.
   * @returns {Promise<T[]>} Registros guardados.
   */
  async getAll(storeName) {
    const store = this.getStore(storeName, 'readonly');
    return this.toPromise(store.getAll());
  }

  /**
   * Lee un registro por clave primaria.
   *
   * @template T
   * @param {string} storeName Nombre de la object store.
   * @param {string} id Clave primaria.
   * @returns {Promise<T | undefined>} Registro encontrado.
   */
  async get(storeName, id) {
    const store = this.getStore(storeName, 'readonly');
    return this.toPromise(store.get(id));
  }

  /**
   * Inserta o reemplaza un registro.
   *
   * @template T
   * @param {string} storeName Nombre de la object store.
   * @param {T} record Registro completo.
   * @returns {Promise<T>} Registro persistido.
   */
  async put(storeName, record) {
    const store = this.getStore(storeName, 'readwrite');
    await this.toPromise(store.put(record));
    return record;
  }

  /**
   * Inserta o reemplaza varios registros en una misma transaccion.
   *
   * @template T
   * @param {string} storeName Nombre de la object store.
   * @param {T[]} records Registros completos.
   * @returns {Promise<T[]>} Registros persistidos.
   */
  async bulkPut(storeName, records) {
    if (records.length === 0) {
      return records;
    }

    const database = this.requireDatabase();
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    for (const record of records) {
      store.put(record);
    }

    await this.transactionDone(transaction);
    return records;
  }

  /**
   * Elimina un registro por clave primaria.
   *
   * @param {string} storeName Nombre de la object store.
   * @param {string} id Clave primaria.
   * @returns {Promise<void>}
   */
  async delete(storeName, id) {
    const store = this.getStore(storeName, 'readwrite');
    await this.toPromise(store.delete(id));
  }

  /**
   * Elimina todos los registros que cumplan un predicado.
   *
   * @template T
   * @param {string} storeName Nombre de la object store.
   * @param {(record: T) => boolean} predicate Condicion de borrado.
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
   * Reemplaza por completo varias tablas en una unica transaccion.
   *
   * @param {Record<string, Array<unknown>>} recordsByStore Registros por tabla.
   * @returns {Promise<void>}
   */
  async replaceStores(recordsByStore) {
    const database = this.requireDatabase();
    const storeNames = Object.keys(recordsByStore);
    const transaction = database.transaction(storeNames, 'readwrite');

    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName);
      store.clear();

      for (const record of recordsByStore[storeName]) {
        store.put(record);
      }
    }

    await this.transactionDone(transaction);
  }

  /**
   * Devuelve una object store validando que la base de datos este abierta.
   *
   * @param {string} storeName Nombre de la object store.
   * @param {IDBTransactionMode} mode Modo de transaccion.
   * @returns {IDBObjectStore} Store solicitada.
   */
  getStore(storeName, mode) {
    const database = this.requireDatabase();
    return database.transaction(storeName, mode).objectStore(storeName);
  }

  /**
   * Valida que IndexedDB este inicializada.
   *
   * @returns {IDBDatabase} Base de datos abierta.
   */
  requireDatabase() {
    if (!this.db) {
      throw new Error('IndexedDB no esta abierta. Llama a open() antes de usarla.');
    }

    return this.db;
  }

  /**
   * Convierte una peticion IndexedDB en promesa.
   *
   * @template T
   * @param {IDBRequest<T>} request Peticion nativa.
   * @returns {Promise<T>} Resultado.
   */
  toPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Espera a que una transaccion termine o falle.
   *
   * @param {IDBTransaction} transaction Transaccion activa.
   * @returns {Promise<void>}
   */
  transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
