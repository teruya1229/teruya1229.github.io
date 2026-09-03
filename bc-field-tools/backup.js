/**
 * BC現場写真診断 — .bcfd バックアップ形式（純粋処理 + ブラウザUI接続）
 * Node (node:test) とブラウザの両方で利用可能。
 */
(function (root) {
  "use strict";

  const MAGIC = "BCFD0001";
  const HEADER_SIZE = 44;
  const FORMAT_VERSION = 1;
  const FORMAT_NAME = "bc-field-diagnosis-backup";
  const MIME_TYPE = "application/vnd.bc-field-diagnosis";
  const APP_SCHEMA_SUPPORTED = ["1B-2A"];

  const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1 GiB
  const MAX_MANIFEST_BYTES = 5 * 1024 * 1024; // 5 MiB
  const MAX_PHOTOS = 17;
  const MAX_PHOTO_BYTES = 100 * 1024 * 1024; // 100 MiB
  const MAX_FILENAME = 255;
  const MAX_STRING = 20000;
  const MAX_ARRAY = 500;
  const MAX_DEPTH = 32;

  const KNOWN_SLOT_KEYS = [
    "panel-overview",
    "main-breaker",
    "branch-labels",
    "ac-nameplate",
    "existing-outlet",
    "indoor-place",
    "outdoor-place",
    "route-plan",
    "exec-before",
    "exec-wiring",
    "exec-terminal",
    "exec-before-conceal",
    "comp-panel",
    "comp-outlet",
    "comp-indoor",
    "comp-outdoor",
    "comp-finish",
  ];

  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

  const BLOCKED_IMAGE_TYPES = new Set(["image/svg+xml", "text/html", "application/xhtml+xml"]);

  function getSubtle() {
    if (root.crypto && root.crypto.subtle) return root.crypto.subtle;
    try {
      // Node.js
      const nodeCrypto = require("crypto");
      if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) return nodeCrypto.webcrypto.subtle;
    } catch (_) {
      /* ignore */
    }
    throw new Error("Web Crypto API (subtle) is unavailable");
  }

  function toArrayBuffer(data) {
    if (data instanceof ArrayBuffer) return data;
    if (ArrayBuffer.isView(data)) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    throw new Error("Unsupported binary data type");
  }

  async function sha256Bytes(data) {
    const subtle = getSubtle();
    const ab = toArrayBuffer(data);
    const digest = await subtle.digest("SHA-256", ab);
    return new Uint8Array(digest);
  }

  async function sha256Hex(data) {
    const bytes = await sha256Bytes(data);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function textEncoder() {
    return new TextEncoder();
  }

  function textDecoder() {
    return new TextDecoder("utf-8", { fatal: true });
  }

  function buildHeader(manifestLength, manifestHashBytes) {
    if (!(manifestHashBytes instanceof Uint8Array) || manifestHashBytes.length !== 32) {
      throw new Error("manifest hash must be 32 bytes");
    }
    if (!Number.isInteger(manifestLength) || manifestLength < 0 || manifestLength > MAX_MANIFEST_BYTES) {
      throw new Error("invalid manifest length");
    }
    const header = new Uint8Array(HEADER_SIZE);
    for (let i = 0; i < 8; i++) header[i] = MAGIC.charCodeAt(i);
    header[8] = (manifestLength >>> 24) & 0xff;
    header[9] = (manifestLength >>> 16) & 0xff;
    header[10] = (manifestLength >>> 8) & 0xff;
    header[11] = manifestLength & 0xff;
    header.set(manifestHashBytes, 12);
    return header;
  }

  function parseHeader(headerBytes) {
    const bytes =
      headerBytes instanceof Uint8Array
        ? headerBytes
        : new Uint8Array(toArrayBuffer(headerBytes));
    if (bytes.length < HEADER_SIZE) {
      throw makeBackupError("HeaderTooShort", "ファイルヘッダーが短すぎます。");
    }
    let magic = "";
    for (let i = 0; i < 8; i++) magic += String.fromCharCode(bytes[i]);
    if (magic !== MAGIC) {
      throw makeBackupError("MagicMismatch", "バックアップファイルの形式が不正です（magic不一致）。");
    }
    const manifestLength = ((bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11]) >>> 0;
    const manifestHash = bytes.slice(12, 44);
    return { magic, manifestLength, manifestHash };
  }

  function makeBackupError(name, message, extra) {
    return Object.assign(new Error(message), { name, ...(extra || {}) });
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function assertSafeKey(key) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw makeBackupError("PrototypePollution", "不正なキーが含まれています: " + key);
    }
  }

  function validateJsonValue(value, depth, path) {
    if (depth > MAX_DEPTH) {
      throw makeBackupError("SnapshotTooDeep", "snapshotの階層が深すぎます: " + path);
    }
    if (value === null) return;
    const t = typeof value;
    if (t === "string") {
      if (value.length > MAX_STRING) {
        throw makeBackupError("StringTooLong", "文字列が長すぎます: " + path);
      }
      if (/^blob:/i.test(value) || /^data:/i.test(value)) {
        throw makeBackupError("ForbiddenUrl", "snapshotにblob:/data: URLは含められません: " + path);
      }
      return;
    }
    if (t === "number") {
      if (!Number.isFinite(value)) {
        throw makeBackupError("InvalidNumber", "不正な数値です: " + path);
      }
      return;
    }
    if (t === "boolean") return;
    if (t === "function" || t === "undefined" || t === "symbol" || t === "bigint") {
      throw makeBackupError("InvalidType", "許可されない型です: " + path);
    }
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      throw makeBackupError("InvalidType", "snapshotにBlobは含められません: " + path);
    }
    if (typeof File !== "undefined" && value instanceof File) {
      throw makeBackupError("InvalidType", "snapshotにFileは含められません: " + path);
    }
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY) {
        throw makeBackupError("ArrayTooLarge", "配列が大きすぎます: " + path);
      }
      for (let i = 0; i < value.length; i++) {
        validateJsonValue(value[i], depth + 1, path + "[" + i + "]");
      }
      return;
    }
    if (!isPlainObject(value)) {
      throw makeBackupError("InvalidType", "plain object以外は許可されません: " + path);
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      assertSafeKey(keys[i]);
      validateJsonValue(value[keys[i]], depth + 1, path + "." + keys[i]);
    }
  }

  function validateAndNormalizeSnapshot(snapshot) {
    if (!isPlainObject(snapshot)) {
      throw makeBackupError("InvalidSnapshot", "snapshotが不正です。");
    }
    validateJsonValue(snapshot, 0, "snapshot");
    const schema = snapshot.schemaVersion;
    if (typeof schema !== "string" || !APP_SCHEMA_SUPPORTED.includes(schema)) {
      throw makeBackupError(
        "UnsupportedSchema",
        "このアプリでは対応していない新しいバックアップです（schema: " + String(schema) + "）。"
      );
    }
    // Deep clone via JSON to strip unexpected prototypes (already validated JSON-safe).
    return JSON.parse(JSON.stringify(snapshot));
  }

  function validatePhotoMime(mimeType) {
    const mime = String(mimeType || "").toLowerCase();
    if (!mime || BLOCKED_IMAGE_TYPES.has(mime) || mime === "text/html") {
      throw makeBackupError("ForbiddenMime", "許可されていない写真形式です: " + mime);
    }
    if (!ALLOWED_IMAGE_TYPES.has(mime)) {
      throw makeBackupError("ForbiddenMime", "許可されていない写真形式です: " + mime);
    }
  }

  function validateManifest(manifest, options) {
    const opts = options || {};
    const fileSize = opts.fileSize;
    if (!isPlainObject(manifest)) {
      throw makeBackupError("InvalidManifest", "manifestが不正です。");
    }
    if (manifest.format !== FORMAT_NAME) {
      throw makeBackupError("FormatMismatch", "バックアップ形式が一致しません。");
    }
    if (manifest.formatVersion !== FORMAT_VERSION) {
      throw makeBackupError(
        "UnsupportedFormatVersion",
        "対応していないバックアップ形式バージョンです。"
      );
    }
    if (typeof manifest.appSchemaVersion !== "string" || !APP_SCHEMA_SUPPORTED.includes(manifest.appSchemaVersion)) {
      throw makeBackupError(
        "UnsupportedSchema",
        "このアプリでは対応していない新しいバックアップです。"
      );
    }
    if (typeof manifest.exportedAt !== "string" || !manifest.exportedAt) {
      throw makeBackupError("InvalidManifest", "exportedAtが不正です。");
    }
    if (!isPlainObject(manifest.source) || typeof manifest.source.caseId !== "string") {
      throw makeBackupError("InvalidManifest", "source.caseIdが不正です。");
    }
    if (typeof manifest.source.revision !== "number" || !Number.isFinite(manifest.source.revision)) {
      throw makeBackupError("InvalidManifest", "source.revisionが不正です。");
    }
    if (!isPlainObject(manifest.case)) {
      throw makeBackupError("InvalidManifest", "caseが不正です。");
    }
    const snap = validateAndNormalizeSnapshot(manifest.case.snapshot);
    if (!Array.isArray(manifest.photos)) {
      throw makeBackupError("InvalidManifest", "photosが不正です。");
    }
    if (manifest.photos.length > MAX_PHOTOS) {
      throw makeBackupError("TooManyPhotos", "写真数が上限（17）を超えています。");
    }
    if (typeof manifest.totalPayloadBytes !== "number" || !Number.isInteger(manifest.totalPayloadBytes)) {
      throw makeBackupError("InvalidManifest", "totalPayloadBytesが不正です。");
    }
    if (manifest.totalPayloadBytes < 0 || manifest.totalPayloadBytes > MAX_FILE_BYTES) {
      throw makeBackupError("InvalidManifest", "totalPayloadBytesが範囲外です。");
    }

    const known = new Set(KNOWN_SLOT_KEYS);
    const seen = new Set();
    let expectedOffset = 0;
    const actualKeys = manifest.photos.map((p) => p && p.slotKey);
    for (let i = 1; i < actualKeys.length; i++) {
      if (String(actualKeys[i - 1]).localeCompare(String(actualKeys[i])) > 0) {
        throw makeBackupError("PhotoOrderInvalid", "photosはslotKey順である必要があります。");
      }
    }

    for (let i = 0; i < manifest.photos.length; i++) {
      const p = manifest.photos[i];
      if (!isPlainObject(p)) throw makeBackupError("InvalidPhotoMeta", "写真メタデータが不正です。");
      if (typeof p.slotKey !== "string" || !known.has(p.slotKey)) {
        throw makeBackupError("UnknownSlotKey", "未知のslotKeyです: " + String(p.slotKey));
      }
      if (seen.has(p.slotKey)) {
        throw makeBackupError("DuplicateSlotKey", "slotKeyが重複しています: " + p.slotKey);
      }
      seen.add(p.slotKey);
      if (typeof p.fileName === "string" && p.fileName.length > MAX_FILENAME) {
        throw makeBackupError("FileNameTooLong", "ファイル名が長すぎます。");
      }
      validatePhotoMime(p.mimeType);
      if (!Number.isInteger(p.byteLength) || p.byteLength <= 0 || p.byteLength > MAX_PHOTO_BYTES) {
        throw makeBackupError("InvalidPhotoSize", "写真サイズが不正です: " + p.slotKey);
      }
      if (!Number.isInteger(p.offset) || p.offset < 0) {
        throw makeBackupError("InvalidOffset", "offsetが不正です: " + p.slotKey);
      }
      if (p.offset !== expectedOffset) {
        if (p.offset < expectedOffset) {
          throw makeBackupError("OffsetOverlap", "offsetが重複または逆転しています。");
        }
        throw makeBackupError("OffsetGap", "offsetに隙間があります。");
      }
      if (typeof p.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(p.sha256)) {
        throw makeBackupError("InvalidPhotoHash", "写真hashが不正です（小文字64文字のhexが必要）。");
      }
      expectedOffset += p.byteLength;
    }

    if (expectedOffset !== manifest.totalPayloadBytes) {
      throw makeBackupError("PayloadSizeMismatch", "写真終端とtotalPayloadBytesが一致しません。");
    }

    if (typeof fileSize === "number") {
      // header + manifestLength + payload must equal fileSize (checked by caller with manifestLength)
    }

    return {
      ...manifest,
      case: {
        ...manifest.case,
        snapshot: snap,
      },
    };
  }

  function sanitizeBackupFileName(caseName, date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    const pad = (n) => String(n).padStart(2, "0");
    const stamp =
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "-" +
      pad(d.getHours()) +
      pad(d.getMinutes());
    let base = String(caseName || "").trim() || "案件";
    base = base
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/\.+$/g, "")
      .replace(/\s+$/g, "")
      .replace(/^\.+/, "");
    if (!base) base = "案件";
    if (base.length > 80) base = base.slice(0, 80);
    return "BCFD_" + base + "_" + stamp + ".bcfd";
  }

  /**
   * Build manifest object (photos already hashed and ordered).
   */
  function buildManifest({
    appSchemaVersion,
    exportedAt,
    sourceCaseId,
    sourceRevision,
    caseMeta,
    snapshot,
    photoEntries,
    totalPayloadBytes,
  }) {
    const photos = (photoEntries || [])
      .slice()
      .sort((a, b) => String(a.slotKey).localeCompare(String(b.slotKey)));
    const manifest = {
      format: FORMAT_NAME,
      formatVersion: FORMAT_VERSION,
      appSchemaVersion,
      exportedAt,
      source: {
        caseId: sourceCaseId,
        revision: sourceRevision,
      },
      case: {
        displayName: caseMeta.displayName || "",
        caseNumber: caseMeta.caseNumber || "",
        createdAt: caseMeta.createdAt || "",
        updatedAt: caseMeta.updatedAt || "",
        snapshot,
      },
      photos: photos.map((p) => ({
        slotKey: p.slotKey,
        phase: p.phase || "",
        fileName: p.fileName || "",
        mimeType: p.mimeType,
        byteLength: p.byteLength,
        lastModified: p.lastModified == null ? null : p.lastModified,
        offset: p.offset,
        sha256: p.sha256,
      })),
      totalPayloadBytes,
    };
    validateManifest(manifest);
    return manifest;
  }

  /**
   * Build final backup Blob (browser) or { header, manifestBytes, photoBlobs } parts.
   * Photos are original Blobs — never re-encoded.
   */
  async function buildBackupBlob({ manifest, photoBlobsInOrder }) {
    const manifestJson = JSON.stringify(manifest);
    const manifestBytes = textEncoder().encode(manifestJson);
    if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
      throw makeBackupError("ManifestTooLarge", "manifestが大きすぎます。");
    }
    const manifestHash = await sha256Bytes(manifestBytes);
    const header = buildHeader(manifestBytes.byteLength, manifestHash);
    const parts = [header, manifestBytes];
    for (let i = 0; i < (photoBlobsInOrder || []).length; i++) {
      parts.push(photoBlobsInOrder[i]);
    }
    const inNode = typeof process !== "undefined" && process.versions && process.versions.node;
    if (typeof Blob !== "undefined" && !inNode) {
      return new Blob(parts, { type: MIME_TYPE });
    }
    // Node (and Blob-less environments): concatenate Buffers
    const chunks = parts.map((p) => {
      if (p instanceof Uint8Array) return Buffer.from(p);
      if (typeof Buffer !== "undefined" && Buffer.isBuffer(p)) return p;
      throw new Error("Unsupported part type in Node buildBackupBlob");
    });
    return Buffer.concat(chunks);
  }

  async function readBlobAsUint8Array(blob) {
    if (typeof blob.arrayBuffer === "function") {
      return new Uint8Array(await blob.arrayBuffer());
    }
    // Node Blob polyfill may not exist; Buffer path
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(blob)) {
      return new Uint8Array(blob);
    }
    throw new Error("Cannot read blob bytes");
  }

  /**
   * Hash photos one-by-one; do not retain ArrayBuffers after hashing.
   * Returns { photoEntries, photoBlobsInOrder, totalPayloadBytes }
   */
  async function hashPhotosForExport(photos, onProgress) {
    const sorted = (photos || [])
      .slice()
      .sort((a, b) => String(a.slotKey).localeCompare(String(b.slotKey)));
    if (sorted.length > MAX_PHOTOS) {
      throw makeBackupError("TooManyPhotos", "写真数が上限を超えています。");
    }
    let offset = 0;
    const photoEntries = [];
    const photoBlobsInOrder = [];
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (typeof onProgress === "function") onProgress("hash", i + 1, sorted.length);
      if (!(p.blob instanceof Blob) && !(typeof Buffer !== "undefined" && Buffer.isBuffer(p.blob))) {
        throw makeBackupError("InvalidPhoto", "写真Blobが不正です: " + p.slotKey);
      }
      validatePhotoMime(p.mimeType);
      const byteLength =
        typeof p.blob.size === "number" ? p.blob.size : p.blob.byteLength || p.blob.length;
      if (!byteLength || byteLength > MAX_PHOTO_BYTES) {
        throw makeBackupError("InvalidPhotoSize", "写真サイズが不正です: " + p.slotKey);
      }
      const bytes = await readBlobAsUint8Array(p.blob);
      if (bytes.byteLength !== byteLength) {
        throw makeBackupError("InvalidPhotoSize", "写真サイズが一致しません: " + p.slotKey);
      }
      const sha = await sha256Hex(bytes);
      // Intentionally drop reference to bytes after hash (GC eligible)
      photoEntries.push({
        slotKey: p.slotKey,
        phase: p.phase || "",
        fileName: p.fileName || "",
        mimeType: p.mimeType,
        byteLength,
        lastModified: p.lastModified == null ? null : p.lastModified,
        offset,
        sha256: sha,
      });
      photoBlobsInOrder.push(p.blob);
      offset += byteLength;
    }
    return { photoEntries, photoBlobsInOrder, totalPayloadBytes: offset };
  }

  /**
   * Inspect a File/Blob/Buffer without writing to IndexedDB.
   * Uses slice/subarray — does not load entire file as one ArrayBuffer when File is available.
   */
  async function inspectBackupFile(file, options) {
    const opts = options || {};
    const size = typeof file.size === "number" ? file.size : file.byteLength || file.length;
    if (!Number.isFinite(size) || size < HEADER_SIZE) {
      throw makeBackupError("FileTooSmall", "ファイルが短すぎます。");
    }
    if (size > MAX_FILE_BYTES) {
      throw makeBackupError("FileTooLarge", "ファイルが大きすぎます（上限1GiB）。");
    }

    const headerBuf = await readSlice(file, 0, HEADER_SIZE);
    const { manifestLength, manifestHash } = parseHeader(headerBuf);
    if (manifestLength <= 0 || manifestLength > MAX_MANIFEST_BYTES) {
      throw makeBackupError("InvalidManifestLength", "manifest長が不正です。");
    }
    const manifestEnd = HEADER_SIZE + manifestLength;
    if (manifestEnd > size) {
      throw makeBackupError("ManifestOutOfRange", "manifestがファイル範囲外です。");
    }

    const manifestBytes = await readSlice(file, HEADER_SIZE, manifestEnd);
    const actualHash = await sha256Bytes(manifestBytes);
    if (!equalBytes(actualHash, manifestHash)) {
      throw makeBackupError("ManifestHashMismatch", "manifestの改ざんまたは破損を検出しました。");
    }

    let manifest;
    try {
      const json = textDecoder().decode(manifestBytes);
      manifest = JSON.parse(json);
    } catch (err) {
      throw makeBackupError("ManifestJsonInvalid", "manifest JSONが破損しています。");
    }

    const normalized = validateManifest(manifest, { fileSize: size });
    const payloadStart = manifestEnd;
    const payloadEnd = payloadStart + normalized.totalPayloadBytes;
    if (payloadEnd !== size) {
      if (payloadEnd < size) {
        throw makeBackupError("TrailingData", "ファイル末尾に余分なデータがあります。");
      }
      throw makeBackupError("PayloadTruncated", "写真payloadが途中で切れています。");
    }

    return {
      manifest: normalized,
      payloadStart,
      payloadEnd,
      fileSize: size,
      sourceCaseId: normalized.source.caseId,
    };
  }

  async function verifyPhotoPayloads(file, inspection, onProgress) {
    const { manifest, payloadStart } = inspection;
    const verified = [];
    for (let i = 0; i < manifest.photos.length; i++) {
      const meta = manifest.photos[i];
      if (typeof onProgress === "function") onProgress("verify", i + 1, manifest.photos.length);
      const start = payloadStart + meta.offset;
      const end = start + meta.byteLength;
      if (end > inspection.fileSize) {
        throw makeBackupError("PhotoOutOfRange", "写真がpayload範囲外です: " + meta.slotKey);
      }
      const bytes = await readSlice(file, start, end);
      if (bytes.byteLength !== meta.byteLength) {
        throw makeBackupError("PhotoTruncated", "写真データが途中で切れています: " + meta.slotKey);
      }
      const hex = await sha256Hex(bytes);
      if (hex !== meta.sha256) {
        throw makeBackupError("PhotoHashMismatch", "写真の改ざんまたは破損を検出しました: " + meta.slotKey);
      }
      let blob;
      if (typeof Blob !== "undefined") {
        if (typeof file.slice === "function") {
          blob = file.slice(start, end, meta.mimeType);
        } else {
          blob = new Blob([bytes], { type: meta.mimeType });
        }
      } else {
        blob = Buffer.from(bytes);
      }
      verified.push({
        slotKey: meta.slotKey,
        phase: meta.phase,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        size: meta.byteLength,
        lastModified: meta.lastModified,
        blob,
        sha256: hex,
      });
    }
    return verified;
  }

  async function readSlice(file, start, end) {
    if (typeof file.slice === "function") {
      const part = file.slice(start, end);
      return readBlobAsUint8Array(part);
    }
    if (file instanceof Uint8Array) {
      return file.subarray(start, end);
    }
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(file)) {
      return new Uint8Array(file.subarray(start, end));
    }
    if (file instanceof ArrayBuffer) {
      return new Uint8Array(file.slice(start, end));
    }
    throw new Error("Unsupported file type for slice");
  }

  function equalBytes(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function restoreCaseName(displayName) {
    const base = String(displayName || "").trim() || "（未命名案件）";
    if (base.endsWith("（復元）")) return base;
    return base + "（復元）";
  }

  /**
   * Pure helper: build import case record fields from inspected manifest.
   * NEVER uses source.caseId as the new id.
   */
  function prepareImportCaseRecord({ newCaseId, caseNumber, importedAt, manifest }) {
    if (!newCaseId || newCaseId === manifest.source.caseId) {
      throw makeBackupError("InvalidImportId", "復元先IDにsource.caseIdは使用できません。");
    }
    const snapshot = validateAndNormalizeSnapshot(manifest.case.snapshot);
    const displayName = restoreCaseName(manifest.case.displayName || (snapshot.caseInfo && snapshot.caseInfo.caseName));
    if (snapshot.caseInfo) {
      snapshot.caseInfo.caseName = displayName;
    }
    return {
      id: newCaseId,
      recordVersion: 1,
      createdAt: importedAt,
      updatedAt: importedAt,
      revision: 0,
      displayName,
      caseNumber,
      archiveState: "active",
      importedAt,
      sourceBackup: {
        sourceCaseId: manifest.source.caseId,
        sourceRevision: manifest.source.revision,
        exportedAt: manifest.exportedAt,
      },
      snapshot,
    };
  }

  // --- Browser UI helpers (no-op init outside document) ---

  let downloadUrl = "";
  let downloadTimer = null;
  let busy = false;

  function revokeDownloadUrl() {
    if (downloadUrl && typeof URL !== "undefined" && URL.revokeObjectURL) {
      try {
        URL.revokeObjectURL(downloadUrl);
      } catch (_) {
        /* ignore */
      }
    }
    downloadUrl = "";
    if (downloadTimer) {
      clearTimeout(downloadTimer);
      downloadTimer = null;
    }
  }

  function triggerDownload(blob, fileName) {
    if (typeof document === "undefined") return;
    revokeDownloadUrl();
    downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Safari may need a grace period before revoke
    downloadTimer = setTimeout(() => {
      revokeDownloadUrl();
    }, 60000);
  }

  function setBusy(next) {
    busy = Boolean(next);
    if (typeof document === "undefined") return;
    const exportBtn = document.getElementById("backup-export-btn");
    const importBtn = document.getElementById("backup-import-btn");
    if (exportBtn instanceof HTMLButtonElement) exportBtn.disabled = busy;
    if (importBtn instanceof HTMLButtonElement) importBtn.disabled = busy;
  }

  function setProgress(text) {
    if (typeof document === "undefined") return;
    const el = document.getElementById("backup-progress");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function setBackupError(text) {
    if (typeof document === "undefined") return;
    const el = document.getElementById("backup-error");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function setBackupSuccess(text) {
    if (typeof document === "undefined") return;
    const el = document.getElementById("backup-success");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function clearImportConfirm() {
    if (typeof document === "undefined") return;
    const panel = document.getElementById("backup-import-confirm");
    if (panel) panel.hidden = true;
    const details = document.getElementById("backup-import-details");
    if (details) details.replaceChildren();
    const input = document.getElementById("backup-import-input");
    if (input instanceof HTMLInputElement) input.value = "";
    root.__BCFD_PENDING_IMPORT = null;
  }

  function showImportConfirm(inspection, file) {
    if (typeof document === "undefined") return;
    const panel = document.getElementById("backup-import-confirm");
    const details = document.getElementById("backup-import-details");
    if (!panel || !details) return;
    details.replaceChildren();
    const m = inspection.manifest;
    const rows = [
      ["元案件名", m.case.displayName || "（未命名案件）"],
      ["案件番号", m.case.caseNumber || "—"],
      ["出力日時", m.exportedAt || "—"],
      ["写真枚数", String(m.photos.length)],
      ["ファイルサイズ", String(inspection.fileSize) + " bytes"],
      ["schema version", m.appSchemaVersion || "—"],
      ["注意", "既存案件を上書きせず、新しい案件として復元します"],
      ["注意", "ファイルは暗号化されていません"],
    ];
    rows.forEach(([label, value]) => {
      const p = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      p.appendChild(strong);
      p.appendChild(document.createTextNode(value));
      details.appendChild(p);
    });
    panel.hidden = false;
    root.__BCFD_PENDING_IMPORT = { inspection, file };
  }

  async function exportCurrentCase(hooks) {
    const h = hooks || {};
    if (busy) return false;
    setBackupError("");
    setBackupSuccess("");
    setBusy(true);
    try {
      if (typeof h.beforeExport === "function") {
        const ok = await h.beforeExport();
        if (!ok) return false;
      }
      const confirmed =
        typeof h.confirmPrivacy === "function"
          ? await h.confirmPrivacy()
          : typeof window !== "undefined" &&
            window.confirm(
              "バックアップファイルには、顧客情報・現場記録・写真が含まれます。ファイルは暗号化されていません。安全な場所へ保存してください。"
            );
      if (!confirmed) return false;

      setProgress("保存内容を確認中");
      const bundle = await h.loadBundle();
      if (!bundle || !bundle.caseRecord) {
        throw makeBackupError("CaseMissing", "案件が見つかりません。");
      }
      if (bundle.caseRecord.archiveState === "deleted") {
        throw makeBackupError("CaseDeleted", "削除済み案件はバックアップできません。");
      }

      const photos = (bundle.photos || []).filter((p) => p && p.blob instanceof Blob);
      setProgress("写真を検証中 0/" + photos.length);
      for (let i = 0; i < photos.length; i++) {
        setProgress("写真を検証中 " + (i + 1) + "/" + photos.length);
        validatePhotoMime(photos[i].mimeType || (photos[i].blob && photos[i].blob.type));
        if (!photos[i].blob.size) {
          throw makeBackupError("EmptyPhoto", "空の写真があります: " + photos[i].slotKey);
        }
      }

      const hashed = await hashPhotosForExport(
        photos.map((p) => ({
          slotKey: p.slotKey,
          phase: p.phase || "",
          fileName: p.fileName || "",
          mimeType: p.mimeType || p.blob.type || "image/jpeg",
          lastModified: p.lastModified,
          blob: p.blob,
        })),
        (phase, cur, total) => {
          if (phase === "hash") setProgress("写真hash計算中 " + cur + "/" + total);
        }
      );

      setProgress("バックアップ作成中");
      const snapshot = validateAndNormalizeSnapshot(bundle.caseRecord.snapshot);
      const exportedAt = new Date().toISOString();
      const manifest = buildManifest({
        appSchemaVersion: snapshot.schemaVersion || "1B-2A",
        exportedAt,
        sourceCaseId: bundle.caseRecord.id,
        sourceRevision: Number(bundle.caseRecord.revision) || 0,
        caseMeta: {
          displayName: bundle.caseRecord.displayName || "",
          caseNumber: bundle.caseRecord.caseNumber || "",
          createdAt: bundle.caseRecord.createdAt || "",
          updatedAt: bundle.caseRecord.updatedAt || "",
        },
        snapshot,
        photoEntries: hashed.photoEntries,
        totalPayloadBytes: hashed.totalPayloadBytes,
      });

      const blob = await buildBackupBlob({
        manifest,
        photoBlobsInOrder: hashed.photoBlobsInOrder,
      });
      const fileName = sanitizeBackupFileName(
        bundle.caseRecord.displayName || (snapshot.caseInfo && snapshot.caseInfo.caseName),
        new Date()
      );
      setProgress("ダウンロード準備完了");
      triggerDownload(blob, fileName);
      setBackupSuccess("バックアップファイルを保存しました（暗号化されていません）。");
      setProgress("");
      return true;
    } catch (err) {
      const msg = (err && err.message) || "バックアップに失敗しました。";
      setBackupError(msg);
      setProgress("失敗");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function beginImport(file, hooks) {
    const h = hooks || {};
    if (busy) return false;
    setBackupError("");
    setBackupSuccess("");
    clearImportConfirm();
    if (!file) return false;
    setBusy(true);
    try {
      if (typeof h.beforeImport === "function") {
        const ok = await h.beforeImport();
        if (!ok) {
          setBusy(false);
          return false;
        }
      }
      setProgress("バックアップを検証中");
      const inspection = await inspectBackupFile(file);
      setProgress("写真を検証中");
      await verifyPhotoPayloads(file, inspection, (phase, cur, total) => {
        setProgress("写真を検証中 " + cur + "/" + total);
      });
      setProgress("");
      showImportConfirm(inspection, file);
      return true;
    } catch (err) {
      const msg = (err && err.message) || "バックアップの検証に失敗しました。";
      setBackupError(msg);
      setProgress("失敗");
      clearImportConfirm();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport(hooks) {
    const h = hooks || {};
    const pending = root.__BCFD_PENDING_IMPORT;
    if (!pending || busy) return false;
    setBusy(true);
    setBackupError("");
    setBackupSuccess("");
    try {
      setProgress("写真を再検証中");
      const photos = await verifyPhotoPayloads(pending.file, pending.inspection, (phase, cur, total) => {
        setProgress("写真を検証中 " + cur + "/" + total);
      });
      setProgress("案件を作成中");
      const result = await h.commitImport({
        inspection: pending.inspection,
        photos,
      });
      clearImportConfirm();
      setBackupSuccess("バックアップから新しい案件として復元しました。");
      setProgress("");
      if (typeof h.afterImport === "function") await h.afterImport(result);
      return true;
    } catch (err) {
      const msg = (err && err.message) || "復元に失敗しました。既存案件は変更していません。";
      setBackupError(msg);
      setProgress("失敗");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function cancelImport() {
    clearImportConfirm();
    setProgress("");
    setBackupError("");
  }

  function bindUi(hooks) {
    if (typeof document === "undefined") return;
    const exportBtn = document.getElementById("backup-export-btn");
    const importBtn = document.getElementById("backup-import-btn");
    const importInput = document.getElementById("backup-import-input");
    const confirmBtn = document.getElementById("backup-import-confirm-btn");
    const cancelBtn = document.getElementById("backup-import-cancel-btn");

    exportBtn?.addEventListener("click", () => {
      void exportCurrentCase(hooks);
    });
    importBtn?.addEventListener("click", () => {
      if (busy) return;
      importInput?.click();
    });
    importInput?.addEventListener("change", () => {
      const file = importInput.files && importInput.files[0];
      void beginImport(file, hooks);
    });
    confirmBtn?.addEventListener("click", () => {
      void confirmImport(hooks);
    });
    cancelBtn?.addEventListener("click", () => {
      cancelImport();
    });
  }

  const api = {
    MAGIC,
    HEADER_SIZE,
    FORMAT_VERSION,
    FORMAT_NAME,
    MIME_TYPE,
    APP_SCHEMA_SUPPORTED,
    KNOWN_SLOT_KEYS,
    ALLOWED_IMAGE_TYPES,
    MAX_FILE_BYTES,
    MAX_MANIFEST_BYTES,
    MAX_PHOTOS,
    MAX_PHOTO_BYTES,
    sha256Bytes,
    sha256Hex,
    buildHeader,
    parseHeader,
    validateManifest,
    validateAndNormalizeSnapshot,
    validatePhotoMime,
    buildManifest,
    buildBackupBlob,
    hashPhotosForExport,
    inspectBackupFile,
    verifyPhotoPayloads,
    sanitizeBackupFileName,
    prepareImportCaseRecord,
    restoreCaseName,
    exportCurrentCase,
    beginImport,
    confirmImport,
    cancelImport,
    bindUi,
    revokeDownloadUrl,
    isBusy: () => busy,
  };

  root.BCFDBackup = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
