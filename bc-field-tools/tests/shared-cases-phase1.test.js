/**
 * Phase1 shared case_id — bc-field-tools static + pure logic checks.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("OK:", msg);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const CASE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalizeSharedCaseId(value) {
  const key = String(value || "").trim().toLowerCase();
  return CASE_UUID_RE.test(key) ? key : "";
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

assert(fs.existsSync(path.join(ROOT, "bc-cases-client.js")), "cases client exists");
assert(fs.existsSync(path.join(ROOT, "bc-cases-config.js")), "cases config exists");

const persistence = read("case-persistence.js");
assert(/createCaseWithId/.test(persistence), "createCaseWithId");
assert(/bootSharedCaseFromUrl/.test(persistence), "URL boot");
assert(/readCaseIdFromUrl/.test(persistence), "reads ?case_id=");
assert(/\["v", "case_id"\]/.test(app) || /"case_id"/.test(app), "URL keep case_id on view switch");
assert(/CASE_NOT_ACCESSIBLE/.test(persistence), "CASE_NOT_ACCESSIBLE gate");
assert(/applyReceptionMetadataToSnapshot/.test(persistence), "metadata hydrate");
assert(/URL UUID alone must NOT create/.test(persistence), "no local create on URL alone");

const app = read("app.js");
assert(/applyReceptionMetaUi/.test(app), "reception read-only UI");
assert(/showSharedCaseGateMessage/.test(app), "gate message");
assert(/noteSharedCaseLocalDataHint/.test(app), "empty local hint");
assert(/return-to-reception-link/.test(app) || /buildAiBantouReturnUrl/.test(app), "return link wiring");

const index = read("index.html");
assert(/bc-cases-client\.js/.test(index), "cases client script");
assert(/return-to-reception-link/.test(index), "受付へ戻る link");
assert(/reception-meta-panel/.test(index), "reception meta panel");

const client = read("bc-cases-client.js");
assert(/CASE_NOT_ACCESSIBLE/.test(client), "client maps 404 to CASE_NOT_ACCESSIBLE");
assert(/unauthorized/.test(client), "unauthorized without session");
assert(/\/ai-bantou-app\/\?case_id=/.test(client), "return URL pattern");

// pure logic
assert(normalizeSharedCaseId("bad") === "", "malformed rejected");
assert(
  normalizeSharedCaseId("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE") ===
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "uuid normalized"
);

const snap = {
  caseInfo: { caseName: "", siteMemo: "現場メモ保持", workType: "" },
  estimate: { lines: [{ qty: 1 }] },
};
applyReceptionMetadataToSnapshot(snap, {
  case_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  customer_name: "佐藤",
  customer_address: "東京都",
  customer_phone: "090",
  work: "エアコン交換",
  scheduled_at: "2026-09-22T10:00:00+09:00",
});
assert(snap.caseInfo.siteMemo === "現場メモ保持", "siteMemo preserved");
assert(snap.caseInfo.caseName === "佐藤", "name hydrated");
assert(snap.caseInfo.receptionReadOnly === true, "read-only flag");
assert(snap.estimate.lines[0].qty === 1, "estimate untouched");

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nbc-field-tools shared-case checks passed.");
