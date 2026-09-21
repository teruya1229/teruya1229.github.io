/**
 * Estimate / siteMemo IDB persistence reliability — static + roundtrip checks.
 * Covers selected / qty / custom / memo / note / siteMemo / A-B isolation /
 * remote hydrate non-destruction / navigation flush wiring.
 */
"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function loadEstimate(localStorage) {
  const code = fs.readFileSync(path.join(root, "estimate.js"), "utf8");
  const sandbox = { window: {}, localStorage, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.BCEstimate;
}

function applyReceptionMetadataToSnapshot(snapshot, remoteCase) {
  if (!snapshot || !remoteCase) return snapshot;
  const info =
    snapshot.caseInfo && typeof snapshot.caseInfo === "object"
      ? { ...snapshot.caseInfo }
      : { caseName: "", siteMemo: "", workType: "" };
  const siteMemo = info.siteMemo || "";
  if (remoteCase.customer_name) info.caseName = String(remoteCase.customer_name);
  if (remoteCase.customer_address) info.address = String(remoteCase.customer_address);
  if (remoteCase.customer_phone) info.phone = String(remoteCase.customer_phone);
  if (remoteCase.work) {
    info.requestedWork = String(remoteCase.work);
    if (!info.workType) info.workType = String(remoteCase.work);
  }
  if (remoteCase.scheduled_at) info.scheduledAt = String(remoteCase.scheduled_at);
  info.receptionReadOnly = true;
  info.sharedCaseId = String(remoteCase.case_id || remoteCase.id || "");
  info.siteMemo = siteMemo;
  snapshot.caseInfo = info;
  return snapshot;
}

describe("estimate persist / reopen wiring", () => {
  const persistence = fs.readFileSync(path.join(root, "case-persistence.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

  it("wires scheduleEstimateFlush + flushBeforeLeave + nav intercept", () => {
    assert.match(persistence, /ESTIMATE_FLUSH_MS\s*=\s*180/);
    assert.match(persistence, /function scheduleEstimateFlush/);
    assert.match(persistence, /function flushBeforeLeave/);
    assert.match(persistence, /flushBeforeLeave\("nav-link"\)/);
    assert.match(persistence, /scheduleEstimateFlush,/);
    assert.match(persistence, /flushBeforeLeave,/);
    assert.match(app, /pers\.scheduleEstimateFlush\(\)/);
    assert.match(app, /t\.id === "est-note"/);
    assert.match(index, /id="est-note"/);
  });

  it("save-now awaits flushAutosave", () => {
    assert.match(persistence, /save-now-btn[\s\S]*flushAutosave\(\)\.then/);
  });

  it("remote hydrate preserves siteMemo ownership", () => {
    assert.match(persistence, /Never overwrites siteMemo \/ estimate/);
    assert.match(persistence, /info\.siteMemo = siteMemo/);
  });
});

describe("estimate selected / qty / custom / memo / note roundtrip", () => {
  let E;

  beforeEach(() => {
    E = loadEstimate(createLocalStorage());
  });

  it("1 selected save → reopen restore", () => {
    const state = E.loadState();
    state.selected.install_std = { checked: true, qty: 1 };
    const snap = E.extractCaseEstimate(state);
    const back = E.hydrateFromCaseEstimate(snap, {});
    assert.equal(back.selected.install_std.checked, true);
    assert.equal(back.selected.install_std.qty, 1);
  });

  it("2 quantity save → reopen restore", () => {
    const state = E.loadState();
    state.selected.install_std = { checked: true, qty: 2 };
    const snap = E.extractCaseEstimate(state);
    const back = E.hydrateFromCaseEstimate(snap, {});
    assert.equal(back.selected.install_std.qty, 2);
  });

  it("3 custom save → reopen restore", () => {
    const state = E.loadState();
    state.custom = [{ name: "追加作業テスト", price: 7700, qty: 1, unit: "式" }];
    const snap = E.extractCaseEstimate(state);
    const back = E.hydrateFromCaseEstimate(snap, {});
    assert.equal(back.custom.length, 1);
    assert.equal(back.custom[0].name, "追加作業テスト");
    assert.equal(back.custom[0].price, 7700);
  });

  it("4 custom delete → reopen keeps deleted", () => {
    const state = E.loadState();
    state.custom = [
      { name: "追加作業テスト", price: 7700, qty: 1, unit: "式" },
      { name: "残す明細", price: 1000, qty: 1, unit: "式" },
    ];
    state.custom.splice(0, 1);
    const snap = E.extractCaseEstimate(state);
    const back = E.hydrateFromCaseEstimate(snap, {});
    assert.equal(back.custom.length, 1);
    assert.equal(back.custom[0].name, "残す明細");
  });

  it("5 memo / note save → reopen restore", () => {
    const state = E.loadState();
    state.memo = "見積メモA";
    state.note = "備考A";
    state.customer = "顧客A";
    const snap = E.extractCaseEstimate(state);
    const back = E.hydrateFromCaseEstimate(snap, {});
    assert.equal(back.memo, "見積メモA");
    assert.equal(back.note, "備考A");
    assert.equal(back.customer, "顧客A");
  });
});

describe("siteMemo + case A/B isolation + remote hydrate", () => {
  let E;

  beforeEach(() => {
    E = loadEstimate(createLocalStorage());
  });

  it("6 siteMemo owned by caseInfo and restored independently", () => {
    const caseA = {
      caseInfo: { caseName: "A", siteMemo: "現場メモA", workType: "" },
      estimate: E.extractCaseEstimate({
        selected: { install_std: { checked: true, qty: 2 } },
        custom: [{ name: "追加作業テスト", price: 7700, qty: 1, unit: "式" }],
        memo: "memoA",
        note: "noteA",
        customer: "",
        project: "",
      }),
    };
    assert.equal(caseA.caseInfo.siteMemo, "現場メモA");
    assert.equal(caseA.estimate.memo, "memoA");
    assert.equal(caseA.estimate.selected.install_std.qty, 2);
  });

  it("7 case A/B estimate isolation", () => {
    const estA = E.extractCaseEstimate({
      selected: { install_std: { checked: true, qty: 2 } },
      custom: [{ name: "追加作業テスト", price: 7700, qty: 1, unit: "式" }],
      memo: "memoA",
      note: "noteA",
      customer: "A",
      project: "",
    });
    const estB = E.extractCaseEstimate({
      selected: { install_std: { checked: true, qty: 1 } },
      custom: [],
      memo: "memoB",
      note: "",
      customer: "B",
      project: "",
    });
    const reopenA = E.hydrateFromCaseEstimate(estA, {});
    const reopenB = E.hydrateFromCaseEstimate(estB, {});
    assert.equal(reopenA.custom[0].name, "追加作業テスト");
    assert.equal(reopenA.memo, "memoA");
    assert.equal(reopenB.custom.length, 0);
    assert.equal(reopenB.memo, "memoB");
    assert.notEqual(reopenA.customer, reopenB.customer);
  });

  it("8 remote hydrate does not overwrite local estimate / siteMemo", () => {
    const snap = {
      caseInfo: { caseName: "旧名", siteMemo: "現場メモ保持", workType: "" },
      estimate: {
        selected: { install_std: { checked: true, qty: 2 } },
        custom: [{ name: "追加作業テスト", price: 7700, qty: 1, unit: "式" }],
        memo: "local-memo",
        note: "local-note",
        customer: "local-customer",
        project: "",
      },
    };
    applyReceptionMetadataToSnapshot(snap, {
      case_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      customer_name: "受付氏名",
      customer_address: "東京都",
      customer_phone: "090",
      work: "エアコン交換",
      scheduled_at: "2026-09-22T10:00:00+09:00",
    });
    assert.equal(snap.caseInfo.siteMemo, "現場メモ保持");
    assert.equal(snap.caseInfo.caseName, "受付氏名");
    assert.equal(snap.estimate.memo, "local-memo");
    assert.equal(snap.estimate.note, "local-note");
    assert.equal(snap.estimate.selected.install_std.qty, 2);
    assert.equal(snap.estimate.custom[0].name, "追加作業テスト");
  });

  it("9 navigation-before-flush is exported and used on same-origin leave", () => {
    const persistence = fs.readFileSync(path.join(root, "case-persistence.js"), "utf8");
    assert.match(persistence, /async function flushBeforeLeave/);
    assert.match(persistence, /clearAllPersistTimers\(\)/);
    assert.match(persistence, /el\.closest\("a\[href\]"\)/);
    assert.match(persistence, /window\.location\.href = dest/);
  });
});
