/**
 * image-prep pure helpers + source contract (Node).
 * Canvas / HEIC decode are exercised in browser harness.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const prepPath = path.join(root, "image-prep.js");
const appPath = path.join(root, "app.js");
const vendorMin = path.join(root, "vendor", "heic2any.min.js");
const fixtures = path.join(__dirname, "fixtures");

function loadPrep() {
  const code = fs.readFileSync(prepPath, "utf8");
  const window = {};
  const document = {
    getElementsByTagName: () => [{ src: "https://example.test/image-prep.js?v=1" }],
    head: { appendChild() {} },
    createElement() {
      return { async: false, src: "", onload: null, onerror: null };
    },
  };
  const sandbox = {
    window,
    document,
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Blob: class Blob {
      constructor(parts, opts) {
        this.parts = parts;
        this.type = (opts && opts.type) || "";
        this.size = 0;
      }
    },
  };
  vm.runInNewContext(code, sandbox, { filename: "image-prep.js" });
  return sandbox.window.BCFDImagePrep;
}

test("image prep module exports and limits", () => {
  const prep = loadPrep();
  assert.equal(prep.PREP_VERSION, 1);
  assert.equal(prep.MAX_LONG_EDGE, 2048);
  assert.equal(prep.MIN_LONG_EDGE, 1280);
  assert.equal(prep.HARD_MAX_BYTES, 4 * 1024 * 1024);
  assert.ok(prep.TARGET_MAX_BYTES < prep.HARD_MAX_BYTES);
  assert.ok(prep.ALLOWED_MIME.includes("image/heic"));
  assert.ok(prep.ALLOWED_MIME.includes("image/png"));
  assert.ok(fs.existsSync(vendorMin));
  assert.ok(fs.statSync(vendorMin).size > 100000);
});

test("normalizeMime and HEIC detection", () => {
  const prep = loadPrep();
  assert.equal(prep.normalizeMime("image/jpg", "a.jpg"), "image/jpeg");
  assert.equal(prep.normalizeMime("", "panel.HEIC"), "image/heic");
  assert.equal(prep.normalizeMime("", "x.webp"), "image/webp");
  assert.equal(prep.normalizeMime("image/png", "x.png"), "image/png");
  assert.equal(prep.isHeicMime("image/heif"), true);
  assert.equal(prep.isHeicMime("image/jpeg"), false);
});

test("fitSize keeps aspect and respects long edge", () => {
  const prep = loadPrep();
  const a = prep.fitSize(4000, 3000, 2048);
  assert.equal(a.width, 2048);
  assert.equal(a.height, 1536);
  const b = prep.fitSize(800, 600, 2048);
  assert.equal(b.width, 800);
  assert.equal(b.height, 600);
  assert.equal(b.scale, 1);
});

test("sourceKey includes prep version and identity fields", () => {
  const prep = loadPrep();
  const k1 = prep.buildSourceKey({
    size: 100,
    lastModified: 1,
    fileName: "a.heic",
    mimeType: "image/heic",
  });
  const k2 = prep.buildSourceKey({
    size: 100,
    lastModified: 1,
    fileName: "a.heic",
    mimeType: "image/heic",
  });
  const k3 = prep.buildSourceKey({
    size: 101,
    lastModified: 1,
    fileName: "a.heic",
    mimeType: "image/heic",
  });
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
  assert.match(k1, /^1\|/);
});

test("fixtures exist for IMG cases", () => {
  const needed = [
    "img1-general.jpg",
    "img2-large.jpg",
    "img3-alpha.png",
    "img4.webp",
    "img5-sample.heic",
    "img6-portrait-orient6.jpg",
    "img7-orient8.jpg",
    "img8-highres.jpg",
    "img9-nameplate.jpg",
    "img10-corrupt.jpg",
  ];
  for (const name of needed) {
    const p = path.join(fixtures, name);
    assert.ok(fs.existsSync(p), name);
    assert.ok(fs.statSync(p).size > 10, name + " size");
  }
  assert.ok(fs.statSync(path.join(fixtures, "img2-large.jpg")).size > 8 * 1024 * 1024);
  // Real HEIC: ftyp/heic brand near start
  const heic = fs.readFileSync(path.join(fixtures, "img5-sample.heic"));
  assert.ok(heic.includes(Buffer.from("ftyp")), "heic ftyp");
});

test("app wires prep before AI fetch and keeps original blob path", () => {
  const appSrc = fs.readFileSync(appPath, "utf8");
  assert.match(appSrc, /ensureAiPrepared/);
  assert.match(appSrc, /prepareForAi/);
  assert.match(appSrc, /aiPrepared/);
  assert.match(appSrc, /prepStatus/);
  assert.match(appSrc, /original/);
  // AI FormData must use prepared blob, not raw state.blob for photo field after prep
  assert.match(appSrc, /form\.append\(\s*"photo",\s*prepared\.blob/);
  assert.match(appSrc, /HARD_MAX_BYTES/);
  assert.doesNotMatch(appSrc, /AI_JPEG_MAX_BYTES/);
});
