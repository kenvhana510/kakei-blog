/* ふるさと納税 上限シミュレーターの画面（/tools/furusato-jogen/）。計算は furusato-calc.js（window.FurusatoCalc）。
   入力はブラウザの外へ送らない。「入力を保存」のときだけ localStorage に残す。 */
(function () {
  "use strict";
  var C = window.FurusatoCalc;
  var root = document.getElementById("ft");
  if (!C || !root) return;
  var KEY = "kurakotsu-furusato-v1";
  var peopleEl = document.getElementById("ft-people");
  var resultEl = document.getElementById("ft-result");
  var nextEl = document.getElementById("ft-next");
  var stepsEl = document.getElementById("ft-steps");
  var mode = "salary";
  var count = 1;
  var lastRemain = 0, lastSlots = 5;

  var fmt = function (n) { return Math.round(n).toLocaleString("ja-JP"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function toNum(v) {
    if (v == null) return "";
    var s = String(v).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[,，、 　円]/g, "").replace(/．/g, ".");
    if (s === "") return "";
    var n = Number(s);
    return isFinite(n) && n >= 0 ? n : "";
  }

  function field(k, name, label, unit, opt) {
    opt = opt || {};
    return '<label class="ft-row' + (opt.cls ? " " + opt.cls : "") + '"><span class="ft-row__label">' + label + (opt.hint ? '<small>' + opt.hint + "</small>" : "") + '</span><span class="ft-input"><input type="text" inputmode="decimal" data-k="' + name + '" id="ft-' + k + "-" + name + '" placeholder="' + (opt.ph || "0") + '"><span>' + unit + "</span></span></label>";
  }
  function counter(k, name, label) {
    return '<label class="ft-count"><span>' + label + '</span><select data-k="' + name + '"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select></label>';
  }

  function personHtml(k) {
    var who = k === 0 ? "1 人目（あなた）" : "2 人目（配偶者）";
    return '<fieldset class="ft-box ft-person" data-person="' + k + '"><legend>' + who + "</legend>" +
      (k === 1 ? '<button type="button" class="ft-remove" data-remove>この人を外す</button>' : "") +
      '<div class="ft-salary-only">' +
      field(k, "salary", "給与の年収（額面）", "万円", { ph: "500", hint: "源泉徴収票の「支払金額」。今年の見込み" }) +
      "</div>" +
      '<div class="ft-notice-only">' +
      field(k, "shotokuwari", "住民税の所得割額", "円", { ph: "235500", hint: "決定通知書の「所得割額」。市区町村民税と道府県民税の合計" }) +
      field(k, "kazei", "課税標準額（総所得金額等の欄）", "円", { ph: "2380000", hint: "所得控除を引いた後の額。通知書の「課税標準額」" }) +
      field(k, "sogo", "総所得金額（わかれば）", "円", { ph: "空欄なら推定", hint: "所得控除を引く前の「所得金額」の合計" }) +
      "</div>" +
      '<label class="ft-row"><span class="ft-row__label">配偶者</span><select data-k="spouse"><option value="0">配偶者控除なし（独身・共働き）</option><option value="1">配偶者控除あり（配偶者の年収 136 万円以下）</option></select></label>' +
      '<div class="ft-row"><span class="ft-row__label">扶養している家族<small>この人の扶養に入っている人数。共働きなら片方にだけ入れる</small></span><div class="ft-counts">' +
      counter(k, "nensho", "15 歳以下") + counter(k, "ippan16", "16〜18 歳") + counter(k, "tokutei", "19〜22 歳") + counter(k, "ippan23", "23〜69 歳") + counter(k, "rojin", "70 歳以上") + counter(k, "dokyo", "70 歳以上の同居の親") +
      "</div></div>" +
      '<details class="ft-more ft-salary-only"><summary>くわしく入れる（社会保険料・iDeCo・保険・医療費・住宅ローン控除）</summary>' +
      field(k, "shaho", "社会保険料（年額）", "円", { ph: "空欄なら年収の 15%", hint: "源泉徴収票の「社会保険料等の金額」" }) +
      field(k, "ideco", "iDeCo・小規模企業共済（年額）", "円") +
      field(k, "lifeIppan", "生命保険料（一般・年額）", "円", { hint: "新制度の契約として計算" }) +
      field(k, "lifeKaigo", "介護医療保険料（年額）", "円") +
      field(k, "lifeNenkin", "個人年金保険料（年額）", "円") +
      field(k, "jishin", "地震保険料（年額）", "円") +
      field(k, "iryo", "医療費（自己負担 − 保険金の補填）", "円", { hint: "10 万円（所得 200 万円未満は所得の 5%）を超えると医療費控除" }) +
      field(k, "loan", "住宅ローン控除（年額）", "円", { hint: "年末残高 × 0.7% と限度額の小さい方" }) +
      '<label class="ft-check"><input type="checkbox" data-k="loanFirst"> 住宅ローン控除の 1 年目（確定申告が必要）</label>' +
      "</details></fieldset>";
  }

  function render() {
    var html = "";
    for (var k = 0; k < count; k++) html += personHtml(k);
    peopleEl.innerHTML = html;
    document.getElementById("ft-add").hidden = count > 1;
    applyMode();
  }
  function applyMode() {
    root.setAttribute("data-mode", mode);
    var btns = root.querySelectorAll(".ft-mode__btn");
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute("aria-selected", String(btns[i].getAttribute("data-mode") === mode));
  }

  function readPerson(k) {
    var el = peopleEl.querySelector('[data-person="' + k + '"]');
    var v = {};
    var inputs = el.querySelectorAll("[data-k]");
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i], key = x.getAttribute("data-k");
      v[key] = x.type === "checkbox" ? x.checked : x.tagName === "SELECT" ? Number(x.value) : toNum(x.value);
    }
    return v;
  }
  function writePerson(k, v) {
    var el = peopleEl.querySelector('[data-person="' + k + '"]');
    if (!el || !v) return;
    var inputs = el.querySelectorAll("[data-k]");
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i], key = x.getAttribute("data-k");
      if (!(key in v)) continue;
      if (x.type === "checkbox") x.checked = !!v[key]; else x.value = v[key] === "" ? "" : String(v[key]);
    }
  }
  var methodVal = function () { var r = root.querySelector('input[name="ft-method"]:checked'); return r ? r.value : "auto"; };

  function basis(v) {
    var fam = { spouse: v.spouse === 1, ippan: (v.ippan16 || 0) + (v.ippan23 || 0), tokutei: v.tokutei || 0, rojin: v.rojin || 0, dokyo: v.dokyo || 0, nensho: v.nensho || 0 };
    if (mode === "notice") {
      var jinteki = 50000 + (fam.spouse ? 50000 : 0) + fam.ippan * 50000 + fam.tokutei * 180000 + fam.rojin * 100000 + fam.dokyo * 130000;
      return C.fromNotice({ shotokuwari: v.shotokuwari, kazei: v.kazei, sogo: v.sogo, jinteki: jinteki });
    }
    return C.person({
      salary: (v.salary || 0) * 10000, shaho: v.shaho, ideco: v.ideco, spouse: fam.spouse, ippan: fam.ippan, tokutei: fam.tokutei, rojin: fam.rojin, dokyo: fam.dokyo, nensho: fam.nensho,
      lifeIppan: v.lifeIppan, lifeKaigo: v.lifeKaigo, lifeNenkin: v.lifeNenkin, jishin: v.jishin, iryo: v.iryo, loan: v.loan
    });
  }

  function decideMethod(v, doneN, chosen) {
    if (chosen !== "auto") return { m: chosen, why: "" };
    if (mode === "salary" && v.loanFirst) return { m: "shinkoku", why: "住宅ローン控除の 1 年目は確定申告をするため" };
    if (mode === "salary" && (v.iryo || 0) > 100000) return { m: "shinkoku", why: "医療費控除で確定申告をするため" };
    if (doneN > 5) return { m: "shinkoku", why: "寄附先が 6 自治体以上でワンストップ特例が使えないため" };
    return { m: "onestop", why: "確定申告をする理由がなく、5 自治体以内ならワンストップ特例が手軽です" };
  }

  function personResult(k, v, p, method, done) {
    var who = count > 1 ? (k === 0 ? "1 人目" : "2 人目") + "の" : "";
    if (!(p.limit > 2000)) {
      var why = mode === "salary" && !(v.salary > 0) ? "年収を入れてください。" : "住民税の所得割がかからない（または入力が足りない）ため、ふるさと納税をしても控除されず、寄附額のほぼ全額が自己負担になります。";
      return { html: '<div class="ft-card"><p class="ft-card__who">' + who + '結果</p><p class="ft-warn">' + why + "</p></div>", real: 0, remain: 0 };
    }
    var rounded = Math.floor(p.limit / 1000) * 1000;
    var useLimit = rounded;
    var atLimit = C.simulate(p, useLimit, method.m);
    var remain = Math.max(0, useLimit - done);
    var rows = [];
    if (!p.notice) {
      rows.push(["給与所得（年収 − 給与所得控除）", fmt(p.g) + " 円"]);
      rows.push(["住民税の課税所得（推定）", fmt(p.taxRt) + " 円"]);
    }
    rows.push(["住民税の所得割額" + (p.notice ? "" : "（推定）"), fmt(p.shotokuwari) + " 円"]);
    rows.push(["上限の計算に使う所得税率", Math.round(p.rate * 100) + "%"]);
    rows.push(["上限まで寄附した場合の実質負担", "約 " + fmt(atLimit.burden) + " 円"]);
    var warn = "";
    if (atLimit.burden > 2100) {
      warn = '<p class="ft-warn">' + (p.loan > 0 && method.m === "shinkoku"
        ? "確定申告で住宅ローン控除を受けると、所得税から引ききれない住宅ローン控除が住民税の枠（最大 97,500 円）に収まらず、寄附金控除の所得税分の一部が戻りません。"
        : "端数の関係で、") + "上限まで寄附したときの実質負担は約 <b>" + fmt(atLimit.burden) + " 円</b>です（2,000 円より約 " + fmt(atLimit.burden - 2000) + " 円多い）。返礼品の価値がこの差より大きければ、寄附しても損にはなりません。</p>";
    }
    if (done > useLimit) warn += '<p class="ft-warn">寄附済みの額が目安を ' + fmt(done - useLimit) + " 円超えています。超えた分は自己負担になります。</p>";
    var html = '<div class="ft-card">' +
      '<p class="ft-card__who">' + who + "控除上限の目安（2026 年分）</p>" +
      '<p class="ft-card__big"><span>' + fmt(useLimit) + '</span> 円</p>' +
      (done > 0 ? '<p class="ft-card__remain">寄附済み ' + fmt(done) + ' 円 → 残り枠 <b>' + fmt(remain) + " 円</b></p>" : "") +
      '<p class="ft-card__safe">12 月の最後の寄附は、1 割ほど余裕をみて <b>' + fmt(Math.floor(useLimit * 0.9 / 1000) * 1000) + " 円</b>までを目安に。</p>" +
      warn +
      '<table class="ft-detail">' + rows.map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("") + "</table>" +
      '<div class="ft-try"><label>寄附額で試す <span class="ft-input"><input type="text" inputmode="numeric" data-try="' + k + '" placeholder="' + fmt(useLimit) + '"><span>円</span></span></label><p class="ft-try__out" data-try-out="' + k + '"></p></div>' +
      "</div>";
    return { html: html, real: useLimit, remain: remain, p: p, method: method };
  }

  var lastCalc = [];
  function calc() {
    var chosen = methodVal();
    var done = toNum(document.getElementById("ft-done").value) || 0;
    var doneN = toNum(document.getElementById("ft-done-n").value) || 0;
    var cards = [], total = 0, remainTotal = 0, methods = [];
    lastCalc = [];
    for (var k = 0; k < count; k++) {
      var v = readPerson(k);
      var p = basis(v);
      var m = decideMethod(v, k === 0 ? doneN : 0, chosen);
      var r = personResult(k, v, p, m, k === 0 ? done : 0);
      cards.push(r.html);
      total += r.real; remainTotal += r.remain;
      methods.push(m);
      lastCalc.push({ p: p, m: m.m });
    }
    var sum = count > 1 && total > 0 ? '<p class="ft-sum">2 人の上限の合計: <b>' + fmt(total) + " 円</b>（寄附はそれぞれの名義で。名義の人の控除にしかなりません）</p>" : "";
    resultEl.innerHTML = '<div class="ft-cards">' + cards.join("") + "</div>" + sum;
    resultEl.hidden = false;
    lastRemain = remainTotal;
    lastSlots = Math.max(0, 5 - doneN) + (count > 1 ? 5 : 0);   // 2 人目は自分の名義で別に 5 自治体まで
    nextEl.hidden = !(remainTotal > 0);
    plan();
    steps(methods[0]);
    if (typeof window.gtag === "function") window.gtag("event", "furusato_calc", { mode: mode, people: count });
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function tryAmount(k, val) {
    var out = resultEl.querySelector('[data-try-out="' + k + '"]');
    var c = lastCalc[k];
    if (!out || !c) return;
    var d = toNum(val);
    if (!(d > 2000)) { out.textContent = ""; return; }
    var s = C.simulate(c.p, d, c.m);
    var ok = s.burden <= 2100;
    out.className = "ft-try__out " + (ok ? "is-ok" : "is-ng");
    out.innerHTML = "控除される額 約 " + fmt(s.saved) + " 円 ／ 実質負担 約 <b>" + fmt(s.burden) + " 円</b>" + (ok ? "（2,000 円の範囲）" : "（2,000 円を超えます）");
  }

  function plan() {
    var active = nextEl.querySelector(".ft-route:not([hidden])");
    if (!active) return;
    var items = active.querySelectorAll(".ft-plan__item");
    var slots = Math.min(items.length, lastSlots);
    var shareSum = 0, i;
    for (i = 0; i < items.length; i++) if (i < slots) shareSum += Number(items[i].getAttribute("data-share"));
    var budget = Math.floor(lastRemain * 0.95);
    for (i = 0; i < items.length; i++) {
      var a = items[i].querySelector("[data-amount]");
      if (i >= slots || shareSum === 0) { items[i].classList.add("is-off"); a.textContent = "（自治体の枠なし）"; continue; }
      var amt = Math.floor(budget * Number(items[i].getAttribute("data-share")) / shareSum / 1000) * 1000;
      items[i].classList.toggle("is-off", amt < 5000);
      a.textContent = amt >= 5000 ? "寄付 " + fmt(amt) + " 円" : "枠が足りません";
    }
    var note = nextEl.querySelector(".ft-slot-note");
    if (!note) { note = document.createElement("p"); note.className = "ft-slot-note"; active.parentNode.insertBefore(note, stepsEl); }
    note.textContent = lastSlots === 0
      ? "ワンストップ特例の 5 自治体を使い切っています。すでに寄附した自治体への追加寄附は 1 自治体として数えます。新しい自治体に寄附するなら確定申告にしてください。"
      : "残り枠 " + fmt(lastRemain) + " 円を、ワンストップ特例で使える残り " + lastSlots + " 自治体の範囲で割り振っています（5% の余裕込み）。";
  }

  function steps(m) {
    var tpl = document.getElementById(m.m === "shinkoku" ? "ft-steps-shinkoku" : "ft-steps-onestop");
    stepsEl.innerHTML = '<h3>あなたの手続きルート: ' + (m.m === "shinkoku" ? "確定申告" : "ワンストップ特例") + "</h3>" + (m.why ? '<p class="ft-why">' + esc(m.why) + "</p>" : "") + (tpl ? tpl.innerHTML : "");
  }

  function save() {
    var data = { mode: mode, count: count, people: [], method: methodVal(), done: document.getElementById("ft-done").value, doneN: document.getElementById("ft-done-n").value };
    for (var k = 0; k < count; k++) data.people.push(readPerson(k));
    try { localStorage.setItem(KEY, JSON.stringify(data)); var s = document.getElementById("ft-saved"); s.hidden = false; setTimeout(function () { s.hidden = true; }, 2500); } catch (e) { /* 保存できない環境では何もしない */ }
  }
  function load() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { data = null; }
    if (!data) return false;
    mode = data.mode === "notice" ? "notice" : "salary";
    count = data.count === 2 ? 2 : 1;
    render();
    for (var k = 0; k < count; k++) writePerson(k, data.people[k]);
    var r = root.querySelector('input[name="ft-method"][value="' + data.method + '"]'); if (r) r.checked = true;
    document.getElementById("ft-done").value = data.done || "";
    document.getElementById("ft-done-n").value = data.doneN || "";
    return true;
  }

  root.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest(".ft-mode__btn")) { mode = t.closest(".ft-mode__btn").getAttribute("data-mode"); applyMode(); return; }
    if (t.id === "ft-add") { var keep = readPerson(0); count = 2; render(); writePerson(0, keep); return; }
    if (t.hasAttribute("data-remove")) { var keep0 = readPerson(0); count = 1; render(); writePerson(0, keep0); return; }
    if (t.id === "ft-calc") { calc(); return; }
    if (t.id === "ft-save") { save(); return; }
    if (t.id === "ft-reset") { try { localStorage.removeItem(KEY); } catch (err) { /* noop */ } count = 1; mode = "salary"; render(); document.getElementById("ft-done").value = ""; document.getElementById("ft-done-n").value = ""; resultEl.hidden = true; nextEl.hidden = true; return; }
    var tab = t.closest(".ft-route-tab");
    if (tab) {
      var id = tab.getAttribute("data-route");
      var tabs = nextEl.querySelectorAll(".ft-route-tab"), panels = nextEl.querySelectorAll(".ft-route");
      for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute("aria-selected", String(tabs[i] === tab));
      for (i = 0; i < panels.length; i++) panels[i].hidden = panels[i].getAttribute("data-route") !== id;
      var n = nextEl.querySelector(".ft-slot-note"); if (n) n.parentNode.removeChild(n);
      plan();
    }
  });
  root.addEventListener("input", function (e) { var k = e.target.getAttribute("data-try"); if (k !== null) tryAmount(Number(k), e.target.value); });
  root.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT" && !e.target.hasAttribute("data-try")) { e.preventDefault(); calc(); } });

  if (!load()) render();
})();
