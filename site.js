/* Shared behaviour for the CV hub.
   Experience totals follow the reference-letter formula:
   day-inclusive span, dateutil relativedelta(end + 1 day, start),
   average month = 365.25 / 12. "Present" is today in Asia/Hong_Kong.
   Chubb ended Fri 23 May 2025; PolyU started Mon 26 May 2025.
   The Sat–Sun 24–25 May 2025 gap is not employed time. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  var boot = function () {
    api.renderExperience(document);
    api.renderCpdTotal(document);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var AVG_MONTH_DAYS = 365.25 / 12;
  var CHUBB_START = utcDate(2024, 5, 13);
  var CHUBB_END = utcDate(2025, 5, 23);
  var POLYU_START = utcDate(2025, 5, 26);

  function utcDate(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d));
  }

  function addDays(date, n) {
    return new Date(date.getTime() + n * 86400000);
  }

  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function addMonths(date, months) {
    var monthIndex = date.getUTCMonth() + months;
    var year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
    var month = ((monthIndex % 12) + 12) % 12;
    var dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), dim)));
  }

  /* dateutil.relativedelta for two dates, result >= 0. */
  function relativeDelta(end, start) {
    var months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth());
    var anchor = addMonths(start, months);
    if (anchor.getTime() > end.getTime()) {
      months -= 1;
      anchor = addMonths(start, months);
    }
    return {
      years: Math.floor(months / 12),
      months: ((months % 12) + 12) % 12,
      days: daysBetween(anchor, end),
    };
  }

  function inclusiveDays(start, end) {
    return daysBetween(start, end) + 1;
  }

  function todayHKT(now) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now || new Date());
    var map = {};
    for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
    return utcDate(Number(map.year), Number(map.month), Number(map.day));
  }

  function iso(date) {
    var m = String(date.getUTCMonth() + 1).padStart(2, "0");
    var d = String(date.getUTCDate()).padStart(2, "0");
    return date.getUTCFullYear() + "-" + m + "-" + d;
  }

  function oneDecimal(n) {
    return (Math.round(n * 10) / 10).toFixed(1);
  }

  function twoDecimal(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function ym(rd) {
    return rd.years + " yr " + rd.months + " mo";
  }

  function ymd(rd, days) {
    return rd.years + "y " + rd.months + "m " + rd.days + "d (" + days + " days)";
  }

  function experienceAsOf(present) {
    var chubbDays = inclusiveDays(CHUBB_START, CHUBB_END);
    var polyuDays = present.getTime() < POLYU_START.getTime() ? 0 : inclusiveDays(POLYU_START, present);
    var employedDays = chubbDays + polyuDays;
    var chubb = relativeDelta(addDays(CHUBB_END, 1), CHUBB_START);
    var polyu = polyuDays
      ? relativeDelta(addDays(present, 1), POLYU_START)
      : { years: 0, months: 0, days: 0 };
    var total = relativeDelta(addDays(CHUBB_START, employedDays), CHUBB_START);
    return {
      present: present,
      presentIso: iso(present),
      chubb: chubb,
      chubbDays: chubbDays,
      polyu: polyu,
      polyuDays: polyuDays,
      total: total,
      employedDays: employedDays,
      polyuMonths: polyuDays / AVG_MONTH_DAYS,
      totalMonths: employedDays / AVG_MONTH_DAYS,
      totalYears: employedDays / 365.25,
    };
  }

  function text(doc, id, value) {
    var el = doc.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderExperience(doc, now) {
    if (!doc.getElementById("hub-exp") && !doc.getElementById("exp-total-ym")) return;
    var stats = experienceAsOf(todayHKT(now));
    text(doc, "hub-exp", ym(stats.total));
    text(doc, "exp-present", stats.presentIso + " (HKT)");
    text(doc, "exp-total-ym", ym(stats.total));
    text(
      doc,
      "exp-total-detail",
      oneDecimal(stats.totalMonths) + " months · " + twoDecimal(stats.totalYears) + " years"
    );
    text(doc, "exp-polyu-ym", ym(stats.polyu));
    text(doc, "exp-polyu-detail", "May 2025 – Present · " + oneDecimal(stats.polyuMonths) + " mo");
    text(doc, "exp-polyu-period", "2025-05-26 – " + stats.presentIso + " (Present)");
    text(doc, "exp-polyu-dur", ymd(stats.polyu, stats.polyuDays));
    text(doc, "exp-total-dur", ymd(stats.total, stats.employedDays));
    text(doc, "exp-calc-date", stats.presentIso + " HKT");
  }

  function renderCpdTotal(doc) {
    var cells = doc.querySelectorAll(".cpd-hours");
    var out = doc.getElementById("cpd-hours");
    if (!cells.length || !out) return;
    var total = 0;
    for (var i = 0; i < cells.length; i++) {
      var n = parseFloat(cells[i].textContent);
      if (!isNaN(n)) total += n;
    }
    out.textContent = total.toFixed(1);
  }

  return {
    utcDate: utcDate,
    relativeDelta: relativeDelta,
    todayHKT: todayHKT,
    experienceAsOf: experienceAsOf,
    renderExperience: renderExperience,
    renderCpdTotal: renderCpdTotal,
  };
});
