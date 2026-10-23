/**
 * クラコツ（コツコツ得する暮らしのコツ） — サイト共通スクリプト
 * 役割 1: アフィリエイトリンクのクリックを GA4 のイベント aff_click として送る（gtag が無ければ何もしない）。
 *         リンクの遷移は止めない（計測失敗で導線を止めない）。
 * 役割 2（段階的強化）: 追従ヘッダー。上端から離れたら .is-stuck（薄い影、PC はカテゴリ帯の左に小さなロゴ）。
 *         スマホ（720px 未満）では下へ 24px 以上スクロールすると .is-hidden で隠し、上へ 48px 以上戻すと出す（移動量を積む）。
 *         フォーカスがヘッダー内にあるときは隠さない。動きを減らす設定では隠す処理自体をしない。
 *         transform だけを使うのでレイアウトは動かない（CLS なし）。JS が無いときは普通に表示・追従する。
 * 役割 3（段階的強化）: 横にはみ出す比較表の上に「横にスクロールできます」の小ラベルを出す。
 *         ラベルは高さ 0 の要素に重ねるので、出しても下の内容は動かない。
 * 役割 4（段階的強化）: カテゴリ帯。全項目が 1 行に収まる幅（タブレットなど）では .is-fit を付けて中央に揃える（フェード・送りなし）。
 *         収まらない幅（スマホ）では .is-scroll。いま見ているカテゴリが画面の外（右のフェード）にあるときだけ、
 *         読み込み時（とフォント読み込み後、帯に触れていなければもう一度）帯を横に送って見せる。ページ全体はスクロールさせない。
 *         キーボードで項目に移ったときは、その項目が左右の端で欠けないよう帯だけを横に送る。
 * 役割 5（段階的強化）: 記事の目次の項目を、同じ文言の h2 へのリンクにする（h2 に id を振る）。JS が無いときは文字だけの目次のまま。
 * 役割 6（段階的強化・2026-10-06）: スクロールで現れる動き。最初の画面より下の要素に .reveal を付け、画面に入ったら .is-in。
 *         同じフレームで入った要素は 80ms ずつずらす。動きを減らす設定では何も付けない（最初から全部見えている）。
 * 役割 7（段階的強化）: 記事ページの読み位置（上端の細い線）と、目次のいま読んでいる節の印。
 * 役割 8（段階的強化）: 「先頭へ戻る」ボタン（1.5 画面より下で出す）。
 * 役割 9（段階的強化）: 遅延読み込みの画像を、読み込めたときに浮かび上がらせる（読み込み済みの画像には何もしない）。
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

(function () {
  "use strict";
  var header = document.querySelector(".site-header");
  if (!header || !window.requestAnimationFrame || !window.matchMedia) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var small = window.matchMedia("(max-width: 719.98px)");
  var lastY = window.pageYOffset || 0, ticking = false, mastH = 0, run = 0;
  /* 720px 以上は top が負（マストヘッドの高さ）。その分だけ流れたら「追従中」 */
  function measure() { var t = parseFloat(window.getComputedStyle(header).top) || 0; mastH = t < 0 ? -t : 0; }
  function update() {
    ticking = false;
    var y = window.pageYOffset || 0, dy = y - lastY;
    header.classList.toggle("is-stuck", y > mastH + 2);
    var canHide = small.matches && !reduce.matches;
    /* 同じ向きに動いた量を積む（ゆっくりのスクロールでも反応する）。下へ 24px で隠し、上へ 48px で出す */
    if (dy !== 0) run = (run > 0) === (dy > 0) ? run + dy : dy;
    if (!canHide || y <= 240) header.classList.remove("is-hidden");
    else if (run > 24 && !header.contains(document.activeElement)) header.classList.add("is-hidden");
    else if (run < -48) header.classList.remove("is-hidden");
    lastY = y;
  }
  function schedule() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () { measure(); schedule(); });
  header.addEventListener("focusin", function () { header.classList.remove("is-hidden"); });
  measure();
  update();
})();

(function () {
  "use strict";
  var wraps = document.querySelectorAll(".article .table-wrap");
  if (!wraps.length) return;
  var pairs = [];
  for (var i = 0; i < wraps.length; i++) {
    var hint = document.createElement("div");
    hint.className = "table-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.hidden = true;
    hint.innerHTML = "<span>横にスクロールできます<span aria-hidden=\"true\">→</span></span>";
    wraps[i].parentNode.insertBefore(hint, wraps[i]);
    pairs.push([wraps[i], hint]);
  }
  function check() {
    for (var j = 0; j < pairs.length; j++) pairs[j][1].hidden = !(pairs[j][0].scrollWidth > pairs[j][0].clientWidth + 4);
  }
  check();
  var timer = 0;
  window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(check, 150); });
})();

(function () {
  "use strict";
  var bar = document.querySelector(".cat-bar__inner");
  if (!bar) return;
  var items = bar.querySelectorAll(".cat-bar__item");
  var touched = false, lastW = -1;
  /* 全項目が 1 行に収まるかを、クラスを付け外しせずに測る（項目の幅の合計と帯の幅を比べる。項目の間隔は 0）。
     ⚠️ .is-fit を付け外しして scrollWidth を見ると、中央揃えの間に横スクロールの範囲が縮み、送った位置（scrollLeft）が切り詰められる */
  function fit() {
    var sum = 0;
    for (var i = 0; i < items.length; i++) sum += items[i].getBoundingClientRect().width;
    var fits = sum <= bar.clientWidth + 1;
    if (fits && !bar.classList.contains("is-fit")) bar.scrollLeft = 0;
    bar.classList.toggle("is-fit", fits);
    bar.classList.toggle("is-scroll", !fits);
    edge();
    return fits;
  }
  /* 左にも続きがあるとき（送った後）は、左端にも短いフェード */
  function edge() { bar.classList.toggle("is-scrolled", !bar.classList.contains("is-fit") && bar.scrollLeft > 2); }
  /* 項目を左に止める位置: 項目の文字（左の padding の内側）が、左端のフェード（CSS の --bar-fade-l）の終わりから始まる位置 */
  function leftStop(a) {
    var fade = parseFloat(window.getComputedStyle(bar).getPropertyValue("--bar-fade-l")) || 32;
    return Math.max(0, fade - (parseFloat(window.getComputedStyle(a).paddingLeft) || 0));
  }
  /* 収まらない幅だけ: いま見ているカテゴリが右端のフェード（82% から先）にかかる、または画面の外にあるとき、帯を送る。
     送った位置は項目の左端（文字が左のフェードの終わりから始まる）。最後の方の項目は送れる上限で止まる。ユーザーが帯に触れた後は送らない */
  function reveal() {
    var cur = bar.querySelector(".cat-bar__item.is-current");
    if (!cur || touched || bar.classList.contains("is-fit")) return;
    var b = bar.getBoundingClientRect(), r = cur.getBoundingClientRect();
    if (r.left >= b.left - 1 && r.right <= b.left + bar.clientWidth * 0.82 + 1) return;
    var to = bar.scrollLeft + (r.left - b.left) - leftStop(cur);
    bar.scrollLeft = Math.max(0, Math.min(Math.round(to), bar.scrollWidth - bar.clientWidth));
    edge();
  }
  /* キーボードで帯の項目に移ったとき、一部だけ見えている項目も左右の端（左のフェードの終わり・右のフェード）の内側まで横に送る。
     Chromium は一部が見えている項目ではフォーカス時にスクロールしない。scrollIntoView はヘッダーが隠れている最中にページを縦にも動かすので使わない */
  bar.addEventListener("focusin", function (e) {
    touched = true;
    var a = e.target && e.target.closest ? e.target.closest(".cat-bar__item") : null;
    if (!a || bar.classList.contains("is-fit")) return;
    var b = bar.getBoundingClientRect(), r = a.getBoundingClientRect(), L = leftStop(a), R = bar.clientWidth * 0.22;
    if (r.left < b.left + L) bar.scrollLeft -= Math.ceil(b.left + L - r.left);
    else if (r.right > b.right - R) bar.scrollLeft += Math.ceil(r.right - (b.right - R));
  });
  var mark = function () { touched = true; };
  bar.addEventListener("pointerdown", mark, { passive: true });
  bar.addEventListener("touchstart", mark, { passive: true });
  bar.addEventListener("wheel", mark, { passive: true });
  bar.addEventListener("scroll", edge, { passive: true });
  lastW = bar.clientWidth;
  fit();
  reveal();
  /* Web フォントで項目の幅が変わるので、読み込み後にもう一度測り、ユーザーが帯に触れていなければ送り直す */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); reveal(); });
  var timer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { if (bar.clientWidth === lastW) return; lastW = bar.clientWidth; fit(); }, 150);
  });
})();

(function () {
  "use strict";
  var items = document.querySelectorAll(".article__toc li");
  if (!items.length) return;
  var heads = document.querySelectorAll(".article h2");
  var used = {};
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  for (var i = 0; i < items.length; i++) {
    var li = items[i], t = norm(li.textContent);
    if (!t || li.querySelector("a")) continue;
    for (var j = 0; j < heads.length; j++) {
      var h = heads[j];
      if (used[j] || norm(h.textContent) !== t) continue;
      if (!h.id) { var id = "sec-" + (j + 1); if (document.getElementById(id)) id += "-h"; h.id = id; }
      var a = document.createElement("a");
      a.href = "#" + h.id;
      while (li.firstChild) a.appendChild(li.firstChild);
      li.appendChild(a);
      used[j] = true;
      break;
    }
  }
})();

(function () {
  "use strict";
  /* 役割 6: スクロールで現れる。IntersectionObserver が無い・動きを減らす設定のときは何もしない（CSS の .reveal は付かないので全部見える） */
  if (!("IntersectionObserver" in window) || !window.matchMedia) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var sel = ".sec-head, .genre-tile, .feature__item, .kstep__item, .post-grid > .post-card, .policy-box, " +
    ".article h2, .section--page h2, .aff-box, .article__figure, .related, .side-box, " +
    ".site-footer__head, .site-footer__cols, .site-footer__note, .site-footer__wordmark, .site-footer__logo";
  var els = document.querySelectorAll(sel), list = [], vh = window.innerHeight || 0;
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh * 0.92) { els[i].classList.add("is-now"); continue; }   /* 最初の画面にあるものは隠さない（画像のズームアウトだけ .is-now で動く） */
    els[i].classList.add("reveal");
    list.push(els[i]);
  }
  if (!list.length) return;
  var io = new IntersectionObserver(function (entries) {
    var batch = [];
    for (var k = 0; k < entries.length; k++) if (entries[k].isIntersecting) batch.push(entries[k].target);
    /* 同時に入ったものは、上から・左から順に 80ms ずつ遅らせる */
    batch.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
    for (var j = 0; j < batch.length; j++) {
      batch[j].style.transitionDelay = (Math.min(j, 7) * 80) + "ms";
      batch[j].classList.add("is-in");
      io.unobserve(batch[j]);
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  for (var m = 0; m < list.length; m++) io.observe(list[m]);
})();

(function () {
  "use strict";
  /* 役割 7: 読み位置の線と、目次の現在地（記事ページだけ） */
  var art = document.querySelector(".is-post .article");
  if (!art || !window.requestAnimationFrame) return;
  var bar = document.createElement("div");
  bar.className = "read-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  var heads = [], links = document.querySelectorAll(".article__toc li > a[href^='#']");
  for (var i = 0; i < links.length; i++) {
    var h = document.getElementById(links[i].getAttribute("href").slice(1));
    if (h) heads.push([h, links[i].parentNode]);
  }
  var ticking = false;
  function update() {
    ticking = false;
    var r = art.getBoundingClientRect(), total = r.height - window.innerHeight;
    var done = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    bar.style.transform = "scaleX(" + done.toFixed(4) + ")";
    var cur = null;
    for (var j = 0; j < heads.length; j++) if (heads[j][0].getBoundingClientRect().top <= 140) cur = heads[j][1];
    for (var k = 0; k < heads.length; k++) heads[k][1].classList.toggle("is-active", heads[k][1] === cur);
  }
  function schedule() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
})();

(function () {
  "use strict";
  /* 役割 8: 先頭へ戻る */
  if (!window.requestAnimationFrame || !window.matchMedia) return;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "to-top";
  btn.setAttribute("aria-label", "ページの先頭へ戻る");
  document.body.appendChild(btn);
  btn.addEventListener("click", function () {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, 0); }
  });
  var ticking = false;
  function update() { ticking = false; btn.classList.toggle("is-on", (window.pageYOffset || 0) > (window.innerHeight || 0) * 1.5); }
  function schedule() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
  window.addEventListener("scroll", schedule, { passive: true });
  update();
})();

(function () {
  "use strict";
  /* 役割 9: 遅延読み込みの画像の浮かび上がり。すでに読み込み済み（キャッシュ）の画像には付けない */
  if (!window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var imgs = document.querySelectorAll('img[loading="lazy"]');
  function done() { this.classList.add("is-loaded"); }
  for (var i = 0; i < imgs.length; i++) {
    if (imgs[i].complete && imgs[i].naturalWidth > 0) continue;
    imgs[i].classList.add("lazy-fade");
    imgs[i].addEventListener("load", done);
    imgs[i].addEventListener("error", done);
  }
})();
