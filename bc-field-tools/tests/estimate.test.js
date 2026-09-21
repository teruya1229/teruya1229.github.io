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
    state.prices = {
      ac_std: 8000,
      ac_func: 15000,
      recycle: 2200,
      ac_dispose: 9999,
      floor_strip_wax: 999,
      high_work: 1,
    };
    state.prices = {};
    assert.equal(E.getPrice(state, E.itemById.ac_std), 9000);
    assert.equal(E.getPrice(state, E.itemById.ac_func), 16000);
    assert.equal(E.getPrice(state, E.itemById.recycle), 550);
    assert.equal(E.getPrice(state, E.itemById.ac_dispose), 3850);
    assert.equal(E.getPrice(state, E.itemById.floor_strip_wax), 1200);
    assert.equal(E.getPrice(state, E.itemById.floor_wax), 400);
    assert.equal(E.getPrice(state, E.itemById.high_work), 3000);
    assert.equal(E.getPrice(state, E.itemById.emergency), 5000);
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

describe("Phase 2 floor / electric / surcharge catalog", () => {
  let ls;
  let E;

  beforeEach(() => {
    ls = createLocalStorage();
    E = loadEstimate(ls);
  });

  function area(id, qty) {
    const state = blankState(E);
    select(state, id, qty);
    return E.totals(state);
  }

  it("floor_wash 300 x 30 = 9000", () => {
    assert.equal(area("floor_wash", 30).total, 9000);
  });

  it("floor_wax 400 x 30 = 12000", () => {
    assert.equal(area("floor_wax", 30).total, 12000);
  });

  it("floor_strip_wax 1200 x 30 = 36000", () => {
    assert.equal(area("floor_strip_wax", 30).total, 36000);
  });

  it("floor_varnish 1200 x 30 = 36000", () => {
    assert.equal(area("floor_varnish", 30).total, 36000);
  });

  it("floor_strip_varnish 1800 x 30 = 54000", () => {
    assert.equal(area("floor_strip_varnish", 30).total, 54000);
  });

  it("floor_sand_varnish 4000 x 30 = 120000", () => {
    assert.equal(area("floor_sand_varnish", 30).total, 120000);
  });

  it("polisher_min 15000 x1 = 15000", () => {
    assert.equal(area("polisher_min", 1).total, 15000);
  });

  it("surcharges stay tax-inclusive without extra 10%", () => {
    const state = blankState(E);
    select(state, "high_work", 1);
    select(state, "emergency", 1);
    const t = E.totals(state);
    assert.equal(t.total, 8000);
    assert.notEqual(t.total, 8800);
  });

  it("night_early adds 30% of work total excluding surcharge category", () => {
    const state = blankState(E);
    select(state, "install_std", 1); // 22000
    select(state, "high_work", 1); // surcharge excluded from base
    select(state, "night_early", 1);
    const t = E.totals(state);
    // base for night = 22000 only => 6600; + high_work 3000 + night 6600 = 31600
    assert.equal(E.nightEarlyAmount(state), 6600);
    assert.equal(t.total, 22000 + 3000 + 6600);
    assert.equal(t.total, 31600);
  });

  it("night_early scopes to work ids only (Phase 3)", () => {
    // 1. install only
    let state = blankState(E);
    select(state, "install_std", 1);
    select(state, "night_early", 1);
    assert.equal(E.nightEarlyAmount(state), 6600);
    assert.equal(E.totals(state).total, 28600);

    // 2. product only => night 0
    state = blankState(E);
    select(state, "ac_body", 1);
    select(state, "night_early", 1);
    assert.equal(E.nightEarlyAmount(state), 0);
    assert.equal(E.totals(state).total, 60000);

    // 3. product + install => night on install only
    state = blankState(E);
    select(state, "ac_body", 1);
    select(state, "install_std", 1);
    select(state, "night_early", 1);
    assert.equal(E.nightEarlyAmount(state), 6600);
    assert.equal(E.totals(state).total, 60000 + 22000 + 6600);
    assert.equal(E.totals(state).total, 88600);

    // 4. dispose excluded
    state = blankState(E);
    select(state, "ac_dispose", 1);
    select(state, "night_early", 1);
    assert.equal(E.nightEarlyAmount(state), 0);
    assert.equal(E.totals(state).total, 3850);

    // 5. high_work not in night base
    state = blankState(E);
    select(state, "install_std", 1);
    select(state, "high_work", 1);
    select(state, "night_early", 1);
    assert.equal(E.nightEarlyAmount(state), 6600);
    assert.equal(E.totals(state).total, 31600);

    // 6. custom excluded
    state = blankState(E);
    state.custom = [{ name: "自由追加", price: 10000, qty: 1, unit: "式" }];
    select(state, "night_early", 1);
    assert.equal(E.nightEarlyAmount(state), 0);
    assert.equal(E.totals(state).total, 10000);

    // 7. floor strip 30㎡
    state = blankState(E);
    select(state, "floor_strip_wax", 30);
    select(state, "night_early", 1);
    assert.equal(E.nightEarlyAmount(state), 10800);
    assert.equal(E.totals(state).total, 46800);

    assert.equal(E.isNightEarlyWorkId("install_std"), true);
    assert.equal(E.isNightEarlyWorkId("ac_body"), false);
    assert.equal(E.isNightEarlyWorkId("ac_dispose"), false);
    assert.equal(E.isNightEarlyWorkId("high_work"), false);
  });

  it("price master copy/load keeps Phase 2 ids", () => {
    const state = blankState(E);
    state.prices.floor_strip_wax = 1100;
    state.prices.switch = 5500;
    const payload = {
      type: E.PRICE_MASTER_TYPE,
      version: 1,
      prices: E.effectivePrices(state),
    };
    assert.equal(payload.prices.floor_strip_wax, 1100);
    assert.equal(payload.prices.ac_dispose, 3850);
    assert.equal(payload.prices.night_early, 0);
    assert.ok(payload.prices.distance_40 === 12000);
    const loaded = E.parsePriceMaster(JSON.stringify(payload));
    assert.equal(loaded.floor_strip_wax, 1100);
    assert.equal(loaded.switch, 5500);
    assert.equal(loaded.polisher_min, 15000);
  });

  it("categories include 床・洗浄 and 追加料金", () => {
    const names = E.initialCatalog.map((c) => c.category);
    assert.ok(names.includes("床・洗浄"));
    assert.ok(names.includes("追加料金"));
    assert.ok(E.itemById.floor_strip_wax.unit === "㎡");
  });
});

describe("Phase 4 per-case estimate vs shared prices", () => {
  let ls;
  let E;

  beforeEach(() => {
    ls = createLocalStorage();
    E = loadEstimate(ls);
  });

  it("keeps case A/B selected isolated and restores A", () => {
    const prices = { install_std: 22000 };
    E.saveSharedPrices(prices);
    ls.setItem(
      E.STORAGE_KEY,
      JSON.stringify({
        prices,
        selected: { ac_std: { checked: true, qty: 9 } },
        custom: [{ name: "旧一時", price: 1, qty: 1, unit: "式" }],
        customer: "一時",
      })
    );

    const caseA = E.hydrateFromCaseEstimate(
      {
        customer: "A",
        selected: { install_std: { checked: true, qty: 1 } },
        custom: [],
      },
      E.loadSharedPrices()
    );
    const caseB = E.hydrateFromCaseEstimate(
      {
        customer: "B",
        selected: { floor_strip_wax: { checked: true, qty: 30 } },
        custom: [{ name: "床調整", price: 500, qty: 1, unit: "式" }],
      },
      E.loadSharedPrices()
    );

    assert.equal(caseA.selected.install_std.checked, true);
    assert.equal(caseA.selected.floor_strip_wax.checked, false);
    assert.equal(caseB.selected.floor_strip_wax.qty, 30);
    assert.equal(caseB.selected.install_std.checked, false);
    assert.equal(caseB.custom[0].name, "床調整");

    const backA = E.hydrateFromCaseEstimate(E.extractCaseEstimate(caseA), E.loadSharedPrices());
    assert.equal(backA.selected.install_std.checked, true);
    assert.equal(backA.selected.floor_strip_wax.checked, false);
    assert.equal(E.totals(backA).total, 22000);

    // temporary LS selected not auto-copied into empty case
    const fresh = E.hydrateFromCaseEstimate(undefined, E.loadSharedPrices());
    assert.equal(fresh.selected.ac_std.checked, false);
    assert.equal(fresh.custom.length, 0);
    assert.equal(fresh.customer, "");
  });

  it("shares prices across cases without mixing selected", () => {
    const a = E.hydrateFromCaseEstimate(
      { selected: { install_std: { checked: true, qty: 1 } } },
      { install_std: 22000, floor_strip_wax: 1200 }
    );
    a.prices.install_std = 23000;
    E.saveSharedPrices(a.prices);
    const b = E.hydrateFromCaseEstimate(
      { selected: { floor_strip_wax: { checked: true, qty: 30 } } },
      E.loadSharedPrices()
    );
    assert.equal(b.prices.install_std, 23000);
    assert.equal(E.totals(b).total, 1200 * 30);
    assert.equal(E.getPrice(b, E.itemById.install_std), 23000);
  });

  it("saveSharedPrices does not destroy temporary selected", () => {
    ls.setItem(
      E.STORAGE_KEY,
      JSON.stringify({
        prices: { ac_std: 9000 },
        selected: { ac_std: { checked: true, qty: 2 } },
        custom: [],
        customer: "一時残す",
      })
    );
    E.saveSharedPrices({ ac_std: 9100, install_std: 22000 });
    const raw = JSON.parse(ls.getItem(E.STORAGE_KEY));
    assert.equal(raw.prices.ac_std, 9100);
    assert.equal(raw.selected.ac_std.qty, 2);
    assert.equal(raw.customer, "一時残す");
  });

  it("empty case estimate has no checked lines", () => {
    const empty = E.emptyCaseEstimate();
    assert.equal(Object.values(empty.selected).some((s) => s.checked), false);
    assert.equal(empty.custom.length, 0);
    const snap = E.extractCaseEstimate(E.hydrateFromCaseEstimate(empty, {}));
    assert.equal(snap.selected.install_std.checked, false);
  });

  it("old snapshot without estimate hydrates empty case fields", () => {
    const state = E.hydrateFromCaseEstimate(null, { ac_dispose: 3850 });
    assert.equal(state.selected.ac_dispose.checked, false);
    assert.equal(state.prices.ac_dispose, 3850);
  });
});
