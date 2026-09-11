"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function loadField() {
  const code = fs.readFileSync(path.join(root, "ai-field-logic.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.BCFDAiField;
}

const F = loadField();

describe("slot purposes", () => {
  it("covers all 8 survey slots without changing ids", () => {
    const ids = [
      "panel-overview",
      "main-breaker",
      "branch-labels",
      "ac-nameplate",
      "existing-outlet",
      "indoor-place",
      "outdoor-place",
      "route-plan",
    ];
    ids.forEach((id) => {
      assert.ok(F.SLOT_PURPOSES[id], id);
      assert.ok(F.SLOT_PURPOSES[id].purpose);
    });
    assert.equal(Object.keys(F.SLOT_PURPOSES).length, 8);
  });
});

describe("schema normalize", () => {
  it("lifts legacy candidates into fieldCandidates", () => {
    const n = F.normalizeReading({
      category: "outlet_label",
      summary: "コンセント表示に200Vが見えます",
      candidates: [{ label: "電圧", value: "200V", confidence: "high" }],
      evidence: [{ kind: "visible_text", text: "200V" }],
      uncertainty: [],
      requiredFollowUp: ["現地確認"],
      disclaimers: ["断定しません"],
    });
    assert.equal(n.summary, "コンセント表示に200Vが見えます");
    assert.ok(n.fieldCandidates.some((c) => c.targetField === "acVoltage" && c.proposedValue === "200V"));
    assert.equal(n.fieldCandidates[0].requiresHumanConfirmation, true);
  });

  it("promotes visible 200V even when AI put only other", () => {
    const n = F.normalizeReading({
      category: "panel_label",
      summary: "エアコン銘板からの情報",
      visibleFacts: ["メーカー: Panasonic", "型番: CS-XXXX", "電圧: SINGLE PHASE 200V"],
      fieldCandidates: [{
        targetField: "other",
        proposedValue: "型番確認が必要",
        confidence: "high",
        reason: "型番が一部不明",
        evidence: "CS-XXXX",
        requiresHumanConfirmation: true,
      }],
      workCandidates: [],
      estimateCandidates: [],
      materialPlanCandidates: [],
      warnings: [],
      missingInformation: [],
      nextPhotos: [],
      evidence: [{ kind: "visible_text", text: "200V" }],
      uncertainty: [],
      requiredMeasurements: [],
    });
    assert.ok(n.fieldCandidates.some((c) => c.targetField === "acVoltage" && c.proposedValue === "200V"));
    const sug = F.suggestionFromField("ac-nameplate", n.fieldCandidates.find((c) => c.targetField === "acVoltage"), { acVoltage: "" });
    assert.equal(sug.proposedValue, "200V");
    assert.equal(sug.status, "pending");
  });

  it("coerces hole=hole into あり", () => {
    const n = F.normalizeReading({
      category: "route_observation",
      summary: "貫通穴が見えます",
      visibleFacts: ["配管用の穴"],
      fieldCandidates: [{
        targetField: "hole",
        proposedValue: "hole",
        confidence: "high",
        reason: "穴が見える",
        evidence: "貫通",
        requiresHumanConfirmation: true,
      }],
      workCandidates: [],
      estimateCandidates: [],
      materialPlanCandidates: [],
      warnings: [],
      missingInformation: [],
      nextPhotos: [],
      evidence: [],
      uncertainty: [],
      requiredMeasurements: [],
    });
    assert.ok(n.fieldCandidates.some((c) => c.targetField === "hole" && c.proposedValue === "あり"));
  });

  it("keeps new schema fields", () => {
    const n = F.normalizeReading({
      category: "route_observation",
      summary: "室内から貫通まで見えます",
      visibleFacts: ["室内露出配管"],
      fieldCandidates: [{
        targetField: "cover",
        proposedValue: "あり",
        confidence: "medium",
        reason: "室内カバー",
        evidence: "カバーが見える",
        requiresHumanConfirmation: true,
      }],
      workCandidates: [{ key: "cover", label: "化粧カバー", reason: "室内", confidence: "medium" }],
      estimateCandidates: [{ catalogId: "cover", label: "化粧カバー追加", reason: "室内カバー" }],
      materialPlanCandidates: [{
        material: "insulated_drain",
        role: "indoor",
        label: "断熱ドレン",
        estimatedMin: 1.5,
        estimatedMax: 2,
        unit: "m",
        confidence: "medium",
        requiresMeasurement: true,
        basis: "室内区間",
      }],
      warnings: [],
      missingInformation: [],
      nextPhotos: [{ instruction: "室外側のルート全体を撮影してください。" }],
      evidence: [],
      uncertainty: [],
      requiredMeasurements: ["冷媒配管総長"],
    });
    assert.equal(n.materialPlanCandidates[0].material, "insulated_drain");
    assert.match(F.materialLine(n.materialPlanCandidates[0]), /材料準備用/);
    assert.equal(n.nextPhotos[0].instruction.includes("室外側"), true);
  });
});

describe("human confirmation and billing isolation", () => {
  it("does not propose the same already-confirmed value", () => {
    const site = { acVoltage: "200V", hole: "", cover: "" };
    const item = F.suggestionFromField("ac-nameplate", {
      targetField: "acVoltage",
      proposedValue: "200V",
      reason: "銘板",
    }, site);
    assert.equal(item, null);
  });

  it("does not auto-apply; conflict is flagged when human value differs", () => {
    const site = { acVoltage: "100V" };
    const item = F.suggestionFromField("ac-nameplate", {
      targetField: "acVoltage",
      proposedValue: "200V",
      reason: "銘板",
    }, site);
    assert.ok(item);
    assert.equal(item.conflict, true);
    assert.equal(F.isHumanLocked(site, "acVoltage"), true);
  });

  it("never maps estimated length fields as apply targets", () => {
    assert.equal(F.canApplyField({}, "pipeExtM", 4), false);
    assert.equal(F.canApplyField({}, "billableWireM", 5), false);
    assert.equal(F.BILLING_FIELDS.has("pipeExtM"), true);
    assert.equal(F.canApplyField({ acVoltage: "" }, "acVoltage", "200V"), true);
  });

  it("unmapped estimate catalog id is rejected", () => {
    const known = new Set(["install_std", "cover"]);
    const bad = F.estimateStatus("breaker", known);
    assert.equal(bad.mapped, false);
    assert.match(bad.reason, /料金マスターに対応項目なし/);
    assert.equal(F.estimateStatus("cover", known).mapped, true);
  });
});

describe("conflicts, photo check, persistence", () => {
  it("detects 100V vs 200V conflict", () => {
    const conflicts = F.detectConflicts([
      { slotId: "ac-nameplate", fieldCandidates: [{ targetField: "acVoltage", proposedValue: "200V" }] },
      { slotId: "existing-outlet", fieldCandidates: [{ targetField: "acVoltage", proposedValue: "100V" }] },
    ], {});
    assert.ok(conflicts.some((c) => /電圧/.test(c)));
  });

  it("marks missing route photo for AC work", () => {
    const checks = F.photoCheck("エアコン交換", { "panel-overview": true }, {
      "panel-overview": { summary: "分電盤", visibleFacts: ["盤"], nextPhotos: [] },
    });
    const route = checks.find((c) => c.slotId === "route-plan");
    assert.equal(route.mark, "×");
    const panel = checks.find((c) => c.slotId === "panel-overview");
    assert.equal(panel.mark, "✓");
  });

  it("persists confirmation status without apply functions", () => {
    const row = F.persistableSlot("indoor-place", "室内機", { summary: "室内", visibleFacts: [] }, [
      { id: "indoor-place-cover-あり", key: "cover", targetField: "cover", proposedValue: "あり", label: "化粧カバー あり", status: "applied" },
    ], "2026-09-11T00:00:00.000Z");
    assert.equal(row.schemaVersion, "ai-1");
    assert.equal(row.suggestions[0].status, "applied");
    assert.equal(row.suggestions[0].apply, undefined);
    const json = JSON.parse(JSON.stringify(row));
    assert.equal(json.reading.summary, "室内");
  });
});

describe("old snapshot compatibility", () => {
  it("missing aiReadings is treated as empty", () => {
    const checks = F.photoCheck("エアコン新設", {}, null);
    assert.ok(checks.length >= 4);
    assert.ok(checks.every((c) => c.mark === "×"));
  });
});
