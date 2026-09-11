"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const backup = require("../backup.js");

function utf8(str) {
  return new TextEncoder().encode(str);
}

function makePhoto(slotKey, bytes, mimeType) {
  const buf = Buffer.from(bytes);
  return {
    slotKey,
    phase: "survey",
    fileName: slotKey + ".bin",
    mimeType: mimeType || "image/png",
    lastModified: 1,
    blob: buf,
  };
}

async function buildValidContainer(photos) {
  const hashed = await backup.hashPhotosForExport(photos);
  const snapshot = {
    schemaVersion: "1B-2A",
    snapshotAt: "2026-01-01T00:00:00.000Z",
    caseInfo: { caseName: "Test", siteMemo: "memo", workType: "" },
    workflow: { currentPhase: "survey", phaseStatus: {} },
    survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
    preparation: { checks: [], stopRecord: {} },
    execution: { materials: [], planChange: {}, extraWorks: [] },
    completion: { measures: [], operationChecks: [] },
    alerts: [],
    photoMetadata: [],
  };
  const manifest = backup.buildManifest({
    appSchemaVersion: "1B-2A",
    exportedAt: "2026-01-01T00:00:00.000Z",
    sourceCaseId: "source-case-id-aaaa",
    sourceRevision: 3,
    caseMeta: {
      displayName: "Test",
      caseNumber: "BC-20260101-000000",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    snapshot,
    photoEntries: hashed.photoEntries,
    totalPayloadBytes: hashed.totalPayloadBytes,
  });
  const file = await backup.buildBackupBlob({
    manifest,
    photoBlobsInOrder: hashed.photoBlobsInOrder,
  });
  return { file, manifest, sourceCaseId: "source-case-id-aaaa" };
}

function corruptAt(buf, index) {
  const out = Buffer.from(buf);
  out[index] = (out[index] + 1) % 256;
  return out;
}

describe("bcfd container format", () => {
  it("1. builds valid container with 0 photos", async () => {
    const { file, manifest } = await buildValidContainer([]);
    assert.equal(manifest.photos.length, 0);
    const inspection = await backup.inspectBackupFile(file);
    assert.equal(inspection.manifest.totalPayloadBytes, 0);
    assert.equal(inspection.fileSize, file.length);
  });

  it("2. builds valid container with 2 photos", async () => {
    const photos = [
      makePhoto("ac-nameplate", [1, 2, 3, 4], "image/jpeg"),
      makePhoto("panel-overview", [9, 8, 7], "image/png"),
    ];
    const { file, manifest } = await buildValidContainer(photos);
    assert.equal(manifest.photos.length, 2);
    assert.equal(manifest.photos[0].slotKey, "ac-nameplate");
    assert.equal(manifest.photos[1].slotKey, "panel-overview");
    const inspection = await backup.inspectBackupFile(file);
    const verified = await backup.verifyPhotoPayloads(file, inspection);
    assert.equal(verified.length, 2);
  });

  it("3. export→inspect preserves snapshot and metadata", async () => {
    const { file, manifest } = await buildValidContainer([
      makePhoto("panel-overview", [1, 1, 1], "image/png"),
    ]);
    const inspection = await backup.inspectBackupFile(file);
    assert.equal(inspection.manifest.case.snapshot.caseInfo.caseName, "Test");
    assert.equal(inspection.manifest.case.caseNumber, manifest.case.caseNumber);
    assert.equal(inspection.manifest.photos[0].byteLength, 3);
  });

  it("4. rejects magic corruption", async () => {
    const { file } = await buildValidContainer([]);
    const bad = Buffer.from(file);
    bad[0] = 0x41;
    await assert.rejects(() => backup.inspectBackupFile(bad), /magic|形式/i);
  });

  it("5. rejects manifest length corruption", async () => {
    const { file } = await buildValidContainer([]);
    const bad = Buffer.from(file);
    bad[8] = 0xff;
    bad[9] = 0xff;
    await assert.rejects(() => backup.inspectBackupFile(bad), /manifest/i);
  });

  it("6. rejects manifest SHA-256 mismatch", async () => {
    const { file } = await buildValidContainer([]);
    const bad = corruptAt(file, 12);
    await assert.rejects(() => backup.inspectBackupFile(bad), /manifest|改ざん|破損/i);
  });

  it("7. rejects broken manifest JSON", async () => {
    const { file } = await buildValidContainer([]);
    // Flip a byte inside manifest region (after header)
    const bad = corruptAt(file, backup.HEADER_SIZE + 2);
    await assert.rejects(() => backup.inspectBackupFile(bad), /JSON|manifest|改ざん|破損/i);
  });

  it("8. rejects formatVersion mismatch", async () => {
    const snapshot = {
      schemaVersion: "1B-2A",
      snapshotAt: "2026-01-01T00:00:00.000Z",
      caseInfo: { caseName: "X", siteMemo: "", workType: "" },
      workflow: { currentPhase: "survey", phaseStatus: {} },
      survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
      preparation: { checks: [], stopRecord: {} },
      execution: { materials: [], planChange: {}, extraWorks: [] },
      completion: { measures: [], operationChecks: [] },
      alerts: [],
      photoMetadata: [],
    };
    const manifest = backup.buildManifest({
      appSchemaVersion: "1B-2A",
      exportedAt: "2026-01-01T00:00:00.000Z",
      sourceCaseId: "s",
      sourceRevision: 1,
      caseMeta: { displayName: "X", caseNumber: "N", createdAt: "", updatedAt: "" },
      snapshot,
      photoEntries: [],
      totalPayloadBytes: 0,
    });
    manifest.formatVersion = 99;
    assert.throws(() => backup.validateManifest(manifest), /バージョン|formatVersion|対応していない/i);
  });

  it("9. rejects photo SHA-256 mismatch", async () => {
    const { file } = await buildValidContainer([makePhoto("panel-overview", [1, 2, 3, 4], "image/png")]);
    const inspection = await backup.inspectBackupFile(file);
    const bad = Buffer.from(file);
    bad[bad.length - 1] = (bad[bad.length - 1] + 1) % 256;
    await assert.rejects(() => backup.verifyPhotoPayloads(bad, { ...inspection, fileSize: bad.length }), /写真|hash|改ざん|破損/i);
  });

  it("10. rejects truncated payload", async () => {
    const { file } = await buildValidContainer([makePhoto("panel-overview", [1, 2, 3, 4, 5], "image/png")]);
    const truncated = file.subarray(0, file.length - 2);
    await assert.rejects(() => backup.inspectBackupFile(truncated), /切れ|Trailing|payload|余分|範囲/i);
  });

  it("11. rejects trailing data", async () => {
    const { file } = await buildValidContainer([]);
    const withTrail = Buffer.concat([file, Buffer.from([0, 1, 2])]);
    await assert.rejects(() => backup.inspectBackupFile(withTrail), /余分|Trailing|一致/i);
  });

  it("12. rejects offset overlap", async () => {
    const manifest = {
      format: backup.FORMAT_NAME,
      formatVersion: 1,
      appSchemaVersion: "1B-2A",
      exportedAt: "2026-01-01T00:00:00.000Z",
      source: { caseId: "s", revision: 1 },
      case: {
        displayName: "T",
        caseNumber: "N",
        createdAt: "",
        updatedAt: "",
        snapshot: {
          schemaVersion: "1B-2A",
          snapshotAt: "2026-01-01T00:00:00.000Z",
          caseInfo: { caseName: "T", siteMemo: "", workType: "" },
          workflow: { currentPhase: "survey", phaseStatus: {} },
          survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
          preparation: { checks: [], stopRecord: {} },
          execution: { materials: [], planChange: {}, extraWorks: [] },
          completion: { measures: [], operationChecks: [] },
          alerts: [],
          photoMetadata: [],
        },
      },
      photos: [
        {
          slotKey: "ac-nameplate",
          phase: "survey",
          fileName: "a.png",
          mimeType: "image/png",
          byteLength: 4,
          lastModified: null,
          offset: 0,
          sha256: "a".repeat(64),
        },
        {
          slotKey: "panel-overview",
          phase: "survey",
          fileName: "b.png",
          mimeType: "image/png",
          byteLength: 4,
          lastModified: null,
          offset: 2,
          sha256: "b".repeat(64),
        },
      ],
      totalPayloadBytes: 8,
    };
    assert.throws(() => backup.validateManifest(manifest), /offset|重複|逆転|隙間/i);
  });

  it("13. rejects offset gap", async () => {
    const manifest = {
      format: backup.FORMAT_NAME,
      formatVersion: 1,
      appSchemaVersion: "1B-2A",
      exportedAt: "2026-01-01T00:00:00.000Z",
      source: { caseId: "s", revision: 1 },
      case: {
        displayName: "T",
        caseNumber: "N",
        createdAt: "",
        updatedAt: "",
        snapshot: {
          schemaVersion: "1B-2A",
          snapshotAt: "2026-01-01T00:00:00.000Z",
          caseInfo: { caseName: "T", siteMemo: "", workType: "" },
          workflow: { currentPhase: "survey", phaseStatus: {} },
          survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
          preparation: { checks: [], stopRecord: {} },
          execution: { materials: [], planChange: {}, extraWorks: [] },
          completion: { measures: [], operationChecks: [] },
          alerts: [],
          photoMetadata: [],
        },
      },
      photos: [
        {
          slotKey: "ac-nameplate",
          phase: "survey",
          fileName: "a.png",
          mimeType: "image/png",
          byteLength: 2,
          lastModified: null,
          offset: 0,
          sha256: "a".repeat(64),
        },
        {
          slotKey: "panel-overview",
          phase: "survey",
          fileName: "b.png",
          mimeType: "image/png",
          byteLength: 2,
          lastModified: null,
          offset: 4,
          sha256: "b".repeat(64),
        },
      ],
      totalPayloadBytes: 4,
    };
    assert.throws(() => backup.validateManifest(manifest), /隙間|offset/i);
  });

  it("14. rejects duplicate slotKey", async () => {
    const manifest = {
      format: backup.FORMAT_NAME,
      formatVersion: 1,
      appSchemaVersion: "1B-2A",
      exportedAt: "2026-01-01T00:00:00.000Z",
      source: { caseId: "s", revision: 1 },
      case: {
        displayName: "T",
        caseNumber: "N",
        createdAt: "",
        updatedAt: "",
        snapshot: {
          schemaVersion: "1B-2A",
          snapshotAt: "2026-01-01T00:00:00.000Z",
          caseInfo: { caseName: "T", siteMemo: "", workType: "" },
          workflow: { currentPhase: "survey", phaseStatus: {} },
          survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
          preparation: { checks: [], stopRecord: {} },
          execution: { materials: [], planChange: {}, extraWorks: [] },
          completion: { measures: [], operationChecks: [] },
          alerts: [],
          photoMetadata: [],
        },
      },
      photos: [
        {
          slotKey: "panel-overview",
          phase: "survey",
          fileName: "a.png",
          mimeType: "image/png",
          byteLength: 1,
          lastModified: null,
          offset: 0,
          sha256: "a".repeat(64),
        },
        {
          slotKey: "panel-overview",
          phase: "survey",
          fileName: "b.png",
          mimeType: "image/png",
          byteLength: 1,
          lastModified: null,
          offset: 1,
          sha256: "b".repeat(64),
        },
      ],
      totalPayloadBytes: 2,
    };
    assert.throws(() => backup.validateManifest(manifest), /重複/i);
  });

  it("15. rejects unknown slotKey", async () => {
    const manifest = {
      format: backup.FORMAT_NAME,
      formatVersion: 1,
      appSchemaVersion: "1B-2A",
      exportedAt: "2026-01-01T00:00:00.000Z",
      source: { caseId: "s", revision: 1 },
      case: {
        displayName: "T",
        caseNumber: "N",
        createdAt: "",
        updatedAt: "",
        snapshot: {
          schemaVersion: "1B-2A",
          snapshotAt: "2026-01-01T00:00:00.000Z",
          caseInfo: { caseName: "T", siteMemo: "", workType: "" },
          workflow: { currentPhase: "survey", phaseStatus: {} },
          survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
          preparation: { checks: [], stopRecord: {} },
          execution: { materials: [], planChange: {}, extraWorks: [] },
          completion: { measures: [], operationChecks: [] },
          alerts: [],
          photoMetadata: [],
        },
      },
      photos: [
        {
          slotKey: "unknown-slot",
          phase: "survey",
          fileName: "a.png",
          mimeType: "image/png",
          byteLength: 1,
          lastModified: null,
          offset: 0,
          sha256: "a".repeat(64),
        },
      ],
      totalPayloadBytes: 1,
    };
    assert.throws(() => backup.validateManifest(manifest), /未知|slotKey/i);
  });

  it("16. rejects SVG/HTML MIME", async () => {
    assert.throws(() => backup.validatePhotoMime("image/svg+xml"), /許可されていない/);
    assert.throws(() => backup.validatePhotoMime("text/html"), /許可されていない/);
  });

  it("17. rejects 18 photos", async () => {
    const photos = backup.KNOWN_SLOT_KEYS.map((k, i) =>
      makePhoto(k, [i + 1], "image/png")
    );
    photos.push(makePhoto("panel-overview", [99], "image/png")); // duplicate + over count via length
    // Build 18 unique by appending fake - hashPhotosForExport checks MAX_PHOTOS
    const eighteen = [];
    for (let i = 0; i < 18; i++) {
      eighteen.push(makePhoto(backup.KNOWN_SLOT_KEYS[i % 17], [i], "image/png"));
    }
    // Force length 18 with unique keys by mutating last to duplicate then validateManifest path
    await assert.rejects(() => backup.hashPhotosForExport(eighteen), /上限|17|写真数/);
  });

  it("18. rejects __proto__ in snapshot", async () => {
    const crafted = { schemaVersion: "1B-2A" };
    Object.defineProperty(crafted, "__proto__", {
      value: { x: 1 },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    assert.throws(() => backup.validateAndNormalizeSnapshot(crafted), /不正なキー|prototype|InvalidSnapshot|snapshot/i);
  });

  it("19. rejects blob: strings", async () => {
    assert.throws(
      () =>
        backup.validateAndNormalizeSnapshot({
          schemaVersion: "1B-2A",
          caseInfo: { caseName: "blob:http://x", siteMemo: "", workType: "" },
        }),
      /blob:|data:/i
    );
  });

  it("20. rejects data: URLs", async () => {
    assert.throws(
      () =>
        backup.validateAndNormalizeSnapshot({
          schemaVersion: "1B-2A",
          caseInfo: { caseName: "ok", siteMemo: "data:text/html,hi", workType: "" },
        }),
      /blob:|data:/i
    );
  });

  it("21. rejects unsupported schema", async () => {
    assert.throws(
      () =>
        backup.validateAndNormalizeSnapshot({
          schemaVersion: "9Z-99",
          caseInfo: { caseName: "x", siteMemo: "", workType: "" },
        }),
      /対応していない|新しいバックアップ/i
    );
  });

  it("22. sanitizes file names", () => {
    const name = backup.sanitizeBackupFileName('a<>:"/\\|?*b.', new Date("2026-07-17T03:04:00+09:00"));
    assert.match(name, /^BCFD_/);
    assert.match(name, /\.bcfd$/);
    assert.doesNotMatch(name, /[<>:"/\\|?*]/);
    assert.ok(!name.includes(".."));
  });

  it("23. keeps XSS string as data without executing", () => {
    const xss = '<img src=x onerror=alert(1)>';
    const snap = backup.validateAndNormalizeSnapshot({
      schemaVersion: "1B-2A",
      snapshotAt: "2026-01-01T00:00:00.000Z",
      caseInfo: { caseName: xss, siteMemo: xss, workType: "" },
      workflow: { currentPhase: "survey", phaseStatus: {} },
      survey: { diagnosed: false, manual: {}, diagnosis: null, unresolved: [] },
      preparation: { checks: [], stopRecord: {} },
      execution: { materials: [], planChange: {}, extraWorks: [] },
      completion: { measures: [], operationChecks: [] },
      alerts: [],
      photoMetadata: [],
    });
    assert.equal(snap.caseInfo.caseName, xss);
  });

  it("24. hash is lowercase 64 hex", async () => {
    const hex = await backup.sha256Hex(utf8("hello"));
    assert.match(hex, /^[0-9a-f]{64}$/);
  });

  it("25. prepareImportCaseRecord never uses source.caseId", async () => {
    const { manifest, sourceCaseId } = await buildValidContainer([]);
    const imported = backup.prepareImportCaseRecord({
      newCaseId: "brand-new-uuid-bbbb",
      caseNumber: "BC-NEW",
      importedAt: "2026-07-17T00:00:00.000Z",
      manifest,
    });
    assert.notEqual(imported.id, sourceCaseId);
    assert.equal(imported.id, "brand-new-uuid-bbbb");
    assert.equal(imported.sourceBackup.sourceCaseId, sourceCaseId);
    assert.ok(String(imported.displayName).includes("（復元）"));
    assert.throws(
      () =>
        backup.prepareImportCaseRecord({
          newCaseId: sourceCaseId,
          caseNumber: "BC-NEW",
          importedAt: "2026-07-17T00:00:00.000Z",
          manifest,
        }),
      /source\.caseId/
    );
  });
});
