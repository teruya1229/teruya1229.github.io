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
    _store: store,
  };
}

function loadEstimate(localStorage) {
  const code = fs.readFileSync(path.join(root, "estimate.js"), "utf8");
  const sandbox = { window: {}, localStorage, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.BCEstimate;
}

function blankState(E, overrides) {
  const state = E.loadState();
  Object.assign(state, overrides || {});
  return state;
}

function select(state, id, qty) {
  state.selected[id] = { checked: true, qty: qty == null ? 1 : qty };
  return state;
}

describe("estimate tax-inclusive Phase 1", () => {
  let ls;
  let E;

  beforeEach(() => {
    ls = createLocalStorage();
    E = loadEstimate(ls);
  });

  it("9000 x1 => total 9000, tax 818, net 8182", () => {
    const state = select(blankState(E), "ac_std", 1);
    assert.equal(E.getPrice(state, E.itemById.ac_std), 9000);
    const t = E.totals(state);
    assert.equal(t.total, 9000);
    assert.equal(t.tax, 818);
    assert.equal(t.sub, 8182);
  });

  it("22000 x1 => total 22000, tax 2000, net 20000", () => {
    const state = select(blankState(E), "install_std", 1);
    const t = E.totals(state);
    assert.equal(t.total, 22000);
    assert.equal(t.tax, 2000);
    assert.equal(t.sub, 20000);
  });

  it("9000 x2 => total 18000", () => {
    const state = select(blankState(E), "ac_std", 2);
    assert.equal(E.totals(state).total, 18000);
  });

  it("does not add 10% on top of tax-inclusive prices", () => {
    const state = select(blankState(E), "install_std", 1);
    assert.notEqual(E.totals(state).total, 24200);
    assert.equal(E.totals(state).total, 22000);
  });

  it("applies negative discount correctly", () => {
    const state = select(blankState(E), "pipe_reuse", 1);
    const t = E.totals(state);
    assert.equal(t.total, -4400);
    assert.equal(t.tax, Math.round(-4400 * 10 / 110));
    assert.equal(t.sub, t.total - t.tax);
  });

  it("combines product and discount", () => {
    const state = blankState(E);
    select(state, "install_std", 1);
    select(state, "pipe_reuse", 1);
    const t = E.totals(state);
    assert.equal(t.total, 22000 - 4400);
    assert.equal(t.total, 17600);
    assert.equal(t.tax, Math.round(17600 * 10 / 110));
    assert.equal(t.sub, t.total - t.tax);
  });

  it("treats custom lines as tax-inclusive", () => {
    const state = blankState(E);
    state.custom = [{ name: "調整", price: 1100, qty: 1, unit: "式" }];
    const t = E.totals(state);
    assert.equal(t.total, 1100);
    assert.equal(t.tax, 100);
    assert.equal(t.sub, 1000);
  });

  it("copies and loads price master JSON", () => {
    const state = blankState(E);
    state.prices.ac_std = 9100;
    const payload = {
      type: E.PRICE_MASTER_TYPE,
      version: 1,
      prices: E.effectivePrices(state),
    };
    const loaded = E.parsePriceMaster(JSON.stringify(payload));
    assert.equal(loaded.ac_std, 9100);
    assert.equal(loaded.ac_dispose, 3850);
    state.prices = loaded;
    assert.equal(E.getPrice(state, E.itemById.ac_std), 9100);
  });

  it("keeps old bc_quote_state price overrides", () => {
    ls.setItem(
      E.STORAGE_KEY,
      JSON.stringify({
        prices: { ac_std: 8000, recycle: 2200, collect: 3300 },
        selected: { ac_std: { checked: true, qty: 1 } },
        custom: [],
      })
    );
    const state = E.loadState();
    assert.equal(state.prices.ac_std, 8000);
    assert.equal(state.prices.recycle, 2200);
    assert.equal(state.prices.collect, 3300);
    assert.equal(E.getPrice(state, E.itemById.ac_std), 8000);
    assert.equal(E.totals(state).total, 8000);
  });

  it("reset prices restores tax-inclusive catalog defaults", () => {
    const state = blankState(E);
    state.prices = { ac_std: 8000, ac_func: 15000, recycle: 2200, ac_dispose: 9999 };
    state.prices = {};
    assert.equal(E.getPrice(state, E.itemById.ac_std), 9000);
    assert.equal(E.getPrice(state, E.itemById.ac_func), 16000);
    assert.equal(E.getPrice(state, E.itemById.recycle), 550);
    assert.equal(E.getPrice(state, E.itemById.ac_dispose), 3850);
  });

  it("quoteText uses tax-inclusive wording", () => {
    const state = select(blankState(E), "install_std", 1);
    const text = E.quoteText(state);
    assert.match(text, /単価は税込/);
    assert.match(text, /税抜参考額：/);
    assert.match(text, /うち消費税：/);
    assert.match(text, /税込合計：¥22,000/);
    assert.doesNotMatch(text, /^税抜：/m);
  });

  it("shows tax-inclusive notice only once for saved overrides", () => {
    const state = blankState(E);
    state.prices = { ac_std: 8000 };
    assert.equal(E.needsTaxInclusiveNotice(state), true);
    E.ackTaxInclusiveNotice();
    assert.equal(E.needsTaxInclusiveNotice(state), false);
    assert.equal(state.prices.ac_std, 8000);
  });
});

describe("AC disposal 3850 consolidated item", () => {
  let ls;
  let E;

  beforeEach(() => {
    ls = createLocalStorage();
    E = loadEstimate(ls);
  });

  it("disposal 1 unit = 3850 tax-inclusive", () => {
    const state = select(blankState(E), "ac_dispose", 1);
    const t = E.totals(state);
    assert.equal(t.total, 3850);
    assert.notEqual(t.total, Math.round(3850 * 1.1));
    assert.equal(t.tax, Math.round(3850 * 10 / 110));
  });

  it("disposal 2 units = 7700", () => {
    const state = select(blankState(E), "ac_dispose", 2);
    assert.equal(E.totals(state).total, 7700);
  });

  it("does not auto-convert or double-add old collect/recycle", () => {
    ls.setItem(
      E.STORAGE_KEY,
      JSON.stringify({
        prices: { collect: 3300, recycle: 550 },
        selected: {
          collect: { checked: true, qty: 1 },
          recycle: { checked: true, qty: 1 },
        },
        custom: [],
      })
    );
    const state = E.loadState();
    assert.equal(state.selected.ac_dispose.checked, false);
    assert.equal(state.prices.collect, 3300);
    assert.equal(state.prices.recycle, 550);
    assert.equal(E.totals(state).total, 3850);
    assert.equal(E.getPrice(state, E.itemById.ac_dispose), 3850);
  });

  it("hides unchecked legacy collect/recycle from catalog display", () => {
    const state = blankState(E);
    const works = E.initialCatalog.find((c) => c.category === "エアコン工事");
    const ids = E.catalogItemsForDisplay(works.items, state).map((x) => x.id);
    assert.ok(ids.includes("ac_dispose"));
    assert.equal(ids.includes("collect"), false);
    assert.equal(ids.includes("recycle"), false);
  });

  it("keeps checked legacy items visible without changing amounts", () => {
    const state = blankState(E);
    select(state, "collect", 1);
    state.prices.collect = 3300;
    const works = E.initialCatalog.find((c) => c.category === "エアコン工事");
    const ids = E.catalogItemsForDisplay(works.items, state).map((x) => x.id);
    assert.ok(ids.includes("collect"));
    assert.equal(E.getPrice(state, E.itemById.collect), 3300);
  });
});

describe("buildFieldLines / mergeLinesIntoState regression", () => {
  let E;

  beforeEach(() => {
    E = loadEstimate(createLocalStorage());
  });

  it("maps field conditions without touching prices", () => {
    const built = E.buildFieldLines({
      installCount: 1,
      removeCount: 1,
      outdoorPlace: "ベランダ",
      hole: "あり",
      holeCount: 1,
      pipeExtM: 2,
      billableWireM: 3,
      cover: "あり",
      workType: "専用コンセント新設",
      dedicatedCircuit: "なし",
    });
    const ids = built.lines.map((l) => l.id);
    assert.ok(ids.includes("install_std"));
    assert.ok(ids.includes("remove_std"));
    assert.ok(ids.includes("dedicated"));
    assert.ok(ids.includes("pipe_ext"));
    assert.ok(ids.includes("wire_ext"));
    assert.ok(ids.includes("hole"));
    assert.ok(ids.includes("cover"));
    assert.equal(ids.includes("ac_dispose"), false);
    assert.equal(ids.includes("collect"), false);
    assert.equal(ids.includes("recycle"), false);
  });

  it("merge keeps unrelated selection and prices", () => {
    const state = blankState(E);
    state.prices.ac_std = 1234;
    select(state, "ac_std", 2);
    select(state, "ac_dispose", 1);
    const next = E.mergeLinesIntoState(state, [{ id: "install_std", qty: 1 }], {
      customer: "テスト",
      note: "室外機：ベランダ",
    });
    assert.equal(next.selected.ac_std.checked, true);
    assert.equal(next.selected.ac_std.qty, 2);
    assert.equal(next.selected.ac_dispose.checked, true);
    assert.equal(next.selected.install_std.checked, true);
    assert.equal(next.prices.ac_std, 1234);
    assert.equal(next.customer, "テスト");
  });
});
