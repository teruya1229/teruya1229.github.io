/* Explicit per-photo export and large preview. Original photos stay in IndexedDB. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) {
    root.BCFDPhotoDevice = api;
    api.attach(root.document, root.BCFDApp, root.navigator);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function toFile(photo) {
    if (!photo || !(photo.blob instanceof Blob)) throw new TypeError("原本写真が見つかりません");
    if (typeof File !== "function") return null;
    return new File([photo.blob], String(photo.fileName || "BC-photo.jpg"), {
      type: String(photo.mimeType || photo.blob.type || "application/octet-stream")
    });
  }
  function sharePossible(photo, nav) {
    if (!nav || typeof nav.share !== "function") return false;
    const file = toFile(photo);
    if (!file) return false;
    try { return typeof nav.canShare !== "function" || nav.canShare({ files: [file] }); }
    catch (_) { return false; }
  }
  async function shareOriginal(photo, nav) {
    if (!sharePossible(photo, nav)) return "unsupported";
    try {
      await nav.share({ files: [toFile(photo)], title: "現場写真" });
      return "shared"; // Does not prove that the photo was saved to the camera roll.
    } catch (err) {
      return err && err.name === "AbortError" ? "cancelled" : "failed";
    }
  }
  function attach(doc, app, nav) {
    if (!app || typeof app.getOriginalPhoto !== "function") return;
    const overlay = doc.getElementById("photo-viewer-overlay");
    const image = doc.getElementById("photo-viewer-image");
    const title = doc.getElementById("photo-viewer-title");
    const download = doc.getElementById("photo-viewer-download");
    let currentUrl = null;
    function close() {
      if (overlay) overlay.hidden = true;
      if (image) image.removeAttribute("src");
      if (download) download.removeAttribute("href");
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    function open(id) {
      const photo = app.getOriginalPhoto(id);
      if (!photo || !overlay || !image || !download) return;
      close();
      currentUrl = URL.createObjectURL(photo.blob);
      image.src = currentUrl;
      image.alt = (photo.title || "現場写真") + "の拡大表示";
      if (title) title.textContent = photo.title || "写真の確認";
      download.href = currentUrl;
      download.download = String(photo.fileName || "BC-photo.jpg");
      overlay.hidden = false;
    }
    function message(card, text) {
      const area = card && card.querySelector("[data-device-message]");
      if (!area) return;
      area.hidden = false;
      area.textContent = text;
    }
    function downloadFile(photo, card) {
      const url = URL.createObjectURL(photo.blob);
      const link = doc.createElement("a");
      link.href = url;
      link.download = String(photo.fileName || "BC-photo.jpg");
      link.hidden = true;
      doc.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      message(card, "ダウンロードを開始しました。保存先を端末でご確認ください（写真アプリに自動追加されるとは限りません）。");
    }
    doc.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.id === "photo-viewer-close" || target.closest("#photo-viewer-close")) {
        close(); return;
      }
      if (target === overlay) { close(); return; }
      const card = target.closest("[data-photo-id]");
      if (!card) return;
      const id = card.getAttribute("data-photo-id");
      if (target.closest('[data-action="preview-photo"]')) { open(id); return; }
      if (!target.closest('[data-action="save-device"]')) return;
      const photo = app.getOriginalPhoto(id);
      if (!photo) { message(card, "原本写真を読み込めません。アプリ内の写真を確認してください。"); return; }
      if (sharePossible(photo, nav)) {
        void shareOriginal(photo, nav).then((result) => {
          if (result === "shared") message(card, "共有操作から『画像を保存』を選んだ場合は、写真アプリでご確認ください。");
          else if (result === "failed") message(card, "共有できませんでした。写真をタップして拡大し、長押しで保存するか、原本をダウンロードしてください。");
        });
      } else if (/iPad|iPhone|iPod/.test((nav && nav.userAgent) || "") ||
        (/Macintosh/.test((nav && nav.userAgent) || "") && nav && nav.maxTouchPoints > 1)) {
        open(id);
        message(card, "画像を長押しして『写真に保存』を選択してください。下のボタンからファイルとしても保存できます。");
      } else {
        downloadFile(photo, card);
      }
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay && !overlay.hidden) close();
    });
  }
  return { toFile, sharePossible, shareOriginal, attach };
});
