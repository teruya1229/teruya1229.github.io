/* /moving/ 専用
   1. スマホ固定CTA（FV・最終CTA・フッター表示中は隠す）
   2. GA4：line_click / phone_click（gtag が無いときは何もしない）
   3. LINEクリックだけ moving_line_click を追加（line_click は残す）
*/
(function () {
  var bar = document.querySelector(".fixed-cta");
  var fv = document.getElementById("fv");
  var finalCta = document.getElementById("cta");
  var footer = document.querySelector(".site-footer");

  if (!bar || !fv || !finalCta) {
    return;
  }

  var mq = window.matchMedia("(max-width: 767px)");

  function isInView(el) {
    if (!el) {
      return false;
    }
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  function update() {
    if (!mq.matches) {
      bar.hidden = true;
      document.body.classList.remove("is-fixed-cta");
      return;
    }
    var show = !isInView(fv) && !isInView(finalCta) && !isInView(footer);
    bar.hidden = !show;
    document.body.classList.toggle("is-fixed-cta", show);
  }

  if (!("IntersectionObserver" in window)) {
    bar.hidden = true;
    return;
  }

  var io = new IntersectionObserver(function () {
    update();
  }, { threshold: 0, root: null, rootMargin: "0px" });

  document.querySelectorAll("section, .site-footer").forEach(function (el) {
    io.observe(el);
  });

  if (mq.addEventListener) {
    mq.addEventListener("change", update);
  } else if (mq.addListener) {
    mq.addListener(update);
  }

  update();
})();

(function () {
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a || typeof window.gtag !== "function") {
      return;
    }
    var href = a.getAttribute("href") || "";
    var params = {
      cta_location: a.getAttribute("data-ga-location") || "",
      link_url: href,
      service_type: "moving_consult"
    };
    if (href.indexOf("lin.ee") !== -1) {
      window.gtag("event", "line_click", params);
      window.gtag("event", "moving_line_click", {
        cta_location: params.cta_location,
        link_url: params.link_url,
        service_type: params.service_type
      });
      return;
    }
    if (href.indexOf("tel:") === 0) {
      window.gtag("event", "phone_click", params);
    }
  });
})();
