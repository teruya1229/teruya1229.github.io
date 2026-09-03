(() => {
  "use strict";

  const PRICE_MASTER_TYPE = "bc_estimate_price_master";
  const STORAGE_KEY = "bc_quote_state";

  const initialCatalog = [
    {
      category: "エアコンクリーニング",
      items: [
        { id: "ac_std", name: "家庭用エアコン 通常分解", price: 8000, unit: "台", status: "参考初期値" },
        { id: "ac_func", name: "お掃除機能付き", price: 15000, unit: "台", status: "参考初期値" },
        { id: "ac_full_add", name: "完全分解 追加", price: 6000, unit: "台", status: "参考初期値" },
        { id: "ac_outdoor", name: "室外機洗浄", price: 3000, unit: "台", status: "参考初期値" },
        { id: "ac_multi_disc", name: "2台目以降 値引き", price: -1000, unit: "台", status: "参考初期値" },
        { id: "ac_ceiling", name: "業務用 天井カセット", price: 22000, unit: "台", status: "参考初期値" },
      ],
    },
    {
      category: "クリーニング全般",
      items: [
        { id: "washer_vert", name: "縦型洗濯機 分解洗浄", price: 17600, unit: "台", status: "参考初期値" },
        { id: "washer_drum", name: "ドラム式洗濯機 分解洗浄", price: 27500, unit: "台", status: "参考初期値" },
        { id: "bath", name: "浴室クリーニング", price: 18000, unit: "式", status: "要確認" },
        { id: "hood", name: "レンジフード", price: 15000, unit: "式", status: "要確認" },
        { id: "vacant_1k", name: "空室清掃 1R〜1K", price: 20000, unit: "式", status: "要確認" },
      ],
    },
    {
      category: "エアコン販売",
      items: [
        { id: "ac_body", name: "エアコン本体", price: 60000, unit: "台", status: "推奨初期値・機種で変更" },
        { id: "ac_sale_margin", name: "販売利益 / 調整額", price: 20000, unit: "式", status: "推奨初期値" },
        { id: "delivery", name: "配送・搬入追加", price: 5500, unit: "式", status: "推奨初期値" },
      ],
    },
    {
      category: "エアコン工事",
      items: [
        { id: "install_std", name: "標準取付", price: 22000, unit: "台", status: "参考初期値" },
        { id: "remove_std", name: "既設取外し", price: 5500, unit: "台", status: "参考初期値" },
        { id: "remove_floor", name: "別階取外し", price: 11000, unit: "台", status: "参考初期値" },
        { id: "roof_wall", name: "屋根置き・壁面など", price: 12100, unit: "台", status: "参考初期値" },
        { id: "pipe_ext", name: "配管延長", price: 3500, unit: "m", status: "要確認" },
        { id: "pipe_reuse", name: "既存配管再利用 値引き", price: -4400, unit: "式", status: "参考初期値" },
        { id: "collect", name: "収集運搬", price: 3300, unit: "台", status: "参考初期値" },
        { id: "recycle", name: "リサイクル料金", price: 2200, unit: "台", status: "推奨初期値" },
        { id: "cover", name: "化粧カバー追加", price: 13200, unit: "式", status: "推奨初期値" },
        { id: "angle", name: "アングル設置", price: 16500, unit: "式", status: "推奨初期値" },
      ],
    },
    {
      category: "軽い電気工事",
      items: [
        { id: "outlet", name: "コンセント交換", price: 5000, unit: "箇所", status: "要確認" },
        { id: "dedicated", name: "専用回路", price: 18000, unit: "回路", status: "要確認" },
        { id: "breaker", name: "ブレーカー交換", price: 15000, unit: "個", status: "要確認" },
        { id: "volt_change", name: "100V / 200V 電圧切替", price: 5500, unit: "回路", status: "推奨初期値" },
        { id: "hole", name: "穴あけ追加", price: 8800, unit: "箇所", status: "推奨初期値" },
        { id: "wire_ext", name: "配線延長", price: 2200, unit: "m", status: "推奨初期値" },
      ],
    },
  ];

  const knownIds = new Set(initialCatalog.flatMap((cat) => cat.items.map((item) => item.id)));
  const itemById = {};
  initialCatalog.forEach((cat) => {
    cat.items.forEach((item) => {
      itemById[item.id] = { ...item, category: cat.category };
    });
  });

  const ROOF_WALL_PLACES = new Set(["屋根", "壁面"]);
  const UNPRICED_PLACES = new Set(["天吊り", "二段置き", "その他"]);

  function yen(n) {
    return "¥" + (Math.round(Number(n) || 0) || 0).toLocaleString("ja-JP");
  }

  function loadState() {
    let state = {};
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch (_) {
      state = {};
    }
    if (!state || typeof state !== "object" || Array.isArray(state)) state = {};
    if (!state.prices || typeof state.prices !== "object" || Array.isArray(state.prices)) state.prices = {};
    if (!state.selected || typeof state.selected !== "object" || Array.isArray(state.selected)) state.selected = {};
    if (!Array.isArray(state.custom)) state.custom = [];
    knownIds.forEach((id) => {
      if (!state.selected[id]) state.selected[id] = { checked: false, qty: 1 };
      if (typeof state.selected[id].qty !== "number") {
        const n = Number(state.selected[id].qty);
        state.selected[id].qty = Number.isFinite(n) ? n : 1;
      }
      state.selected[id].checked = Boolean(state.selected[id].checked);
    });
    return state;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getPrice(state, item) {
    return state.prices[item.id] ?? item.price;
  }

  function selectedRows(state) {
    const rows = [];
    initialCatalog.forEach((cat) =>
      cat.items.forEach((item) => {
        const st = state.selected[item.id];
        if (st && st.checked) {
          rows.push({
            id: item.id,
            name: item.name,
            price: getPrice(state, item),
            qty: Number(st.qty || 0),
            unit: item.unit,
            category: cat.category,
          });
        }
      })
    );
    state.custom.forEach((x, i) => rows.push({ ...x, customIndex: i }));
    return rows;
  }

  function totals(state) {
    const rows = selectedRows(state);
    const sub = rows.reduce((a, r) => a + Number(r.price || 0) * Number(r.qty || 0), 0);
    const tax = Math.round(sub * 0.1);
    return { sub, tax, total: sub + tax, count: rows.length, rows };
  }

  function effectivePrices(state) {
    const prices = {};
    initialCatalog.forEach((cat) =>
      cat.items.forEach((item) => {
        prices[item.id] = getPrice(state, item);
      })
    );
    return prices;
  }

  function parsePriceMaster(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("JSONオブジェクトではありません");
    }
    const source =
      data.prices && typeof data.prices === "object" && !Array.isArray(data.prices) ? data.prices : data;
    if (data.type && data.type !== PRICE_MASTER_TYPE) {
      throw new Error("料金ファイルの形式ではありません");
    }
    const next = {};
    let count = 0;
    knownIds.forEach((id) => {
      if (source[id] !== undefined && source[id] !== "") {
        const n = Number(source[id]);
        if (!Number.isFinite(n)) throw new Error(`${id} の単価が数値ではありません`);
        next[id] = n;
        count += 1;
      }
    });
    if (!count) throw new Error("適用できる単価がありません");
    return next;
  }

  function addLine(list, id, qty, reason) {
    const item = itemById[id];
    if (!item || !(qty > 0)) return;
    const existing = list.find((x) => x.id === id);
    if (existing) {
      existing.qty = qty;
      if (reason && !existing.reason.includes(reason)) existing.reason += " / " + reason;
      return;
    }
    list.push({ id, name: item.name, qty, unit: item.unit, reason: reason || "" });
  }

  /**
   * Convert confirmed field conditions into estimate lines.
   * Does not read or write prices.
   */
  function buildFieldLines(site) {
    const lines = [];
    const notices = [];
    const materials = [];
    const s = site || {};

    const installCount = Number(s.installCount) || 0;
    const removeCount = Number(s.removeCount) || 0;
    const holeCount = s.hole === "あり" ? Math.max(1, Number(s.holeCount) || 1) : 0;
    const pipeExtM = Number(s.pipeExtM) || 0;
    const billableWireM = Number(s.billableWireM) || 0;
    const coverOn = s.cover === "あり";
    const place = s.outdoorPlace || "";

    addLine(lines, "install_std", installCount, "取付");
    if (place === "別階" && removeCount > 0) {
      addLine(lines, "remove_floor", removeCount, "別階の取外し");
    } else {
      addLine(lines, "remove_std", removeCount, "既設取外し");
    }

    const dedicatedNeeded = s.workType === "専用コンセント新設" || s.dedicatedCircuit === "なし";
    if (dedicatedNeeded) addLine(lines, "dedicated", 1, "専用回路の工事");

    if (s.workType === "電圧切替を含む可能性" || s.voltChange === "必要") {
      addLine(lines, "volt_change", 1, "電圧切替");
    }

    if (pipeExtM > 0) addLine(lines, "pipe_ext", pipeExtM, "追加配管");
    if (billableWireM > 0) addLine(lines, "wire_ext", billableWireM, "追加料金になる配線延長");
    if (holeCount > 0) addLine(lines, "hole", holeCount, "穴あけ");
    if (coverOn) addLine(lines, "cover", 1, "化粧カバー");

    if (ROOF_WALL_PLACES.has(place)) {
      addLine(lines, "roof_wall", Math.max(1, installCount || 1), "屋根置き・壁面");
    } else if (UNPRICED_PLACES.has(place)) {
      notices.push({
        title: "料金未設定・要確認",
        detail: "室外機の設置場所「" + place + "」は、今の料金に項目がありません。金額へは入れていません。",
      });
    }

    if (dedicatedNeeded) {
      const wiringQty =
        Number.isFinite(Number(s.wireDistance)) && !s.wireDistanceUnknown && Number(s.wireDistance) > 0
          ? Number(s.wireDistance)
          : null;
      materials.push({ name: "配線材", qty: wiringQty, unit: "m", note: "サイズ：現地確認" });
      materials.push({ name: "ブレーカー", qty: 1, unit: "個", note: "定格：現地確認" });
      materials.push({ name: "コンセント", qty: 1, unit: "個", note: "形状・定格：現地確認" });
      if (s.wiringRoute === "露出配線になりそう") {
        materials.push({ name: "配線保護材", qty: wiringQty, unit: "m", note: "ルート確定後に数量確認" });
      }
      materials.push({ name: "貫通処理材", qty: holeCount || null, unit: "箇所分", note: "壁材は現地確認" });
    }
    if (holeCount > 0 && !dedicatedNeeded) {
      materials.push({ name: "貫通処理材", qty: holeCount, unit: "箇所分", note: "壁材は現地確認" });
    }
    if (coverOn) {
      materials.push({
        name: "化粧カバー部材",
        qty: s.coverLengthM != null && s.coverLengthM !== "" ? Number(s.coverLengthM) : null,
        unit: "m",
        note: "曲がり等の内訳は現地確認",
      });
    }

    if (
      billableWireM > 0 &&
      Number.isFinite(Number(s.wireDistance)) &&
      !s.wireDistanceUnknown &&
      billableWireM > Number(s.wireDistance)
    ) {
      notices.push({
        title: "数量の確認",
        detail: "追加料金になる配線延長が、総配線距離より大きくなっています。",
      });
    }

    return { lines, notices, materials };
  }

  /**
   * Merge field-confirmed lines into existing quote.
   * Never clears unrelated selected items, custom rows, or prices.
   */
  function mergeLinesIntoState(state, lines, meta) {
    const next = state;
    (lines || []).forEach((line) => {
      if (!knownIds.has(line.id) || !(line.qty > 0)) return;
      if (!next.selected[line.id]) next.selected[line.id] = { checked: false, qty: 1 };
      next.selected[line.id].checked = true;
      next.selected[line.id].qty = Number(line.qty);
    });
    if (meta && meta.customer && !String(next.customer || "").trim()) {
      next.customer = meta.customer;
    }
    if (meta && meta.note) {
      const extra = String(meta.note);
      const current = String(next.note || "");
      if (extra && !current.includes(extra)) {
        next.note = current ? current + "\n" + extra : extra;
      }
    }
    return next;
  }

  function quoteText(state) {
    const { sub, tax, total, rows } = totals(state);
    return [
      "【BCサービス 内部見積】",
      state.customer ? `案件：${state.customer}` : "",
      state.memo ? `メモ：${state.memo}` : "",
      "",
      ...rows.map((r) => `・${r.name}　${yen(r.price)} × ${r.qty}${r.unit} ＝ ${yen(r.price * r.qty)}`),
      "",
      `税抜：${yen(sub)}`,
      `消費税：${yen(tax)}`,
      `税込合計：${yen(total)}`,
      state.note ? `条件：${state.note}` : "",
      "",
      "※内部試算。現地条件・料金確認後に正式確定。",
    ]
      .filter((line, i, arr) => line !== "" || (arr[i - 1] !== "" && i !== 0))
      .filter(Boolean)
      .join("\n");
  }

  window.BCEstimate = {
    PRICE_MASTER_TYPE,
    STORAGE_KEY,
    initialCatalog,
    knownIds,
    itemById,
    yen,
    loadState,
    saveState,
    getPrice,
    selectedRows,
    totals,
    effectivePrices,
    parsePriceMaster,
    buildFieldLines,
    mergeLinesIntoState,
    quoteText,
  };
})();
