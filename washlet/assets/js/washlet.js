/* /washlet/ 専用JS
   1. スマホ固定CTAの表示制御（FV・最終CTA・フッター表示中は非表示）
   2. GA4クリック計測
      washlet_line_click / washlet_phone_click / washlet_toilet_link_click
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

  var io = new IntersectionObserver(
    function () {
      update();
    },
    { threshold: 0, root: null, rootMargin: "0px" }
  );

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
    var a = e.target.closest("a[data-ga-event]");
    if (!a) {
      return;
    }
    var name = a.getAttribute("data-ga-event");
    if (!name) {
      return;
    }
    if (typeof window.gtag !== "function") {
      return;
    }

    var params = {
      cta_location: a.getAttribute("data-ga-location") || "",
      link_url: a.getAttribute("href") || a.href
    };

    if (name !== "washlet_toilet_link_click") {
      params.service_type = a.getAttribute("data-ga-service") || "washlet_replacement";
    }

    window.gtag("event", name, params);
  });
})();
