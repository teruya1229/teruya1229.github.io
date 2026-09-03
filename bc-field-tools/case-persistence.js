(() => {
  "use strict";

  const DEBOUNCE_MS = 750;
  const MAX_WAIT_MS = 3000;

  /** @type {null | {
   *   caseId: string,
   *   revision: number,
   *   expectedRevision: number,
   *   createdAt: string,
   *   caseNumber: string,
   *   editGeneration: number,
   *   committedGeneration: number,
   *   lifecycleToken: number,
   *   deleteRequested: boolean,
   *   saveError: string,
   *   conflictState: null | "revision" | "deleted",
   *   saving: boolean,
   *   status: string,
   *   lastSavedAt: string,
   *   lastError: string,
   *   storageOk: boolean,
   *   suppressAutosave: boolean,
   *   displayNameHint: string,
   *   uiLocked: boolean
   * }} */
  let runtime = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;
  /** @type {number | null} */
  let firstDirtyAt = null;
  /** @type {Promise<boolean> | null} */
  let saveLoopPromise = null;

  function app() {
    return window.BCFDApp;
  }

  function storage() {
    return window.BCFDStorage;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
        d.getMinutes()
      )}`;
    } catch (_) {
      return iso;
    }
  }

  function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createCaseNumber() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `BC-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
      d.getMinutes()
    )}${pad(d.getSeconds())}`;
  }

  function isDirty() {
    if (!runtime) return false;
    if (runtime.deleteRequested) return false;
    const a = app();
    const pendingPhotos = a && typeof a.hasPendingPhotoOps === "function" ? a.hasPendingPhotoOps() : false;
    return runtime.editGeneration > runtime.committedGeneration || pendingPhotos;
  }

  function isSavedClean() {
    if (!runtime) return false;
    return (
      runtime.editGeneration === runtime.committedGeneration &&
      !(app() && typeof app().hasPendingPhotoOps === "function" && app().hasPendingPhotoOps()) &&
      !runtime.saving &&
      !runtime.saveError &&
      !runtime.conflictState &&
      !runtime.deleteRequested
    );
  }

  function setStatus(status, detail) {
    if (!runtime) return;
    runtime.status = status;
    if (detail !== undefined) {
      runtime.lastError = detail || "";
      runtime.saveError = detail || "";
    }
    renderSaveStatus();
  }

  function updateConflictPanel() {
    const conflictBox = document.getElementById("conflict-panel");
    const warn = conflictBox ? conflictBox.querySelector(".warn-card") : null;
    const reloadBtn = document.getElementById("conflict-reload-btn");
    const saveAsNewBtn = document.getElementById("conflict-save-as-new-btn");
    if (!runtime || !conflictBox) return;

    if (!runtime.conflictState) {
      conflictBox.hidden = true;
      return;
    }
    conflictBox.hidden = false;
    if (runtime.conflictState === "deleted") {
      if (warn) {
        warn.textContent =
          "この案件は別タブで削除されています。同じIDでは保存できません。現在の入力は保持されています。";
      }
      if (reloadBtn instanceof HTMLButtonElement) {
        reloadBtn.textContent = "現在内容を破棄して閉じる";
      }
      if (saveAsNewBtn instanceof HTMLButtonElement) {
        saveAsNewBtn.textContent = "現在内容を新規案件として保存";
      }
      return;
    }
    if (warn) {
      warn.textContent = "別タブで更新されています。現在の入力を自動破棄しません。";
    }
    if (reloadBtn instanceof HTMLButtonElement) {
      reloadBtn.textContent = "DB版を開き直す";
    }
    if (saveAsNewBtn instanceof HTMLButtonElement) {
      saveAsNewBtn.textContent = "現在の入力を新規案件として保存";
    }
  }

  function renderSaveStatus() {
    const el = document.getElementById("save-status");
    const detailEl = document.getElementById("save-status-detail");
    const nameEl = document.getElementById("current-case-name");
    const numberEl = document.getElementById("current-case-number");
    const phaseEl = document.getElementById("current-case-phase");
    const updatedEl = document.getElementById("current-case-updated");
    const retryBtn = document.getElementById("save-retry-btn");

    if (!runtime) return;

    const a = app();
    const snap = a && typeof a.createCaseSnapshot === "function" ? a.createCaseSnapshot() : null;
    const displayName =
      (snap && snap.caseInfo && snap.caseInfo.caseName) || runtime.displayNameHint || "（未命名案件）";
    const phaseLabel =
      (a && a.PHASE_LABELS && a.PHASE_LABELS[snap && snap.workflow && snap.workflow.currentPhase]) ||
      (snap && snap.workflow && snap.workflow.currentPhase) ||
      "現地調査";

    if (nameEl) nameEl.textContent = displayName;
    if (numberEl) numberEl.textContent = runtime.caseNumber || "—";
    if (phaseEl) phaseEl.textContent = phaseLabel;
    if (updatedEl) updatedEl.textContent = runtime.lastSavedAt ? formatTime(runtime.lastSavedAt) : "未保存";

    const dirty = isDirty();
    let text = "";
    let cls = "save-status";
    if (!runtime.storageOk) {
      text = "このブラウザでは保存できません";
      cls += " save-unavailable";
    } else if (runtime.conflictState) {
      text = runtime.conflictState === "deleted" ? "別タブで削除済み" : "別タブ更新との競合";
      cls += " save-conflict";
    } else if (runtime.saving) {
      text = "保存中";
      cls += " save-saving";
    } else if (runtime.status === "error" || runtime.saveError) {
      text = "保存失敗";
      cls += " save-error";
    } else if (dirty) {
      text = "未保存の変更あり";
      cls += " save-dirty";
    } else if (runtime.lastSavedAt && isSavedClean()) {
      text = `保存済み（${formatTime(runtime.lastSavedAt)}）`;
      cls += " save-ok";
    } else {
      text = "保存待ち";
      cls += " save-idle";
    }

    if (el) {
      el.className = cls;
      el.textContent = text;
    }
    if (detailEl) {
      detailEl.textContent = runtime.lastError || "";
      detailEl.hidden = !runtime.lastError;
    }
    if (retryBtn instanceof HTMLButtonElement) {
      retryBtn.hidden = !(runtime.status === "error" || runtime.conflictState);
      if (runtime.conflictState) retryBtn.hidden = true;
    }
    updateConflictPanel();
  }

  async function refreshStorageEstimate() {
    const box = document.getElementById("storage-estimate");
    if (!(box instanceof HTMLElement)) return;
    if (!runtime || !runtime.storageOk) {
      box.hidden = true;
      return;
    }
    const est = await storage().getStorageEstimate();
    if (!est) {
      box.hidden = true;
      return;
    }
    const usageMb = (est.usage / (1024 * 1024)).toFixed(1);
    const quotaMb = est.quota ? (est.quota / (1024 * 1024)).toFixed(0) : "?";
    const pct = est.ratio != null ? Math.round(est.ratio * 100) : null;
    box.hidden = false;
    box.replaceChildren();
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = `ローカル使用量: 約 ${usageMb} MB / 推定上限 ${quotaMb} MB${
      pct != null ? `（約 ${pct}%）` : ""
    }`;
    box.appendChild(p);
    if (pct != null && pct >= 80) {
      const warn = document.createElement("p");
      warn.className = "hint";
      warn.setAttribute("role", "alert");
      warn.textContent =
        "容量不足の可能性があります。保存を保証するものではありません。不要な案件の削除を検討してください。";
      box.appendChild(warn);
    }
  }

  function emptySnapshot() {
    const a = app();
    if (a && typeof a.createEmptySnapshot === "function") return a.createEmptySnapshot();
    if (a && typeof a.createCaseSnapshot === "function") return a.createCaseSnapshot();
    return {
      schemaVersion: "1B-2A",
      snapshotAt: nowIso(),
      caseInfo: { caseName: "", siteMemo: "", workType: "" },
      workflow: { currentPhase: "survey", phaseStatus: {} },
      survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
      preparation: { checks: [], stopRecord: {} },
      execution: { materials: [], planChange: {}, extraWorks: [] },
      completion: { measures: [], operationChecks: [] },
      alerts: [],
      photoMetadata: [],
    };
  }

  function buildCaseRecord(snapshot, revisionBase, caseId) {
    const displayName = (snapshot.caseInfo && snapshot.caseInfo.caseName) || "（未命名案件）";
    return {
      id: caseId,
      recordVersion: 1,
      createdAt: runtime.createdAt,
      updatedAt: nowIso(),
      revision: revisionBase,
      displayName,
      caseNumber: runtime.caseNumber,
      archiveState: "active",
      snapshot,
    };
  }

  function collectPhotoOpsForGeneration(caseId, targetGeneration) {
    const a = app();
    if (!a || typeof a.getPendingPhotoOps !== "function") {
      return { photoPuts: [], photoDeletes: [] };
    }
    return a.getPendingPhotoOps(caseId, { maxGeneration: targetGeneration });
  }

  function setInteractionLocked(locked) {
    if (!runtime) return;
    runtime.uiLocked = locked;
    const selectors = [
      "#case-name",
      "#site-memo",
      "input",
      "textarea",
      "select",
      "button",
      "#open-case-list-btn",
      "#new-case-btn",
      "#save-now-btn",
      "#delete-case-btn",
    ];
    document.querySelectorAll(selectors.join(",")).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.id === "conflict-reload-btn" || el.id === "conflict-save-as-new-btn") return;
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        if (locked) {
          if (!el.dataset.bcfdLockPrev) {
            el.dataset.bcfdLockPrev = el.disabled ? "1" : "0";
          }
          el.disabled = true;
        } else if (el.dataset.bcfdLockPrev != null) {
          el.disabled = el.dataset.bcfdLockPrev === "1";
          delete el.dataset.bcfdLockPrev;
        }
      }
    });
  }

  function clearDebounceTimer() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function resetSessionState({ advanceLifecycle } = {}) {
    if (!runtime) return;
    if (advanceLifecycle) runtime.lifecycleToken += 1;
    clearDebounceTimer();
    saveLoopPromise = null;
    firstDirtyAt = null;
    runtime.editGeneration = 0;
    runtime.committedGeneration = 0;
    runtime.expectedRevision = 0;
    runtime.deleteRequested = false;
    runtime.saveError = "";
    runtime.conflictState = null;
    runtime.saving = false;
    runtime.lastError = "";
    const a = app();
    if (a && typeof a.clearPendingPhotoOps === "function") a.clearPendingPhotoOps();
  }

  /**
   * Bump edit generation for any persistable change. Returns new generation.
   */
  function notePersistableChange() {
    if (!runtime || !runtime.storageOk) return 0;
    if (runtime.deleteRequested) return runtime.editGeneration;
    runtime.editGeneration += 1;
    runtime.saveError = "";
    if (!runtime.suppressAutosave && !runtime.conflictState) {
      scheduleAutosave();
    } else {
      renderSaveStatus();
    }
    return runtime.editGeneration;
  }

  function getEditGeneration() {
    return runtime ? runtime.editGeneration : 0;
  }

  /**
   * Run one frozen save for generations up through targetGeneration.
   * @returns {Promise<"ok" | "stop" | "noop">}
   */
  async function runOneSave(targetGeneration) {
    if (!runtime || !runtime.storageOk) return "stop";
    if (runtime.deleteRequested) return "stop";
    if (runtime.conflictState) return "stop";

    const a = app();
    if (!a || typeof a.createCaseSnapshot !== "function") return "stop";

    const caseId = runtime.caseId;
    const lifecycleToken = runtime.lifecycleToken;
    const expectedRevision = runtime.expectedRevision;
    const snapshot = a.createCaseSnapshot();
    const caseRecord = buildCaseRecord(snapshot, expectedRevision, caseId);
    const { photoPuts, photoDeletes } = collectPhotoOpsForGeneration(caseId, targetGeneration);

    const saved = await storage().updateExistingCase({
      caseRecord,
      photoPuts,
      photoDeletes,
      expectedRevision,
    });

    if (!runtime || runtime.caseId !== caseId || runtime.lifecycleToken !== lifecycleToken) {
      return "noop";
    }

    runtime.revision = saved.revision;
    runtime.expectedRevision = saved.revision;
    runtime.lastSavedAt = saved.updatedAt;
    runtime.displayNameHint = saved.displayName;
    if (runtime.committedGeneration < targetGeneration) {
      runtime.committedGeneration = targetGeneration;
    }
    runtime.saveError = "";
    runtime.lastError = "";

    if (typeof a.clearPendingPhotoOps === "function") {
      a.clearPendingPhotoOps(photoPuts, photoDeletes);
    }

    await storage().setCurrentCaseId(caseId);
    return "ok";
  }

  async function runSaveLoop() {
    if (!runtime || !runtime.storageOk) return false;
    if (runtime.conflictState || runtime.deleteRequested) return false;

    runtime.saving = true;
    setStatus("saving", "");

    let loopOk = true;
    try {
      while (runtime && isDirty() && !runtime.conflictState && !runtime.deleteRequested) {
        const caseId = runtime.caseId;
        const lifecycleToken = runtime.lifecycleToken;
        const targetGeneration = runtime.editGeneration;

        if (targetGeneration <= runtime.committedGeneration && !(app() && app().hasPendingPhotoOps && app().hasPendingPhotoOps())) {
          break;
        }

        try {
          const result = await runOneSave(targetGeneration);
          if (!runtime || runtime.caseId !== caseId || runtime.lifecycleToken !== lifecycleToken) {
            loopOk = false;
            break;
          }
          if (result === "stop" || result === "noop") {
            loopOk = false;
            break;
          }
        } catch (err) {
          if (!runtime || runtime.caseId !== caseId || runtime.lifecycleToken !== lifecycleToken) {
            loopOk = false;
            break;
          }
          const name = (err && err.name) || "UnknownError";
          if (name === "CaseConflictError" || name === "RevisionConflict") {
            runtime.conflictState = "revision";
            setStatus(
              "error",
              "別タブで更新されています。DB版を開き直すか、現在の入力を新規案件として保存してください。"
            );
            loopOk = false;
            break;
          }
          if (name === "CaseDeletedError") {
            runtime.conflictState = "deleted";
            setStatus(
              "error",
              "この案件は別タブで削除されています。同じIDでは保存できません。現在内容を新規案件として保存するか、破棄して閉じてください。"
            );
            loopOk = false;
            break;
          }
          if (name === "CaseMissingError") {
            runtime.conflictState = "deleted";
            setStatus("error", "この案件は見つかりません。同じIDでは保存できません。");
            loopOk = false;
            break;
          }
          let msg = "保存に失敗しました。入力と写真は画面上に保持されています。";
          if (name === "QuotaExceededError") msg = "容量不足で保存できませんでした。不要案件の削除を検討してください。";
          else if (name === "AbortError") msg = "保存処理が中断されました。再試行してください。";
          else if (name === "VersionError") msg = "データベース版の不整合があります。ページ再読込を案内します。";
          runtime.saveError = msg;
          setStatus("error", msg);
          loopOk = false;
          break;
        }

        // If still dirty (newer edits during save), loop continues with a fresh snapshot.
      }
    } finally {
      if (runtime) {
        runtime.saving = false;
      }
    }

    if (!runtime) return false;
    firstDirtyAt = isDirty() ? firstDirtyAt || Date.now() : null;
    if (!runtime.conflictState && !runtime.saveError) {
      if (isSavedClean()) {
        setStatus("saved", "");
      } else if (isDirty()) {
        setStatus("dirty", "");
      }
    } else {
      renderSaveStatus();
    }
    renderSaveStatus();
    await refreshStorageEstimate();
    await renderCaseList();
    return loopOk && isSavedClean();
  }

  function persistNow({ reason } = {}) {
    if (!runtime || !runtime.storageOk) return Promise.resolve(false);
    if (runtime.deleteRequested) return Promise.resolve(false);
    if (runtime.conflictState) {
      setStatus(
        "error",
        runtime.conflictState === "deleted"
          ? "この案件は別タブで削除されています。同じIDでは保存できません。"
          : "別タブで更新されています。上書き保存はできません。"
      );
      return Promise.resolve(false);
    }
    if (runtime.suppressAutosave && reason !== "clear-current" && reason !== "flush" && reason !== "retry") {
      return Promise.resolve(false);
    }
    if (!isDirty() && !runtime.saving) {
      return Promise.resolve(true);
    }
    if (saveLoopPromise) return saveLoopPromise;

    saveLoopPromise = runSaveLoop().finally(() => {
      saveLoopPromise = null;
    });
    return saveLoopPromise;
  }

  function scheduleAutosave() {
    if (!runtime || !runtime.storageOk || runtime.suppressAutosave || runtime.conflictState) return;
    if (runtime.deleteRequested) return;
    if (!firstDirtyAt) firstDirtyAt = Date.now();
    renderSaveStatus();

    clearDebounceTimer();
    const waited = Date.now() - (firstDirtyAt || Date.now());
    const delay = waited >= MAX_WAIT_MS ? 0 : Math.min(DEBOUNCE_MS, MAX_WAIT_MS - waited);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void persistNow({ reason: "autosave" });
    }, delay);
  }

  async function flushAutosave() {
    clearDebounceTimer();
    if (!runtime) return true;
    if (!runtime.storageOk) return true;
    if (runtime.deleteRequested) return false;
    if (runtime.conflictState) return false;
    if (!isDirty() && !runtime.saving && !saveLoopPromise) return true;

    // Join existing loop or start one; wait until clean or failure.
    const result = await persistNow({ reason: "flush" });
    if (!result) return false;
    // Additional edits may have arrived after the joined loop started; keep flushing.
    while (runtime && isDirty() && !runtime.conflictState && !runtime.deleteRequested) {
      const again = await persistNow({ reason: "flush" });
      if (!again) return false;
    }
    return !!(runtime && isSavedClean());
  }

  function markDirtyFromApp() {
    notePersistableChange();
  }

  async function applyBundle(bundle) {
    const a = app();
    if (!a || typeof a.applyCaseSnapshot !== "function") {
      throw new Error("BCFDApp.applyCaseSnapshot is missing");
    }
    runtime.suppressAutosave = true;
    try {
      const photosBySlot = {};
      (bundle.photos || []).forEach((p) => {
        if (p && p.slotKey) photosBySlot[p.slotKey] = p;
      });
      await a.applyCaseSnapshot(bundle.caseRecord.snapshot || emptySnapshot(), photosBySlot);
      runtime.lifecycleToken += 1;
      runtime.caseId = bundle.caseRecord.id;
      runtime.revision = Number(bundle.caseRecord.revision) || 0;
      runtime.expectedRevision = runtime.revision;
      runtime.createdAt = bundle.caseRecord.createdAt || nowIso();
      runtime.caseNumber = bundle.caseRecord.caseNumber || "";
      runtime.displayNameHint = bundle.caseRecord.displayName || "";
      runtime.lastSavedAt = bundle.caseRecord.updatedAt || "";
      runtime.editGeneration = 0;
      runtime.committedGeneration = 0;
      runtime.deleteRequested = false;
      runtime.saveError = "";
      runtime.conflictState = null;
      runtime.lastError = "";
      firstDirtyAt = null;
      clearDebounceTimer();
      if (typeof a.clearPendingPhotoOps === "function") a.clearPendingPhotoOps();
      setStatus("saved", "");
    } finally {
      runtime.suppressAutosave = false;
    }
    await storage().setCurrentCaseId(runtime.caseId);
    renderSaveStatus();
    await renderCaseList();
  }

  async function createNewCaseRecord() {
    const id = createId();
    const createdAt = nowIso();
    const caseNumber = createCaseNumber();
    const snapshot = emptySnapshot();
    if (snapshot.caseInfo) snapshot.caseInfo.caseName = "";
    const record = {
      id,
      recordVersion: 1,
      createdAt,
      updatedAt: createdAt,
      revision: 0,
      displayName: "（未命名案件）",
      caseNumber,
      archiveState: "active",
      snapshot,
    };
    const saved = await storage().createCase({
      caseRecord: record,
      photoPuts: [],
    });
    return saved;
  }

  async function openCase(caseId) {
    const ok = await flushAutosave();
    if (!ok) {
      window.alert("現在案件の保存に失敗したため、案件を切り替えできません。");
      return false;
    }
    const a = app();
    if (a && typeof a.revokeAllPhotos === "function") a.revokeAllPhotos();
    const bundle = await storage().getCaseBundle(caseId);
    if (!bundle) {
      window.alert("案件が見つかりません。");
      return false;
    }
    await applyBundle(bundle);
    const panel = document.getElementById("case-list-panel");
    if (panel) panel.hidden = true;
    return true;
  }

  async function createAndOpenNewCase() {
    if (runtime && runtime.storageOk) {
      const ok = await flushAutosave();
      if (!ok) {
        window.alert("現在案件の保存に失敗したため、新規案件を作成できません。");
        return false;
      }
    }
    const a = app();
    if (a && typeof a.revokeAllPhotos === "function") a.revokeAllPhotos();
    const saved = await createNewCaseRecord();
    await applyBundle({ caseRecord: saved, photos: [] });
    return true;
  }

  async function discardDeletedAndClose() {
    if (!runtime) return;
    const a = app();
    if (a && typeof a.revokeAllPhotos === "function") a.revokeAllPhotos();
    resetSessionState({ advanceLifecycle: true });
    runtime.caseId = "";
    runtime.conflictState = null;
    runtime.saveError = "";
    runtime.lastError = "";
    const remaining = await storage().listCases();
    if (!remaining.length) {
      const saved = await createNewCaseRecord();
      await applyBundle({ caseRecord: saved, photos: [] });
      return;
    }
    const bundle = await storage().getCaseBundle(remaining[0].id);
    if (!bundle) {
      const saved = await createNewCaseRecord();
      await applyBundle({ caseRecord: saved, photos: [] });
      return;
    }
    await applyBundle(bundle);
  }

  async function deleteCurrentOrSelected(caseId, displayName) {
    const label = displayName || caseId;
    const first = window.confirm(
      `案件「${label}」を削除しますか？\n関連する写真Blobも削除され、復元できません。`
    );
    if (!first) return false;
    const second = window.confirm(
      `最終確認: 案件「${label}」を完全に削除します。この操作は取り消せません。続行しますか？`
    );
    if (!second) return false;

    const deletingCurrent = runtime && runtime.caseId === caseId;
    let expectedRevision = 0;

    if (deletingCurrent && runtime) {
      runtime.deleteRequested = true;
      clearDebounceTimer();
      setInteractionLocked(true);
      if (saveLoopPromise) {
        try {
          await saveLoopPromise;
        } catch (_) {
          /* ignore */
        }
      }
      expectedRevision = runtime.expectedRevision;
    } else {
      const bundle = await storage().getCaseBundle(caseId);
      if (!bundle) {
        window.alert("案件が見つかりません。");
        return false;
      }
      expectedRevision = Number(bundle.caseRecord.revision) || 0;
    }

    try {
      await storage().deleteCase(caseId, expectedRevision);
    } catch (err) {
      if (deletingCurrent && runtime) {
        runtime.deleteRequested = false;
        setInteractionLocked(false);
        const name = (err && err.name) || "";
        if (name === "CaseConflictError" || name === "RevisionConflict") {
          runtime.conflictState = "revision";
          setStatus(
            "error",
            "別タブで更新されているため削除できませんでした。DB版を確認してください。入力は保持されています。"
          );
        } else if (name === "CaseDeletedError") {
          runtime.conflictState = "deleted";
          setStatus("error", "この案件は既に削除されています。");
        } else {
          setStatus("error", "削除に失敗しました。入力は保持されています。");
        }
      } else {
        const name = (err && err.name) || "";
        if (name === "CaseConflictError") {
          window.alert("別タブで更新されているため削除できませんでした。");
        } else if (name === "CaseDeletedError") {
          window.alert("この案件は既に削除されています。");
        } else {
          window.alert("削除に失敗しました。");
        }
        await renderCaseList();
      }
      return false;
    }

    if (deletingCurrent && runtime) {
      const a = app();
      if (a && typeof a.revokeAllPhotos === "function") a.revokeAllPhotos();
      resetSessionState({ advanceLifecycle: true });
      runtime.caseId = "";
      setInteractionLocked(false);
    }

    const remaining = await storage().listCases();
    if (!remaining.length) {
      await createAndOpenNewCase();
      return true;
    }
    if (deletingCurrent) {
      await openCase(remaining[0].id);
    } else {
      await renderCaseList();
    }
    return true;
  }

  async function reloadFromDb() {
    if (!runtime) return;
    if (runtime.conflictState === "deleted") {
      await discardDeletedAndClose();
      return;
    }
    const bundle = await storage().getCaseBundle(runtime.caseId);
    if (!bundle) {
      window.alert("DB上の案件が見つかりません。");
      return;
    }
    const a = app();
    if (a && typeof a.revokeAllPhotos === "function") a.revokeAllPhotos();
    await applyBundle(bundle);
  }

  async function saveCurrentAsNewCase() {
    if (!runtime) return;
    const a = app();
    if (!a || typeof a.createCaseSnapshot !== "function") return;
    const snapshot = a.createCaseSnapshot();
    const photoOps = typeof a.exportAllPhotoPuts === "function" ? a.exportAllPhotoPuts() : [];
    const id = createId();
    const createdAt = nowIso();
    const caseNumber = createCaseNumber();
    const record = {
      id,
      recordVersion: 1,
      createdAt,
      updatedAt: createdAt,
      revision: 0,
      displayName: (snapshot.caseInfo && snapshot.caseInfo.caseName) || "（未命名案件）",
      caseNumber,
      archiveState: "active",
      snapshot,
    };
    const puts = photoOps.map((p) => ({ ...p, caseId: id }));
    const saved = await storage().createCase({
      caseRecord: record,
      photoPuts: puts,
    });
    runtime.conflictState = null;
    runtime.saveError = "";
    await applyBundle({ caseRecord: saved, photos: puts });
    window.alert("現在の入力を新規案件として保存しました。");
  }

  async function clearCurrentCaseInputs() {
    const a = app();
    if (!a || typeof a.clearCurrentCaseForm !== "function") return;
    const confirmed = window.confirm(
      "現在案件の入力と写真をすべてクリアしますか？\n案件自体は削除されません。IndexedDB上の現在案件の写真も削除されます。"
    );
    if (!confirmed) return;

    runtime.suppressAutosave = true;
    try {
      a.clearCurrentCaseForm({ revoke: true });
      if (typeof a.markAllPhotosDeleted === "function") a.markAllPhotosDeleted();
      else notePersistableChange();
    } finally {
      runtime.suppressAutosave = false;
    }
    const ok = await persistNow({ reason: "clear-current" });
    if (!ok) {
      window.alert("クリア後の保存に失敗しました。画面上の入力はクリア済みです。再試行してください。");
    }
  }

  async function renderCaseList() {
    const listEl = document.getElementById("case-list");
    if (!(listEl instanceof HTMLElement)) return;
    if (!runtime || !runtime.storageOk) {
      listEl.replaceChildren();
      const p = document.createElement("p");
      p.className = "note";
      p.textContent = "このブラウザでは案件一覧を保存できません。";
      listEl.appendChild(p);
      return;
    }

    const cases = await storage().listCases();
    listEl.replaceChildren();
    if (!cases.length) {
      const p = document.createElement("p");
      p.className = "note";
      p.textContent = "案件がありません。";
      listEl.appendChild(p);
      return;
    }

    cases.forEach((c) => {
      const item = document.createElement("article");
      item.className = "case-list-item";
      if (runtime && c.id === runtime.caseId) item.classList.add("is-current");

      const title = document.createElement("h3");
      title.textContent = c.displayName || "（未命名案件）";
      item.appendChild(title);

      const meta = document.createElement("p");
      meta.className = "case-meta";
      const snap = c.snapshot || {};
      const workType = (snap.caseInfo && snap.caseInfo.workType) || "工事種別未選択";
      const phase = (snap.workflow && snap.workflow.currentPhase) || "survey";
      const phaseLabel = (app() && app().PHASE_LABELS && app().PHASE_LABELS[phase]) || phase;
      const statuses = (snap.workflow && snap.workflow.phaseStatus) || {};
      const statusText = Object.keys(statuses)
        .map((k) => `${(app() && app().PHASE_LABELS && app().PHASE_LABELS[k]) || k}:${statuses[k]}`)
        .join(" / ");
      meta.textContent = `${c.caseNumber || "—"} · ${workType} · ${phaseLabel} · 更新 ${formatTime(
        c.updatedAt
      )}`;
      item.appendChild(meta);

      if (statusText) {
        const st = document.createElement("p");
        st.className = "case-meta";
        st.textContent = statusText;
        item.appendChild(st);
      }

      const actions = document.createElement("div");
      actions.className = "case-item-actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn btn-primary";
      openBtn.textContent = "続きから開く";
      openBtn.addEventListener("click", () => {
        void openCase(c.id);
      });
      actions.appendChild(openBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger-lite";
      delBtn.textContent = "案件削除";
      delBtn.addEventListener("click", () => {
        void deleteCurrentOrSelected(c.id, c.displayName || "（未命名案件）");
      });
      actions.appendChild(delBtn);

      item.appendChild(actions);
      listEl.appendChild(item);
    });
  }

  function bindUi() {
    document.getElementById("open-case-list-btn")?.addEventListener("click", () => {
      const panel = document.getElementById("case-list-panel");
      if (panel) {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) void renderCaseList();
      }
    });
    document.getElementById("close-case-list-btn")?.addEventListener("click", () => {
      const panel = document.getElementById("case-list-panel");
      if (panel) panel.hidden = true;
    });
    document.getElementById("new-case-btn")?.addEventListener("click", () => {
      void createAndOpenNewCase();
    });
    document.getElementById("save-now-btn")?.addEventListener("click", () => {
      void flushAutosave();
    });
    document.getElementById("save-retry-btn")?.addEventListener("click", () => {
      if (runtime && runtime.conflictState) return;
      runtime.saveError = "";
      runtime.lastError = "";
      void persistNow({ reason: "retry" });
    });
    document.getElementById("conflict-reload-btn")?.addEventListener("click", () => {
      void reloadFromDb();
    });
    document.getElementById("conflict-save-as-new-btn")?.addEventListener("click", () => {
      void saveCurrentAsNewCase();
    });
    document.getElementById("delete-case-btn")?.addEventListener("click", () => {
      if (!runtime) return;
      const name =
        (app() &&
          app().createCaseSnapshot &&
          app().createCaseSnapshot().caseInfo &&
          app().createCaseSnapshot().caseInfo.caseName) ||
        runtime.displayNameHint ||
        "（未命名案件）";
      void deleteCurrentOrSelected(runtime.caseId, name);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        void flushAutosave();
      }
    });
    window.addEventListener("pagehide", () => {
      void flushAutosave();
    });

    window.addEventListener("bcfd:idb-versionchange", (event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      setStatus("error", (detail && detail.message) || "DBが更新されました。再読み込みしてください。");
    });
    window.addEventListener("bcfd:idb-blocked", (event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      setStatus("error", (detail && detail.message) || "他のタブを閉じてください。");
    });
  }

  function bindBackupUi() {
    const backup = window.BCFDBackup;
    if (!backup || typeof backup.bindUi !== "function") return;

    backup.bindUi({
      async beforeExport() {
        if (!runtime || !runtime.storageOk) {
          window.alert("このブラウザではバックアップできません。");
          return false;
        }
        if (!runtime.caseId) {
          window.alert("現在案件がありません。");
          return false;
        }
        if (runtime.conflictState) {
          window.alert("保存競合があるためバックアップできません。競合を解消してください。");
          return false;
        }
        if (runtime.saveError) {
          window.alert("保存エラーがあるためバックアップできません。保存を再試行してください。");
          return false;
        }
        const ok = await flushAutosave();
        if (!ok) {
          window.alert("現在案件の保存に失敗したため、バックアップできません。");
          return false;
        }
        return true;
      },
      confirmPrivacy() {
        return window.confirm(
          "バックアップファイルには、顧客情報・現場記録・写真が含まれます。ファイルは暗号化されていません。安全な場所へ保存してください。"
        );
      },
      async loadBundle() {
        return storage().getCaseBundle(runtime.caseId);
      },
      async beforeImport() {
        if (!runtime || !runtime.storageOk) {
          window.alert("このブラウザでは復元できません。");
          return false;
        }
        if (runtime.conflictState) {
          window.alert("保存競合があるため復元を開始できません。競合を解消してください。");
          return false;
        }
        const ok = await flushAutosave();
        if (!ok) {
          window.alert("現在案件の保存に失敗したため、復元を開始できません。");
          return false;
        }
        return true;
      },
      async commitImport({ inspection, photos }) {
        const newId = createId();
        const importedAt = nowIso();
        const caseNumber = createCaseNumber();
        const caseRecord = backup.prepareImportCaseRecord({
          newCaseId: newId,
          caseNumber,
          importedAt,
          manifest: inspection.manifest,
        });
        if (caseRecord.id === inspection.manifest.source.caseId) {
          throw new Error("復元先IDにsource.caseIdは使用できません。");
        }
        const photoPuts = (photos || []).map((p) => ({
          caseId: newId,
          slotKey: p.slotKey,
          phase: p.phase || "",
          blob: p.blob,
          fileName: p.fileName || "",
          mimeType: p.mimeType || "",
          size: p.size,
          lastModified: p.lastModified,
          createdAt: importedAt,
          updatedAt: importedAt,
        }));
        const saved = await storage().createImportedCase({
          caseRecord,
          photoPuts,
        });
        return { caseRecord: saved, photos: photoPuts };
      },
      async afterImport(result) {
        const a = app();
        if (a && typeof a.revokeAllPhotos === "function") a.revokeAllPhotos();
        await applyBundle({
          caseRecord: result.caseRecord,
          photos: result.photos,
        });
      },
    });
  }

  async function boot() {
    runtime = {
      caseId: "",
      revision: 0,
      expectedRevision: 0,
      createdAt: nowIso(),
      caseNumber: "",
      editGeneration: 0,
      committedGeneration: 0,
      lifecycleToken: 0,
      deleteRequested: false,
      saveError: "",
      conflictState: null,
      saving: false,
      status: "idle",
      lastSavedAt: "",
      lastError: "",
      storageOk: false,
      suppressAutosave: false,
      displayNameHint: "",
      uiLocked: false,
    };

    bindUi();
    bindBackupUi();

    const a = app();
    if (!a) {
      console.error("BCFDApp is not available");
      return;
    }

    if (typeof a.setClearHandler === "function") {
      a.setClearHandler(() => {
        void clearCurrentCaseInputs();
      });
    }
    if (typeof a.setDirtyHandler === "function") {
      a.setDirtyHandler(() => markDirtyFromApp());
    }

    if (!storage().isIndexedDbAvailable()) {
      runtime.storageOk = false;
      setStatus("unavailable", "このブラウザでは保存されません。メモリ上のみで利用できます。");
      a.initEmptyUi();
      renderSaveStatus();
      return;
    }

    try {
      await storage().open();
      runtime.storageOk = true;
    } catch (err) {
      runtime.storageOk = false;
      setStatus("unavailable", "このブラウザでは保存されません。メモリ上のみで利用できます。");
      a.initEmptyUi();
      renderSaveStatus();
      return;
    }

    const cases = await storage().listCases();
    if (!cases.length) {
      await createAndOpenNewCase();
      await refreshStorageEstimate();
      return;
    }

    let currentId = await storage().getCurrentCaseId();
    if (!currentId || !cases.some((c) => c.id === currentId)) {
      currentId = cases[0].id;
    }
    const bundle = await storage().getCaseBundle(currentId);
    if (!bundle) {
      await createAndOpenNewCase();
    } else {
      await applyBundle(bundle);
    }
    await refreshStorageEstimate();
  }

  window.BCFDCasePersistence = {
    boot,
    scheduleAutosave,
    flushAutosave,
    markDirtyFromApp,
    notePersistableChange,
    getEditGeneration,
    persistNow,
    openCase,
    createAndOpenNewCase,
    renderCaseList,
    getRuntime: () => runtime,
  };

  document.addEventListener("DOMContentLoaded", () => {
    // app.js also uses IIFE at parse time; scripts are deferred by order at end of body
  });

  // Boot after app.js has registered BCFDApp (scripts load sync at end of body)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void boot();
    });
  } else {
    void boot();
  }
})();
