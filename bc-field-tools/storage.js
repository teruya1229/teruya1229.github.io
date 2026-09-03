(() => {
  "use strict";

  const DB_NAME = "bc-field-diagnosis";
  const DB_VERSION = 1;
  const STORE_CASES = "cases";
  const STORE_PHOTOS = "photos";
  const STORE_SETTINGS = "settings";

  /** @type {IDBDatabase | null} */
  let db = null;
  let openPromise = null;
  let unavailableReason = "";

  function isIndexedDbAvailable() {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  function transactionDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
      tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction error"));
    });
  }

  function abortQuietly(tx) {
    try {
      tx.abort();
    } catch (_) {
      /* ignore */
    }
  }

  function makeError(name, message, extra) {
    return Object.assign(new Error(message), { name, ...(extra || {}) });
  }

  function isDeletedRecord(record) {
    if (!record) return false;
    return record.archiveState === "deleted" || record.state === "deleted";
  }

  /**
   * @returns {Promise<IDBDatabase>}
   */
  async function open() {
    if (db) return db;
    if (openPromise) return openPromise;
    if (!isIndexedDbAvailable()) {
      unavailableReason = "IndexedDBUnavailable";
      throw Object.assign(new Error("このブラウザではIndexedDBを利用できません。"), {
        name: "IndexedDBUnavailable",
      });
    }

    openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_CASES)) {
          const cases = database.createObjectStore(STORE_CASES, { keyPath: "id" });
          cases.createIndex("updatedAt", "updatedAt", { unique: false });
          cases.createIndex("byArchiveUpdated", ["archiveState", "updatedAt"], { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_PHOTOS)) {
          const photos = database.createObjectStore(STORE_PHOTOS, { keyPath: ["caseId", "slotKey"] });
          photos.createIndex("caseId", "caseId", { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
          database.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        db = request.result;
        db.onversionchange = () => {
          try {
            db && db.close();
          } catch (_) {
            /* ignore */
          }
          db = null;
          openPromise = null;
          window.dispatchEvent(
            new CustomEvent("bcfd:idb-versionchange", {
              detail: { message: "データベースが更新されました。ページを再読み込みしてください。" },
            })
          );
        };
        resolve(db);
      };

      request.onerror = () => {
        openPromise = null;
        unavailableReason = (request.error && request.error.name) || "UnknownError";
        reject(request.error || new Error("IndexedDB open failed"));
      };

      request.onblocked = () => {
        window.dispatchEvent(
          new CustomEvent("bcfd:idb-blocked", {
            detail: { message: "IndexedDBがブロックされています。他のタブを閉じてから再試行してください。" },
          })
        );
      };
    });

    return openPromise;
  }

  async function getDb() {
    return open();
  }

  /**
   * @returns {Promise<Array<object>>}
   */
  async function listCases() {
    const database = await getDb();
    const tx = database.transaction(STORE_CASES, "readonly");
    const store = tx.objectStore(STORE_CASES);
    const rows = /** @type {object[]} */ (await requestToPromise(store.getAll()));
    await transactionDone(tx);
    return rows
      .filter((row) => row && !isDeletedRecord(row))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  /**
   * @param {string} caseId
   */
  async function getCaseBundle(caseId) {
    if (!caseId) throw new Error("caseId is required");
    const database = await getDb();
    const tx = database.transaction([STORE_CASES, STORE_PHOTOS], "readonly");
    const caseStore = tx.objectStore(STORE_CASES);
    const photoStore = tx.objectStore(STORE_PHOTOS);
    const caseRecord = await requestToPromise(caseStore.get(caseId));
    const index = photoStore.index("caseId");
    const photos = /** @type {object[]} */ (await requestToPromise(index.getAll(caseId)));
    await transactionDone(tx);
    if (!caseRecord || isDeletedRecord(caseRecord)) return null;
    return { caseRecord, photos };
  }

  /**
   * Create a brand-new case. Never overwrites or resurrects an existing/tombstone id.
   * @param {{
   *   caseRecord: object,
   *   photoPuts?: object[],
   * }} payload
   */
  async function createCase(payload) {
    const { caseRecord, photoPuts = [] } = payload || {};
    if (!caseRecord || !caseRecord.id) {
      throw makeError("ValidationError", "caseRecord.id is required");
    }

    const database = await getDb();
    const tx = database.transaction([STORE_CASES, STORE_PHOTOS], "readwrite");
    const caseStore = tx.objectStore(STORE_CASES);
    const photoStore = tx.objectStore(STORE_PHOTOS);

    const existing = await requestToPromise(caseStore.get(caseRecord.id));
    if (existing) {
      abortQuietly(tx);
      if (isDeletedRecord(existing)) {
        throw makeError("CaseDeletedError", "Tombstone id cannot be reused", {
          caseId: caseRecord.id,
          revision: existing.revision,
        });
      }
      throw makeError("CaseConflictError", "Case id already exists", {
        caseId: caseRecord.id,
        currentRevision: existing.revision,
      });
    }

    const now = new Date().toISOString();
    const toSave = {
      ...caseRecord,
      revision: typeof caseRecord.revision === "number" ? caseRecord.revision : 0,
      updatedAt: caseRecord.updatedAt || now,
      createdAt: caseRecord.createdAt || now,
      recordVersion: caseRecord.recordVersion || 1,
      archiveState: "active",
    };

    try {
      await requestToPromise(caseStore.add(toSave));
    } catch (err) {
      abortQuietly(tx);
      if (err && err.name === "ConstraintError") {
        throw makeError("CaseConflictError", "Case id already exists", { caseId: caseRecord.id });
      }
      throw err;
    }

    for (const put of photoPuts) {
      if (!put || !put.caseId || !put.slotKey || !(put.blob instanceof Blob)) continue;
      await requestToPromise(
        photoStore.put({
          ...put,
          updatedAt: put.updatedAt || now,
          createdAt: put.createdAt || now,
        })
      );
    }

    await transactionDone(tx);
    return toSave;
  }

  /**
   * Atomic import of a fully-validated backup as a brand-new case.
   * Same transaction for case + all photos. Partial writes are not committed.
   * @param {{
   *   caseRecord: object,
   *   photoPuts: object[],
   * }} payload
   */
  async function createImportedCase(payload) {
    const { caseRecord, photoPuts = [] } = payload || {};
    if (!caseRecord || !caseRecord.id) {
      throw makeError("ValidationError", "caseRecord.id is required");
    }
    if (!Array.isArray(photoPuts)) {
      throw makeError("ValidationError", "photoPuts must be an array");
    }

    const database = await getDb();
    const tx = database.transaction([STORE_CASES, STORE_PHOTOS], "readwrite");
    const caseStore = tx.objectStore(STORE_CASES);
    const photoStore = tx.objectStore(STORE_PHOTOS);

    const existing = await requestToPromise(caseStore.get(caseRecord.id));
    if (existing) {
      abortQuietly(tx);
      if (isDeletedRecord(existing)) {
        throw makeError("CaseDeletedError", "Tombstone id cannot be reused", {
          caseId: caseRecord.id,
        });
      }
      throw makeError("CaseConflictError", "Case id already exists", {
        caseId: caseRecord.id,
      });
    }

    const now = new Date().toISOString();
    const toSave = {
      ...caseRecord,
      id: caseRecord.id,
      revision: 0,
      createdAt: caseRecord.createdAt || now,
      updatedAt: caseRecord.updatedAt || now,
      recordVersion: 1,
      archiveState: "active",
    };

    try {
      await requestToPromise(caseStore.add(toSave));
    } catch (err) {
      abortQuietly(tx);
      if (err && err.name === "ConstraintError") {
        throw makeError("CaseConflictError", "Case id already exists", { caseId: caseRecord.id });
      }
      throw err;
    }

    for (let i = 0; i < photoPuts.length; i++) {
      const put = photoPuts[i];
      if (!put || !put.caseId || !put.slotKey || !(put.blob instanceof Blob)) {
        abortQuietly(tx);
        throw makeError("ValidationError", "Invalid photoPut at index " + i);
      }
      if (put.caseId !== caseRecord.id) {
        abortQuietly(tx);
        throw makeError("ValidationError", "photoPut.caseId mismatch");
      }
      try {
        await requestToPromise(
          photoStore.put({
            caseId: put.caseId,
            slotKey: put.slotKey,
            phase: put.phase || "",
            blob: put.blob,
            fileName: put.fileName || "",
            mimeType: put.mimeType || "",
            size: put.size,
            lastModified: put.lastModified,
            createdAt: put.createdAt || now,
            updatedAt: put.updatedAt || now,
          })
        );
      } catch (err) {
        abortQuietly(tx);
        throw err;
      }
    }

    await transactionDone(tx);
    return toSave;
  }

  /**
   * Update an existing active case. Never creates or resurrects.
   * @param {{
   *   caseRecord: object,
   *   photoPuts?: object[],
   *   photoDeletes?: Array<{caseId: string, slotKey: string}>,
   *   expectedRevision: number
   * }} payload
   */
  async function updateExistingCase(payload) {
    const { caseRecord, photoPuts = [], photoDeletes = [], expectedRevision } = payload || {};
    if (!caseRecord || !caseRecord.id) {
      throw makeError("ValidationError", "caseRecord.id is required");
    }
    if (typeof expectedRevision !== "number") {
      throw makeError("ValidationError", "expectedRevision is required");
    }

    const database = await getDb();
    const tx = database.transaction([STORE_CASES, STORE_PHOTOS], "readwrite");
    const caseStore = tx.objectStore(STORE_CASES);
    const photoStore = tx.objectStore(STORE_PHOTOS);

    const existing = await requestToPromise(caseStore.get(caseRecord.id));
    if (!existing) {
      abortQuietly(tx);
      throw makeError("CaseMissingError", "Case not found", { caseId: caseRecord.id });
    }
    if (isDeletedRecord(existing)) {
      abortQuietly(tx);
      throw makeError("CaseDeletedError", "Case has been deleted", {
        caseId: caseRecord.id,
        revision: existing.revision,
      });
    }
    if (Number(existing.revision) !== Number(expectedRevision)) {
      abortQuietly(tx);
      throw makeError("CaseConflictError", "Revision conflict", {
        currentRevision: existing.revision,
        expectedRevision,
      });
    }

    const nextRevision = Number(expectedRevision) + 1;
    const now = new Date().toISOString();
    const toSave = {
      ...caseRecord,
      id: existing.id,
      createdAt: existing.createdAt || caseRecord.createdAt || now,
      revision: nextRevision,
      updatedAt: now,
      recordVersion: caseRecord.recordVersion || existing.recordVersion || 1,
      archiveState: "active",
    };

    await requestToPromise(caseStore.put(toSave));

    for (const del of photoDeletes) {
      if (!del || !del.caseId || !del.slotKey) continue;
      await requestToPromise(photoStore.delete([del.caseId, del.slotKey]));
    }

    for (const put of photoPuts) {
      if (!put || !put.caseId || !put.slotKey || !(put.blob instanceof Blob)) continue;
      await requestToPromise(
        photoStore.put({
          ...put,
          updatedAt: put.updatedAt || now,
          createdAt: put.createdAt || now,
        })
      );
    }

    await transactionDone(tx);
    return toSave;
  }

  /**
   * Soft-delete: replace case with minimal tombstone and remove photos in one tx.
   * @param {string} caseId
   * @param {number} expectedRevision
   */
  async function deleteCase(caseId, expectedRevision) {
    if (!caseId) throw new Error("caseId is required");
    if (typeof expectedRevision !== "number") {
      throw makeError("ValidationError", "expectedRevision is required");
    }

    const database = await getDb();
    const tx = database.transaction([STORE_CASES, STORE_PHOTOS, STORE_SETTINGS], "readwrite");
    const caseStore = tx.objectStore(STORE_CASES);
    const photoStore = tx.objectStore(STORE_PHOTOS);
    const settingsStore = tx.objectStore(STORE_SETTINGS);

    const existing = await requestToPromise(caseStore.get(caseId));
    if (!existing) {
      abortQuietly(tx);
      throw makeError("CaseMissingError", "Case not found", { caseId });
    }
    if (isDeletedRecord(existing)) {
      abortQuietly(tx);
      throw makeError("CaseDeletedError", "Case has already been deleted", {
        caseId,
        revision: existing.revision,
      });
    }
    if (Number(existing.revision) !== Number(expectedRevision)) {
      abortQuietly(tx);
      throw makeError("CaseConflictError", "Revision conflict on delete", {
        currentRevision: existing.revision,
        expectedRevision,
      });
    }

    const now = new Date().toISOString();
    const nextRevision = Number(expectedRevision) + 1;
    const tombstone = {
      id: caseId,
      recordVersion: 1,
      archiveState: "deleted",
      revision: nextRevision,
      createdAt: existing.createdAt || now,
      updatedAt: now,
      deletedAt: now,
    };

    const index = photoStore.index("caseId");
    const keys = /** @type {IDBValidKey[]} */ (await requestToPromise(index.getAllKeys(caseId)));
    for (const key of keys) {
      await requestToPromise(photoStore.delete(key));
    }

    await requestToPromise(caseStore.put(tombstone));

    const current = await requestToPromise(settingsStore.get("currentCaseId"));
    if (current && current.value === caseId) {
      await requestToPromise(settingsStore.put({ key: "currentCaseId", value: "" }));
    }

    await transactionDone(tx);
    return tombstone;
  }

  /**
   * @param {string} caseId
   */
  async function setCurrentCaseId(caseId) {
    const database = await getDb();
    const tx = database.transaction(STORE_SETTINGS, "readwrite");
    await requestToPromise(tx.objectStore(STORE_SETTINGS).put({ key: "currentCaseId", value: caseId || "" }));
    await transactionDone(tx);
  }

  async function getCurrentCaseId() {
    const database = await getDb();
    const tx = database.transaction(STORE_SETTINGS, "readonly");
    const row = await requestToPromise(tx.objectStore(STORE_SETTINGS).get("currentCaseId"));
    await transactionDone(tx);
    return row && typeof row.value === "string" ? row.value : "";
  }

  async function getStorageEstimate() {
    if (!navigator.storage || typeof navigator.storage.estimate !== "function") {
      return null;
    }
    try {
      const est = await navigator.storage.estimate();
      const usage = Number(est.usage) || 0;
      const quota = Number(est.quota) || 0;
      const ratio = quota > 0 ? usage / quota : null;
      return { usage, quota, ratio };
    } catch (_) {
      return null;
    }
  }

  function getUnavailableReason() {
    return unavailableReason;
  }

  window.BCFDStorage = {
    open,
    listCases,
    getCaseBundle,
    createCase,
    createImportedCase,
    updateExistingCase,
    deleteCase,
    setCurrentCaseId,
    getCurrentCaseId,
    getStorageEstimate,
    isIndexedDbAvailable,
    getUnavailableReason,
    DB_NAME,
    DB_VERSION,
  };
})();
