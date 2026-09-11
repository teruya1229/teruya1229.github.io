/**
 * BC現場アプリ — 端末内画像前処理（AI送信用）
 *
 * - 元画像は変更しない（呼び出し側が original を保持）
 * - AI用に向き補正・縮小・JPEG再エンコードした Blob を返す
 * - HEIC/HEIF は必要時のみ vendor/heic2any を遅延読込（MIT）
 * - IndexedDB / backup には書き込まない（runtime cache は呼び出し側）
 */
(() => {
  "use strict";

  const PREP_VERSION = 1;
  /** OpenAI detail:high 相当の長辺上限。これ以上は視認性を保ちつつ縮小。 */
  const MAX_LONG_EDGE = 2048;
  /** 銘板文字優先の下限。これ未満へは落とさない。 */
  const MIN_LONG_EDGE = 1280;
  const TARGET_MAX_BYTES = Math.floor(3.5 * 1024 * 1024);
  const HARD_MAX_BYTES = 4 * 1024 * 1024;
  const QUALITY_STEPS = [0.88, 0.8, 0.72, 0.64, 0.55];
  const EDGE_STEPS = [2048, 1760, 1536, 1280];
  const HEIC_MIME = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
  const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ]);

  let heicLoaderPromise = null;

  function makeError(code, message) {
    return Object.assign(new Error(message), { name: "ImagePrepError", code });
  }

  function normalizeMime(mime, fileName) {
    const m = String(mime || "").toLowerCase().trim();
    if (m === "image/jpg") return "image/jpeg";
    if (m && ALLOWED_MIME.has(m)) return m === "image/jpg" ? "image/jpeg" : m;
    const name = String(fileName || "").toLowerCase();
    if (/\.jpe?g$/i.test(name)) return "image/jpeg";
    if (/\.png$/i.test(name)) return "image/png";
    if (/\.webp$/i.test(name)) return "image/webp";
    if (/\.heic$/i.test(name)) return "image/heic";
    if (/\.heif$/i.test(name)) return "image/heif";
    return m || "";
  }

  function isHeicMime(mime) {
    return HEIC_MIME.has(String(mime || "").toLowerCase());
  }

  function buildSourceKey(meta) {
    const m = meta || {};
    return [
      PREP_VERSION,
      m.size == null ? "" : String(m.size),
      m.lastModified == null ? "" : String(m.lastModified),
      String(m.fileName || ""),
      String(m.mimeType || ""),
    ].join("|");
  }

  function resolveHeicScriptUrl() {
    try {
      const scripts = document.getElementsByTagName("script");
      for (let i = scripts.length - 1; i >= 0; i--) {
        const src = scripts[i].src || "";
        if (/image-prep\.js(\?|$)/i.test(src)) {
          return src.replace(/image-prep\.js(\?.*)?$/i, "vendor/heic2any.min.js$1");
        }
      }
    } catch (_) {
      /* ignore */
    }
    return "./vendor/heic2any.min.js";
  }

  function loadHeic2Any() {
    if (typeof window.heic2any === "function") {
      return Promise.resolve(window.heic2any);
    }
    if (heicLoaderPromise) return heicLoaderPromise;
    heicLoaderPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = resolveHeicScriptUrl();
      s.async = true;
      s.onload = () => {
        if (typeof window.heic2any === "function") resolve(window.heic2any);
        else reject(makeError("heic_unavailable", "HEIC変換モジュールを読み込めませんでした。"));
      };
      s.onerror = () =>
        reject(
          makeError(
            "heic_unavailable",
            "この写真をAI用に変換できませんでした。写真は保存されています。別の写真を選ぶか、もう一度撮影してください。",
          ),
        );
      document.head.appendChild(s);
    });
    return heicLoaderPromise;
  }

  async function convertHeicToJpegBlob(blob) {
    const heic2any = await loadHeic2Any();
    let result;
    try {
      result = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
    } catch (_) {
      throw makeError(
        "heic_convert_failed",
        "この写真をAI用に変換できませんでした。写真は保存されています。別の写真を選ぶか、もう一度撮影してください。",
      );
    }
    const out = Array.isArray(result) ? result[0] : result;
    if (!(out instanceof Blob)) {
      throw makeError(
        "heic_convert_failed",
        "この写真をAI用に変換できませんでした。写真は保存されています。別の写真を選ぶか、もう一度撮影してください。",
      );
    }
    return out;
  }

  function supportsBitmapOrientation() {
    try {
      return typeof createImageBitmap === "function";
    } catch (_) {
      return false;
    }
  }

  async function decodeToBitmap(blob) {
    if (supportsBitmapOrientation()) {
      try {
        return await createImageBitmap(blob, { imageOrientation: "from-image" });
      } catch (_) {
        try {
          return await createImageBitmap(blob);
        } catch (__) {
          /* fall through */
        }
      }
    }
    return await decodeViaHtmlImage(blob);
  }

  function decodeViaHtmlImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (typeof createImageBitmap === "function") {
          createImageBitmap(img)
            .then(resolve)
            .catch(() => {
              // Fake bitmap-like object
              resolve({
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                close() {},
                _img: img,
              });
            });
        } else {
          resolve({
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            close() {},
            _img: img,
          });
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(
          makeError(
            "decode_failed",
            "写真を読み込めませんでした。元の写真は保存されています。別の写真を選ぶか、もう一度撮影してください。",
          ),
        );
      };
      img.src = url;
    });
  }

  function fitSize(srcW, srcH, longEdge) {
    const w = Math.max(1, srcW | 0);
    const h = Math.max(1, srcH | 0);
    const long = Math.max(w, h);
    if (long <= longEdge) return { width: w, height: h, scale: 1 };
    const scale = longEdge / long;
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      scale,
    };
  }

  function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!(blob instanceof Blob)) {
              reject(makeError("encode_failed", "AI用の画像準備に失敗しました。元の写真は保存されています。"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          quality,
        );
      } catch (_) {
        reject(
          makeError(
            "encode_failed",
            "端末のメモリ不足などのため、AI用の画像準備に失敗しました。元の写真は保存されています。",
          ),
        );
      }
    });
  }

  function drawBitmapToCanvas(bitmap, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw makeError(
        "canvas_unavailable",
        "AI用の画像準備に失敗しました。元の写真は保存されています。",
      );
    }
    // 透過PNG等は白背景（黒背景で文字が潰れるのを避ける）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    const source = bitmap._img || bitmap;
    ctx.drawImage(source, 0, 0, width, height);
    return canvas;
  }

  function releaseCanvas(canvas) {
    try {
      canvas.width = 0;
      canvas.height = 0;
    } catch (_) {
      /* ignore */
    }
  }

  function closeBitmap(bitmap) {
    try {
      if (bitmap && typeof bitmap.close === "function") bitmap.close();
    } catch (_) {
      /* ignore */
    }
  }

  async function sha256Hex(blob) {
    if (!(blob instanceof Blob) || !window.crypto || !window.crypto.subtle) return "";
    try {
      const buf = await blob.arrayBuffer();
      const digest = await window.crypto.subtle.digest("SHA-256", buf);
      const bytes = new Uint8Array(digest);
      let hex = "";
      for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
      return hex;
    } catch (_) {
      return "";
    }
  }

  /**
   * @param {Blob} originalBlob
   * @param {{ fileName?: string, mimeType?: string, size?: number, lastModified?: number }} meta
   * @returns {Promise<{
   *   blob: Blob,
   *   width: number,
   *   height: number,
   *   bytes: number,
   *   quality: number,
   *   longEdge: number,
   *   prepVersion: number,
   *   sourceKey: string,
   *   originalMime: string,
   *   originalBytes: number,
   *   originalHash: string,
   *   preparedHash: string,
   *   preparedAt: string,
   *   elapsedMs: number
   * }>}
   */
  async function prepareForAi(originalBlob, meta) {
    const started = Date.now();
    if (!(originalBlob instanceof Blob)) {
      throw makeError("invalid_input", "写真データがありません。写真は保存されているか確認してください。");
    }
    const mime = normalizeMime(meta && meta.mimeType, meta && meta.fileName) ||
      normalizeMime(originalBlob.type, meta && meta.fileName);
    const sourceKey = buildSourceKey({
      size: meta && meta.size != null ? meta.size : originalBlob.size,
      lastModified: meta && meta.lastModified,
      fileName: meta && meta.fileName,
      mimeType: mime,
    });

    let workBlob = originalBlob;
    if (isHeicMime(mime) || (!mime && /\.hei[cf]$/i.test(String((meta && meta.fileName) || "")))) {
      workBlob = await convertHeicToJpegBlob(originalBlob);
    }

    let bitmap;
    try {
      bitmap = await decodeToBitmap(workBlob);
    } catch (err) {
      if (err && err.code) throw err;
      // HEIC を MIME 誤検知せず decode 失敗した場合の再試行
      if (isHeicMime(mime) === false && /\.hei[cf]$/i.test(String((meta && meta.fileName) || ""))) {
        workBlob = await convertHeicToJpegBlob(originalBlob);
        bitmap = await decodeToBitmap(workBlob);
      } else if (mime && isHeicMime(mime) === false && workBlob === originalBlob) {
        // PNG/WebP/JPEG decode failed
        throw err && err.code
          ? err
          : makeError(
              "decode_failed",
              "写真を読み込めませんでした。元の写真は保存されています。別の写真を選ぶか、もう一度撮影してください。",
            );
      } else {
        throw err && err.code
          ? err
          : makeError(
              "decode_failed",
              "写真を読み込めませんでした。元の写真は保存されています。別の写真を選ぶか、もう一度撮影してください。",
            );
      }
    }

    const srcW = bitmap.width || 0;
    const srcH = bitmap.height || 0;
    if (srcW < 1 || srcH < 1) {
      closeBitmap(bitmap);
      throw makeError(
        "decode_failed",
        "写真を読み込めませんでした。元の写真は保存されています。別の写真を選ぶか、もう一度撮影してください。",
      );
    }

    let best = null;
    try {
      for (let ei = 0; ei < EDGE_STEPS.length; ei++) {
        const longEdge = EDGE_STEPS[ei];
        if (longEdge < MIN_LONG_EDGE && Math.max(srcW, srcH) > MIN_LONG_EDGE) {
          // still allow 1280 as last step
        }
        const fitted = fitSize(srcW, srcH, longEdge);
        const canvas = drawBitmapToCanvas(bitmap, fitted.width, fitted.height);
        try {
          for (let qi = 0; qi < QUALITY_STEPS.length; qi++) {
            const quality = QUALITY_STEPS[qi];
            const jpeg = await canvasToJpegBlob(canvas, quality);
            const candidate = {
              blob: jpeg,
              width: fitted.width,
              height: fitted.height,
              bytes: jpeg.size,
              quality,
              longEdge,
            };
            if (!best || candidate.bytes < best.bytes) best = candidate;
            if (candidate.bytes <= TARGET_MAX_BYTES) {
              best = candidate;
              releaseCanvas(canvas);
              closeBitmap(bitmap);
              bitmap = null;
              const originalHash = await sha256Hex(originalBlob);
              const preparedHash = await sha256Hex(best.blob);
              return {
                ...best,
                prepVersion: PREP_VERSION,
                sourceKey,
                originalMime: mime || originalBlob.type || "",
                originalBytes: originalBlob.size,
                originalHash,
                preparedHash,
                preparedAt: new Date().toISOString(),
                elapsedMs: Date.now() - started,
              };
            }
          }
        } finally {
          releaseCanvas(canvas);
        }
        // 次の長辺へ（さらに小さく）
        if (best && best.bytes <= HARD_MAX_BYTES && longEdge <= MIN_LONG_EDGE) break;
      }
    } catch (err) {
      closeBitmap(bitmap);
      if (err && err.code) throw err;
      throw makeError(
        "prepare_failed",
        "AI用の画像準備に失敗しました。元の写真は保存されています。",
      );
    }

    closeBitmap(bitmap);

    if (!best || best.bytes > HARD_MAX_BYTES) {
      throw makeError(
        "too_large",
        "AI用の画像準備に失敗しました。元の写真は保存されています。別の写真でもう一度お試しください。",
      );
    }

    const originalHash = await sha256Hex(originalBlob);
    const preparedHash = await sha256Hex(best.blob);
    return {
      ...best,
      prepVersion: PREP_VERSION,
      sourceKey,
      originalMime: mime || originalBlob.type || "",
      originalBytes: originalBlob.size,
      originalHash,
      preparedHash,
      preparedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
    };
  }

  window.BCFDImagePrep = {
    PREP_VERSION,
    MAX_LONG_EDGE,
    MIN_LONG_EDGE,
    TARGET_MAX_BYTES,
    HARD_MAX_BYTES,
    normalizeMime,
    isHeicMime,
    buildSourceKey,
    prepareForAi,
    fitSize,
    ALLOWED_MIME: Array.from(ALLOWED_MIME),
  };
})();
