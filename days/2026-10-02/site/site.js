/**
 * 家計を守る暮らし — サイト共通スクリプト
 * 役割は 1 つ: アフィリエイトリンクのクリックを GA4 のイベント aff_click として送る（gtag が無ければ何もしない）。
 * リンクの遷移は止めない（計測失敗で導線を止めない）。
 */
(function () {
  "use strict";
  var links = document.querySelectorAll("a.aff-link[data-aff]");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function (ev) {
      try {
        if (typeof window.gtag !== "function") return;
        var a = ev.currentTarget;
        window.gtag("event", "aff_click", { shop: a.getAttribute("data-aff") || "", page_path: window.location.pathname, link_text: (a.textContent || "").trim().slice(0, 40) });
      } catch (e) { /* 何もしない */ }
    });
  }
})();
