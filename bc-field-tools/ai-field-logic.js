/**
 * BC現場アプリ — 写真AIの現場判断・材料準備ロジック（純関数）
 * IndexedDB / 価格 / OpenAI には触れない。
 */
(() => {
  "use strict";

  const AI_READING_SCHEMA_VERSION = "ai-1";
  const UNLOCKED_VALUES = new Set(["", "不明", "未確認", null, undefined]);
  const BILLING_FIELDS = new Set(["pipeExtM", "billableWireM", "coverLengthM", "wireDistance"]);
  const TARGET_FIELDS = new Set([
    "acVoltage",
    "dedicatedCircuit",
    "outdoorPlace",
    "hole",
    "cover",
    "wiringRoute",
    "voltChange",
    "spareCircuit",
    "other",
  ]);
  const FIELD_VALUE_ALLOW = {
    acVoltage: new Set(["100V", "200V"]),
    dedicatedCircuit: new Set(["あり", "なし"]),
    outdoorPlace: new Set(["通常", "屋根", "壁面", "天吊り", "二段置き", "別階", "その他"]),
    hole: new Set(["あり", "なし"]),
    cover: new Set(["あり", "なし"]),
    wiringRoute: new Set(["不要", "隠蔽できそう", "露出配線になりそう", "現地確認が必要"]),
    voltChange: new Set(["必要", "不要"]),
    spareCircuit: new Set(["あり", "なし"]),
  };
  const FIELD_LABELS = {
    acVoltage: "電圧",
    dedicatedCircuit: "専用回路",
    outdoorPlace: "室外機設置",
    hole: "穴あけ",
    cover: "化粧カバー",
    wiringRoute: "配線ルート",
    voltChange: "電圧切替",
    spareCircuit: "空き回路",
    other: "その他",
  };
  const MATERIAL_LABELS = {
    refrigerant_pipe: "冷媒配管",
    insulated_drain: "断熱ドレン",
    drain_hose: "通常ドレンホース",
    power_cable: "電源配線",
    interconnect: "内外連絡線",
    cover: "化粧カバー",
    sleeve: "スリーブ",
    putty: "パテ",
    stand: "架台",
    bend: "曲がり部材",
    terminal: "端末部材",
    joint: "ジョイント",
    drain_fitting: "ドレン接続部材",
    other: "その他材料",
  };
  const ROLE_LABELS = { indoor: "室内", outdoor: "屋外", prep: "準備", unknown: "区間未確認" };
  const ESTIMATE_IDS = new Set([
    "install_std",
    "remove_std",
    "remove_floor",
    "roof_wall",
    "pipe_ext",
    "cover",
    "dedicated",
    "volt_change",
    "hole",
    "wire_ext",
    "angle",
  ]);
  const SLOT_PURPOSES = {
    "panel-overview": {
      title: "分電盤",
      purpose: "分電盤全体から主幹・分岐・空き・見える電圧表示・異常候補を拾う",
      expectedFacts: ["分電盤全体", "主幹", "分岐回路", "空きスペース", "空き回路", "100V/200V表示", "エアコン回路表示", "焦げ・破損"],
      materialHints: ["専用回路部材は人間確認後"],
      extraPhotos: "文字が読めなければ主幹・分岐のアップを要求する",
    },
    "main-breaker": {
      title: "主幹ブレーカー",
      purpose: "主幹のメーカー・型式・定格・電圧/相の見える表示を拾う。施工可否は決めない",
      expectedFacts: ["メーカー", "型式", "定格電流", "電圧表示", "相線式", "文字判読可否"],
      materialHints: ["ブレーカー定格は確定しない"],
      extraPhotos: "文字がぼけていれば正面近距離の再撮影を要求する",
    },
    "branch-labels": {
      title: "分岐・回路表示",
      purpose: "回路名称・エアコン回路らしき表示・空き回路候補を拾う",
      expectedFacts: ["回路名称", "エアコン回路表示", "見える定格", "空き回路", "空きスペース"],
      materialHints: [],
      extraPhotos: "ラベルが読めなければ追加アップを要求する",
    },
    "ac-nameplate": {
      title: "エアコン銘板",
      purpose: "見える範囲のメーカー・型番・電圧・能力・冷媒を拾う。型番は推測しない",
      expectedFacts: ["メーカー", "型番", "製造年", "100V/200V", "能力", "冷媒", "電源仕様"],
      materialHints: ["型番が読めたら配管サイズは仕様確認必要と出す"],
      extraPhotos: "型番がぼけていれば正面近距離を要求する",
    },
    "indoor-place": {
      title: "室内機",
      purpose: "設置位置・既存穴・配管出口・カバー・露出・障害物を拾う",
      expectedFacts: ["既設/新設位置", "周辺スペース", "既存穴", "配管出口", "配管方向", "化粧カバー", "露出配管", "露出ドレン", "高所", "障害物"],
      materialHints: ["室内断熱ドレン", "化粧カバー", "パテ"],
      extraPhotos: "配管出口や穴が見えなければ別角度を要求する",
    },
    "outdoor-place": {
      title: "室外機",
      purpose: "設置方法・アクセス・配管/ドレン・カバーを拾う",
      expectedFacts: ["床置き", "屋根", "壁面", "天吊り", "二段置き", "別階", "狭所", "架台", "障害物", "配管方向", "ドレン", "化粧カバー"],
      materialHints: ["架台", "スリーブ", "屋外ドレンホース"],
      extraPhotos: "全景と配管取り出しが見える写真が無ければ要求する",
    },
    "existing-outlet": {
      title: "設置場所",
      purpose: "コンセント形状・見える電圧表示・取付壁面・穴・カバーを拾う。接続方法は決めない",
      expectedFacts: ["コンセント形状", "100V/200V表示", "既存穴", "室内機予定位置", "取付壁面", "化粧カバー", "障害物"],
      materialHints: ["コンセント", "化粧カバー"],
      extraPhotos: "差込口全体と表示が読める距離を要求する",
    },
    "route-plan": {
      title: "配線・配管ルート",
      purpose: "ルート・露出/隠蔽・階跨ぎ・距離推定の可否を拾う。根拠が弱い距離は推定不可",
      expectedFacts: ["配管ルート", "配線ルート", "ドレンルート", "露出/隠蔽", "屋内/屋外", "階跨ぎ", "高所", "障害物", "化粧カバー", "既存ルート"],
      materialHints: ["冷媒配管", "断熱ドレン", "通常ドレンホース", "内外連絡線", "化粧カバー直管/曲がり"],
      extraPhotos: "室内から貫通、貫通から室外の欠けを具体的に要求する",
    },
  };
  const REQUIRED_SLOTS = {
    "エアコン新設": ["panel-overview", "ac-nameplate", "indoor-place", "outdoor-place", "existing-outlet", "route-plan"],
    "エアコン交換": ["panel-overview", "ac-nameplate", "indoor-place", "outdoor-place", "existing-outlet", "route-plan"],
    "専用コンセント新設": ["panel-overview", "existing-outlet", "route-plan"],
    "電圧切替を含む可能性": ["panel-overview", "ac-nameplate", "existing-outlet"],
  };

  function emptyReading() {
    return {
      category: "other_visible_observation",
      summary: "",
      visibleFacts: [],
      fieldCandidates: [],
      workCandidates: [],
      estimateCandidates: [],
      materialPlanCandidates: [],
      warnings: [],
      missingInformation: [],
      nextPhotos: [],
      evidence: [],
      uncertainty: [],
      requiredMeasurements: [],
      candidates: [],
      requiredFollowUp: [],
      disclaimers: [],
    };
  }

  function strArr(v, max) {
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x || "").trim()).filter(Boolean).slice(0, max || 8);
  }

  function isHumanLocked(site, field) {
    if (!site || !field || BILLING_FIELDS.has(field)) return false;
    const cur = site[field];
    return !UNLOCKED_VALUES.has(cur);
  }

  function liftLegacyReading(raw) {
    const out = emptyReading();
    out.category = raw.category || out.category;
    out.summary = String(raw.summary || "").trim();
    out.candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    out.evidence = Array.isArray(raw.evidence) ? raw.evidence : [];
    out.uncertainty = strArr(raw.uncertainty, 6);
    out.requiredFollowUp = strArr(raw.requiredFollowUp, 6);
    out.disclaimers = strArr(raw.disclaimers, 6);
    out.visibleFacts = out.candidates.map((c) => {
      const label = c && c.label != null ? String(c.label).trim() : "";
      const value = c && c.value != null ? String(c.value).trim() : "";
      if (label && value && label !== value) return label + "：" + value;
      return label || value;
    }).filter(Boolean);
    out.missingInformation = out.requiredFollowUp.slice();
    out.nextPhotos = out.requiredFollowUp
      .filter((t) => /写真|撮影|アップ|再撮/.test(t))
      .map((instruction) => ({ instruction }));
    const blob = [out.summary].concat(out.visibleFacts).join(" ");
    const addField = (targetField, proposedValue, reason) => {
      out.fieldCandidates.push({
        targetField,
        proposedValue,
        confidence: "medium",
        reason,
        evidence: reason,
        requiresHumanConfirmation: true,
      });
    };
    if (/穴あけ|貫通/.test(blob)) addField("hole", "あり", "写真説明に穴あけ/貫通");
    if (/専用回路.{0,6}なし|専用.*無い|空き回路.{0,4}なし/.test(blob)) {
      addField("dedicatedCircuit", "なし", "写真説明に専用回路なし");
    }
    if (/屋根/.test(blob)) addField("outdoorPlace", "屋根", "写真説明に屋根");
    if (/壁面|壁掛け/.test(blob)) addField("outdoorPlace", "壁面", "写真説明に壁面");
    if (/化粧カバー/.test(blob)) addField("cover", "あり", "写真説明に化粧カバー");
    if (/\b100V\b|１００Ｖ/.test(blob)) addField("acVoltage", "100V", "写真説明に100V");
    if (/\b200V\b|２００Ｖ/.test(blob)) addField("acVoltage", "200V", "写真説明に200V");
    return out;
  }

  function normalizeReading(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyReading();
    const hasNew = Array.isArray(raw.fieldCandidates) || Array.isArray(raw.visibleFacts) || Array.isArray(raw.materialPlanCandidates);
    if (!hasNew && Array.isArray(raw.candidates)) return liftLegacyReading(raw);
    const out = emptyReading();
    out.category = String(raw.category || out.category);
    out.summary = String(raw.summary || "").trim();
    out.visibleFacts = strArr(raw.visibleFacts, 8);
    out.warnings = strArr(raw.warnings, 6);
    out.missingInformation = strArr(raw.missingInformation, 6);
    out.uncertainty = strArr(raw.uncertainty, 6);
    out.requiredMeasurements = strArr(raw.requiredMeasurements, 6);
    out.requiredFollowUp = strArr(raw.requiredFollowUp, 6);
    out.disclaimers = strArr(raw.disclaimers, 6);
    out.candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    out.evidence = Array.isArray(raw.evidence) ? raw.evidence : [];
    out.fieldCandidates = (Array.isArray(raw.fieldCandidates) ? raw.fieldCandidates : [])
      .filter((c) => c && typeof c === "object")
      .map((c) => ({
        targetField: TARGET_FIELDS.has(c.targetField) ? c.targetField : "other",
        proposedValue: String(c.proposedValue || "").trim(),
        confidence: c.confidence === "high" || c.confidence === "low" ? c.confidence : "medium",
        reason: String(c.reason || "").trim(),
        evidence: String(c.evidence || "").trim(),
        requiresHumanConfirmation: true,
      }))
      .filter((c) => c.proposedValue)
      .slice(0, 6);
    out.workCandidates = (Array.isArray(raw.workCandidates) ? raw.workCandidates : [])
      .filter((c) => c && typeof c === "object")
      .map((c) => ({
        key: String(c.key || "other"),
        label: String(c.label || "").trim(),
        reason: String(c.reason || "").trim(),
        confidence: c.confidence === "high" || c.confidence === "low" ? c.confidence : "medium",
      }))
      .filter((c) => c.label)
      .slice(0, 6);
    out.estimateCandidates = (Array.isArray(raw.estimateCandidates) ? raw.estimateCandidates : [])
      .filter((c) => c && typeof c === "object")
      .map((c) => ({
        catalogId: String(c.catalogId || "none"),
        label: String(c.label || "").trim(),
        reason: String(c.reason || "").trim(),
      }))
      .filter((c) => c.label)
      .slice(0, 6);
    out.materialPlanCandidates = (Array.isArray(raw.materialPlanCandidates) ? raw.materialPlanCandidates : [])
      .filter((c) => c && typeof c === "object")
      .map((c) => ({
        material: String(c.material || "other"),
        role: String(c.role || "unknown"),
        label: String(c.label || MATERIAL_LABELS[c.material] || "材料").trim(),
        estimatedMin: Number(c.estimatedMin) || 0,
        estimatedMax: Number(c.estimatedMax) || 0,
        unit: String(c.unit || "").trim() || "式",
        confidence: c.confidence === "high" || c.confidence === "low" ? c.confidence : "medium",
        requiresMeasurement: c.requiresMeasurement !== false,
        basis: String(c.basis || "").trim(),
      }))
      .slice(0, 8);
    out.nextPhotos = (Array.isArray(raw.nextPhotos) ? raw.nextPhotos : [])
      .map((n) => {
        if (typeof n === "string") return { instruction: n.trim() };
        if (n && typeof n === "object") return { instruction: String(n.instruction || "").trim() };
        return null;
      })
      .filter((n) => n && n.instruction)
      .slice(0, 4);
    if (!out.visibleFacts.length && out.candidates.length) {
      out.visibleFacts = liftLegacyReading(raw).visibleFacts;
    }
    if (!out.fieldCandidates.length && out.candidates.length) {
      out.fieldCandidates = liftLegacyReading(raw).fieldCandidates;
    }
    return out;
  }

  function materialLine(m) {
    const name = MATERIAL_LABELS[m.material] || m.label || "材料";
    const role = ROLE_LABELS[m.role] || "";
    const range = formatRange(m.estimatedMin, m.estimatedMax, m.unit);
    const bits = [role ? role + " " + name : name];
    if (range) bits.push(range);
    else bits.push("推定不可");
    if (m.requiresMeasurement) bits.push("要実測");
    bits.push("材料準備用");
    return bits.join("　");
  }

  function formatRange(min, max, unit) {
    const a = Number(min) || 0;
    const b = Number(max) || 0;
    const u = unit || "";
    if (a <= 0 && b <= 0) return "";
    if (a > 0 && b > 0 && a !== b) return "想定 " + a + "〜" + b + u;
    const n = b || a;
    return "想定 " + n + u;
  }

  function estimateStatus(catalogId, knownIds) {
    const id = String(catalogId || "");
    if (!id || id === "none") return { mapped: false, reason: "料金マスターに対応項目なし" };
    if (knownIds && !knownIds.has(id)) return { mapped: false, reason: "料金マスターに対応項目なし" };
    if (!ESTIMATE_IDS.has(id)) return { mapped: false, reason: "料金マスターに対応項目なし" };
    return { mapped: true, catalogId: id };
  }

  function canApplyField(site, targetField, proposedValue) {
    if (!TARGET_FIELDS.has(targetField) || targetField === "other") return false;
    if (BILLING_FIELDS.has(targetField)) return false;
    const allow = FIELD_VALUE_ALLOW[targetField];
    if (allow && !allow.has(proposedValue)) return false;
    return true;
  }

  function suggestionFromField(slotId, cand, site) {
    if (!canApplyField(site, cand.targetField, cand.proposedValue)) return null;
    const current = site && site[cand.targetField];
    const same = current === cand.proposedValue;
    if (same) return null;
    const locked = isHumanLocked(site, cand.targetField);
    return {
      id: slotId + "-" + cand.targetField + "-" + cand.proposedValue,
      slotId,
      key: cand.targetField,
      targetField: cand.targetField,
      proposedValue: cand.proposedValue,
      label: FIELD_LABELS[cand.targetField] ? FIELD_LABELS[cand.targetField] + " " + cand.proposedValue : cand.proposedValue,
      reason: cand.reason || "",
      conflict: Boolean(locked && current && current !== cand.proposedValue),
      currentValue: locked ? current : "",
      status: "pending",
    };
  }

  function collectVoltages(readings, site) {
    const vals = new Set();
    if (site && (site.acVoltage === "100V" || site.acVoltage === "200V")) vals.add(site.acVoltage);
    (readings || []).forEach((r) => {
      (r.fieldCandidates || []).forEach((c) => {
        if (c.targetField === "acVoltage" && (c.proposedValue === "100V" || c.proposedValue === "200V")) {
          vals.add(c.proposedValue);
        }
      });
    });
    return Array.from(vals);
  }

  function detectConflicts(readings, site) {
    const conflicts = [];
    const volts = collectVoltages(readings, site);
    if (volts.includes("100V") && volts.includes("200V")) {
      conflicts.push("電圧情報が一致していません。現地確認してください。");
    }
    let indoorCover = null;
    let outdoorCover = null;
    (readings || []).forEach((r) => {
      if (r.slotId === "indoor-place") {
        (r.fieldCandidates || []).forEach((c) => {
          if (c.targetField === "cover") indoorCover = c.proposedValue;
        });
      }
      if (r.slotId === "outdoor-place" || r.slotId === "route-plan") {
        (r.fieldCandidates || []).forEach((c) => {
          if (c.targetField === "cover") outdoorCover = c.proposedValue;
        });
      }
    });
    if (indoorCover && outdoorCover && indoorCover !== outdoorCover) {
      conflicts.push("化粧カバーが室内と屋外で違って見えます。区間を分けて確認してください。");
    }
    return conflicts;
  }

  function photoCheck(workType, photoPresent, readingsBySlot) {
    const needed = REQUIRED_SLOTS[workType] || REQUIRED_SLOTS["エアコン新設"];
    return needed.map((slotId) => {
      const purpose = SLOT_PURPOSES[slotId] || { title: slotId };
      const has = Boolean(photoPresent && photoPresent[slotId]);
      const reading = readingsBySlot && readingsBySlot[slotId];
      let mark = "×";
      let note = "未撮影";
      if (has && reading && (reading.summary || (reading.visibleFacts && reading.visibleFacts.length))) {
        if (reading.nextPhotos && reading.nextPhotos.length) {
          mark = "△";
          note = reading.nextPhotos[0].instruction;
        } else {
          mark = "✓";
          note = "確認済み候補あり";
        }
      } else if (has) {
        mark = "△";
        note = "写真はあるがAI未読取";
      }
      return { slotId, title: purpose.title, mark, note };
    });
  }

  function mergeMaterials(readings) {
    const rows = [];
    (readings || []).forEach((r) => {
      (r.materialPlanCandidates || []).forEach((m) => rows.push(m));
    });
    return rows;
  }

  function buildAiContext(slotId, site, workType, otherSummaries) {
    const purpose = SLOT_PURPOSES[slotId] || { title: slotId, purpose: "", expectedFacts: [], materialHints: [] };
    const confirmed = {};
    ["acVoltage", "dedicatedCircuit", "outdoorPlace", "hole", "cover", "wiringRoute", "voltChange", "workType"].forEach((k) => {
      const src = k === "workType" ? workType : site && site[k];
      if (src && !UNLOCKED_VALUES.has(src)) confirmed[k] = src;
    });
    return {
      slotKey: slotId,
      slotTitle: purpose.title,
      photoPurpose: purpose.purpose,
      expectedFacts: purpose.expectedFacts || [],
      materialHints: purpose.materialHints || [],
      workType: workType || "",
      confirmedSite: confirmed,
      otherPhotoSummaries: (otherSummaries || []).slice(0, 7),
    };
  }

  function persistableSlot(slotId, slotTitle, reading, suggestions, analyzedAt) {
    return {
      slotId,
      slotTitle: slotTitle || slotId,
      schemaVersion: AI_READING_SCHEMA_VERSION,
      analyzedAt: analyzedAt || new Date().toISOString(),
      reading: normalizeReading(reading),
      suggestions: (suggestions || []).map((s) => ({
        id: s.id,
        key: s.key,
        targetField: s.targetField,
        proposedValue: s.proposedValue,
        label: s.label,
        status: s.status,
        reason: s.reason || "",
        conflict: Boolean(s.conflict),
      })),
    };
  }

  window.BCFDAiField = {
    AI_READING_SCHEMA_VERSION,
    BILLING_FIELDS,
    TARGET_FIELDS,
    FIELD_LABELS,
    MATERIAL_LABELS,
    SLOT_PURPOSES,
    REQUIRED_SLOTS,
    ESTIMATE_IDS,
    emptyReading,
    normalizeReading,
    liftLegacyReading,
    isHumanLocked,
    canApplyField,
    suggestionFromField,
    detectConflicts,
    photoCheck,
    mergeMaterials,
    materialLine,
    formatRange,
    estimateStatus,
    buildAiContext,
    persistableSlot,
  };
})();
