/**
 * ふるさと納税シミュレーターの計算（給与所得者・2026 年分の寄附 → 2026 年分の所得税と 2027 年度の住民税）。
 * ブラウザ（/tools/furusato-jogen/）とビルド（早見表・tests/verify.mjs）で同じ式を使う。
 *
 * ・上限の式は総務省の「住民税所得割額 × 20% ÷（90% − 所得税率 × 1.021）＋ 2,000 円」。
 *   所得税率は「住民税の課税総所得金額 − 人的控除差の合計額 −（所得税の基礎控除額 − 48 万円）」の段階で決める
 *   （地方税法 37 条の 2。最後の項は令和 8 年度住民税から。千代田区「ふるさと納税の制度と申告」で確認 2026-10-25）。
 * ・給与所得控除・所得税の基礎控除は令和 8 年分（令和 8 年度税制改正）。住民税の基礎控除は 43 万円。
 * ・寄附額を入れたときの実質負担は、所得税（寄附金控除・住宅ローン控除・復興特別所得税 2.1%）と
 *   住民税（基本分・特例分・申告特例控除・住宅ローン控除の住民税分）を寄附あり／なしで計算した差から出す。
 * ・均等割・森林環境税・配偶者特別控除・ひとり親控除などは扱わない（画面の注意書きに書く）。
 */
(function (root) {
  "use strict";

  var f1000 = function (x) { return Math.max(0, Math.floor(x / 1000) * 1000); };

  function kyuyoKojo(s) {
    if (s <= 1900000) return Math.min(s, 740000);
    if (s <= 3600000) return Math.max(Math.floor(s * 0.3) + 80000, 690000);
    if (s <= 6600000) return Math.floor(s * 0.2) + 440000;
    if (s <= 8500000) return Math.floor(s * 0.1) + 1100000;
    return 1950000;
  }

  /** 基礎控除 [所得税, 住民税]（所得税は令和 8・9 年分の特例込み） */
  function basic(g) {
    var it = g <= 4890000 ? 1040000 : g <= 6550000 ? 670000 : g <= 23500000 ? 620000 : g <= 24000000 ? 480000 : g <= 24500000 ? 320000 : g <= 25000000 ? 160000 : 0;
    var rt = g <= 24000000 ? 430000 : g <= 24500000 ? 290000 : g <= 25000000 ? 150000 : 0;
    return [it, rt];
  }

  /** 配偶者控除（一般の控除対象配偶者）[所得税, 住民税, 人的控除差] */
  function spouse(g) {
    if (g <= 9000000) return [380000, 330000, 50000];
    if (g <= 9500000) return [260000, 220000, 40000];
    if (g <= 10000000) return [130000, 110000, 20000];
    return [0, 0, 0];
  }

  /** 生命保険料控除（新制度・1 区分）[所得税, 住民税] */
  function lifeOne(p) {
    p = Math.max(0, p || 0);
    var it = p <= 20000 ? p : p <= 40000 ? p / 2 + 10000 : p <= 80000 ? p / 4 + 20000 : 40000;
    var rt = p <= 12000 ? p : p <= 32000 ? p / 2 + 6000 : p <= 56000 ? p / 4 + 14000 : 28000;
    return [Math.floor(it), Math.floor(rt)];
  }

  function incomeTax(t) {
    if (t <= 0) return 0;
    if (t <= 1949000) return t * 0.05;
    if (t <= 3299000) return t * 0.10 - 97500;
    if (t <= 6949000) return t * 0.20 - 427500;
    if (t <= 8999000) return t * 0.23 - 636000;
    if (t <= 17999000) return t * 0.33 - 1536000;
    if (t <= 39999000) return t * 0.40 - 2796000;
    return t * 0.45 - 4796000;
  }

  function rateOf(base) {
    if (base < 0) return 0;
    if (base <= 1950000) return 0.05;
    if (base <= 3300000) return 0.10;
    if (base <= 6950000) return 0.20;
    if (base <= 9000000) return 0.23;
    if (base <= 18000000) return 0.33;
    if (base <= 40000000) return 0.40;
    return 0.45;
  }

  function limitFrom(shotokuwari, rate) {
    if (!(shotokuwari > 0)) return 0;
    return Math.floor(shotokuwari * 0.2 / (0.9 - rate * 1.021)) + 2000;
  }

  var num = function (v) { var n = Number(v); return isFinite(n) && n > 0 ? Math.floor(n) : 0; };

  /**
   * 1 人分の税の土台。
   * in: { salary, shaho（空なら年収の 15%）, ideco, spouse(bool), ippan, tokutei, rojin, dokyo, nensho,
   *       lifeIppan, lifeKaigo, lifeNenkin（年間保険料・新制度）, jishin（地震保険料）, iryo（医療費の自己負担 − 保険金）,
   *       loan（住宅ローン控除の年間の控除額）}
   */
  function person(i) {
    var s = num(i.salary);
    var shaho = i.shaho === "" || i.shaho == null ? Math.floor(s * 0.15) : num(i.shaho);
    var ippan = num(i.ippan), tokutei = num(i.tokutei), rojin = num(i.rojin), dokyo = num(i.dokyo), nensho = num(i.nensho);
    var adj = s > 8500000 && (nensho > 0 || tokutei > 0 || ippan > 0) ? Math.floor((Math.min(s, 10000000) - 8500000) * 0.1) : 0;
    var g = Math.max(0, s - kyuyoKojo(s) - adj);

    var b = basic(g);
    var sp = i.spouse ? spouse(g) : [0, 0, 0];
    var depIt = ippan * 380000 + tokutei * 630000 + rojin * 480000 + dokyo * 580000;
    var depRt = ippan * 330000 + tokutei * 450000 + rojin * 380000 + dokyo * 450000;
    var l1 = lifeOne(i.lifeIppan), l2 = lifeOne(i.lifeKaigo), l3 = lifeOne(i.lifeNenkin);
    var lifeIt = Math.min(120000, l1[0] + l2[0] + l3[0]);
    var lifeRt = Math.min(70000, l1[1] + l2[1] + l3[1]);
    var j = num(i.jishin);
    var jishinIt = Math.min(50000, j), jishinRt = Math.min(25000, Math.floor(j / 2));
    var iryo = Math.min(2000000, Math.max(0, num(i.iryo) - Math.min(100000, Math.floor(g * 0.05))));
    var ideco = num(i.ideco);
    var jinteki = (g <= 25000000 ? 50000 : 0) + sp[2] + ippan * 50000 + tokutei * 180000 + rojin * 100000 + dokyo * 130000;

    var common = shaho + ideco + jishinIt * 0 + iryo;
    var kojoIt = common + jishinIt + lifeIt + b[0] + sp[0] + depIt;
    var kojoRt = common + jishinRt + lifeRt + b[1] + sp[1] + depRt;
    var taxIt = f1000(g - kojoIt);
    var taxRt = f1000(g - kojoRt);

    var chosei = 0;
    if (g <= 25000000 && taxRt > 0) chosei = taxRt <= 2000000 ? Math.min(jinteki, taxRt) * 0.05 : Math.max((jinteki - (taxRt - 2000000)) * 0.05, 2500);
    var shotokuwari = Math.max(0, Math.floor(taxRt * 0.1 - chosei));
    var basicExcess = Math.max(0, b[0] - 480000);
    var rate = rateOf(taxRt - jinteki - basicExcess);
    return {
      salary: s, shaho: shaho, g: g, kojoIt: kojoIt, kojoRt: kojoRt, basicExcess: basicExcess, taxIt: taxIt, taxRt: taxRt, jinteki: jinteki,
      shotokuwari: shotokuwari, rate: rate, loan: num(i.loan), limit: limitFrom(shotokuwari, rate)
    };
  }

  /**
   * 住民税決定通知書から作る土台。shotokuwari = 所得割額（市区町村民税＋道府県民税）、kazei = 課税標準額（所得控除の後の課税総所得金額）、
   * sogo = 総所得金額（所得控除の前。空なら課税標準額から推定）。所得税の基礎控除の段階は総所得金額で決める。
   */
  function fromNotice(i) {
    var shotokuwari = num(i.shotokuwari);
    var kazei = num(i.kazei);
    var g = num(i.sogo) || Math.round(kazei * 1.25 + 430000);
    var jinteki = num(i.jinteki) || 50000;
    var basicExcess = Math.max(0, basic(g)[0] - 480000);
    var rate = rateOf(kazei - jinteki - basicExcess);
    return { notice: true, g: 0, shotokuwari: shotokuwari, rate: rate, jinteki: jinteki, basicExcess: basicExcess, loan: 0, limit: limitFrom(shotokuwari, rate) };
  }

  /**
   * 寄附額 d を入れたときの税（所得税＋復興特別所得税、住民税所得割）と、寄附なしとの差。
   * method: "onestop" | "shinkoku"
   */
  function simulate(p, d, method) {
    d = num(d);
    var rate = p.rate;
    // 住宅ローン控除の住民税分の上限: （所得税の課税総所得金額等 ＋（所得税の基礎控除 − 48 万円））× 5%、最高 97,500 円（2022〜2025 年入居）
    var loanCap = function (taxIt) { return Math.min(Math.floor((taxIt + (p.basicExcess || 0)) * 0.05), 97500); };

    function taxes(withDonation) {
      if (p.notice) {
        // 決定通知書モード: 所得税を持たないので、所得税分も住民税側の申告特例控除として扱う（ワンストップと同じ形）
        var dd = withDonation ? d : 0;
        var base = Math.max(0, dd - 2000);
        var sp = Math.min(base * (0.9 - rate * 1.021), p.shotokuwari * 0.2);
        var sk = 0.9 - rate * 1.021 > 0 ? sp * (rate * 1.021) / (0.9 - rate * 1.021) : 0;
        var rt = withDonation ? Math.max(0, p.shotokuwari - base * 0.1 - sp - sk) : p.shotokuwari;
        return { it: 0, rt: rt };
      }
      var dIt = withDonation && method === "shinkoku" ? Math.max(0, Math.min(d, p.g * 0.4) - 2000) : 0;
      var taxIt = withDonation && method === "shinkoku" ? f1000(p.g - p.kojoIt - dIt) : p.taxIt;
      var itBefore = Math.floor(incomeTax(taxIt));
      var itAfterLoan = Math.max(0, itBefore - p.loan);
      var loanToRt = Math.min(Math.max(0, p.loan - itBefore), loanCap(taxIt));
      var it = Math.floor(itAfterLoan * 1.021);
      var credit = 0;
      if (withDonation && d > 2000) {
        var basicPart = (Math.min(d, p.g * 0.3) - 2000) * 0.1;
        var special = Math.min((d - 2000) * (0.9 - rate * 1.021), p.shotokuwari * 0.2);
        var shinkokuTokurei = method === "onestop" && 0.9 - rate * 1.021 > 0 ? special * (rate * 1.021) / (0.9 - rate * 1.021) : 0;
        credit = basicPart + special + shinkokuTokurei;
      }
      var rt = Math.max(0, p.shotokuwari - loanToRt - credit);
      return { it: it, rt: rt };
    }
    var a = taxes(false), b = taxes(true);
    var saved = Math.floor(a.it - b.it + a.rt - b.rt);
    return { donation: d, saved: saved, burden: d - saved, itSaved: Math.floor(a.it - b.it), rtSaved: Math.floor(a.rt - b.rt) };
  }

  /** 実質負担が 2,000 円（端数の誤差 100 円まで）に収まる最大の寄附額（1,000 円単位） */
  function realLimit(p, method) {
    if (!(p.limit > 2000)) return 0;
    var best = 0, top = Math.ceil(p.limit * 1.3 / 1000) * 1000;
    for (var d = 3000; d <= top; d += 1000) if (simulate(p, d, method).burden <= 2100) best = d;
    return best;
  }

  var api = { person: person, fromNotice: fromNotice, simulate: simulate, realLimit: realLimit, limitFrom: limitFrom, rateOf: rateOf, kyuyoKojo: kyuyoKojo, incomeTax: incomeTax };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FurusatoCalc = api;
})(this);
