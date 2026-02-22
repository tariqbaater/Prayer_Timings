/********************************************************************
 * PrayTime (JS port based on your Lua code)
 * - Methods, parameters, sun position, Julian date, adjustments
 * - Returns: [Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha, Imsak]
 ********************************************************************/

class PrayTime {
  static Jafari = 0;
  static Karachi = 1;
  static ISNA = 2;
  static MWL = 3;
  static Makkah = 4;
  static Egypt = 5;
  static Custom = 6;
  static Tehran = 7;
  static Bahrain = 8;

  static Shafii = 0;
  static Hanafi = 1;

  static None = 0;
  static MidNight = 1;
  static OneSeventh = 2;
  static AngleBased = 3;

  static Time24 = 0;
  static Time12 = 1;
  static Time12NS = 2;
  static Float = 3;

  static timeNames = [
    "Fajr",
    "Sunrise",
    "Dhuhr",
    "Asr",
    "Sunset",
    "Maghrib",
    "Isha",
    "Imsak",
  ];
  static InvalidTime = "-----";

  constructor(methodID = PrayTime.MWL) {
    this.calcMethod = methodID;
    this.asrJuristic = PrayTime.Shafii;
    this.dhuhrMinutes = 0;
    this.adjustHighLats = PrayTime.MidNight;
    this.timeFormat = PrayTime.Time24;
    this.numIterations = 1;

    this.methodParams = {};
    this.methodParams[PrayTime.Jafari] = [16, 0, 4, 0, 14];
    this.methodParams[PrayTime.Karachi] = [18, 1, 0, 0, 18];
    this.methodParams[PrayTime.ISNA] = [15, 1, 0, 0, 15];
    this.methodParams[PrayTime.MWL] = [18, 1, 0, 0, 17];
    this.methodParams[PrayTime.Makkah] = [18.5, 1, 0, 1, 90];
    this.methodParams[PrayTime.Egypt] = [19.5, 1, 0, 0, 17.5];
    this.methodParams[PrayTime.Tehran] = [17.7, 0, 4.5, 0, 14];
    this.methodParams[PrayTime.Custom] = [18, 1, 0, 0, 17];
    this.methodParams[PrayTime.Bahrain] = [17.6, 0, 4, 0, 14];
  }

  setCalcMethod(methodID) {
    this.calcMethod = methodID;
  }
  setAsrMethod(methodID) {
    if (methodID === 0 || methodID === 1) this.asrJuristic = methodID;
  }
  setHighLatsMethod(methodID) {
    this.adjustHighLats = methodID;
  }
  setTimeFormat(fmt) {
    this.timeFormat = fmt;
  }
  setDhuhrMinutes(min) {
    this.dhuhrMinutes = min;
  }

  setCustomParams(params) {
    for (let i = 0; i < 5; i++) {
      if (params[i] == null)
        this.methodParams[PrayTime.Custom][i] =
          this.methodParams[this.calcMethod][i];
      else this.methodParams[PrayTime.Custom][i] = params[i];
    }
    this.calcMethod = PrayTime.Custom;
  }

  getDatePrayerTimes(
    year,
    month,
    day,
    latitude,
    longitude,
    timeZoneHours,
    imsakOffsetMinutes = 10,
  ) {
    this.lat = latitude;
    this.lng = longitude;

    const tz =
      typeof timeZoneHours === "number" && !Number.isNaN(timeZoneHours)
        ? timeZoneHours
        : this.getTimeZoneFromBrowser(year, month, day);

    this.timeZone = tz;

    this.JDate =
      this.julianDate(year, month, day) - longitude / (15 * 24);

    return this.computeDayTimes(imsakOffsetMinutes);
  }

  computeDayTimes(imsakOffsetMinutes) {
    let times = [5, 6, 12, 13, 18, 18, 18, 5];
    for (let i = 0; i < this.numIterations; i++) {
      times = this.computeTimes(times, imsakOffsetMinutes);
    }
    times = this.adjustTimes(times);
    return this.adjustTimesFormat(times);
  }

  computeTimes(times, imsakOffsetMinutes) {
    const t = this.dayPortion(times);
    const [fajrAngle] = this.methodParams[this.calcMethod];

    const imsakShift = imsakOffsetMinutes / 60 / 24;

    const Imsak = this.computeTime(180 - fajrAngle, t[0] - imsakShift);
    const Fajr = this.computeTime(180 - fajrAngle, t[0]);
    const Sunrise = this.computeTime(180 - 0.833, t[1]);
    const Dhuhr = this.computeMidDay(t[2]);
    const Asr = this.computeAsr(1 + this.asrJuristic, t[3]);
    const Sunset = this.computeTime(0.833, t[4]);

    const magParam = this.methodParams[this.calcMethod][2];
    const ishaParam = this.methodParams[this.calcMethod][4];

    const Maghrib = this.computeTime(magParam, t[5]);
    const Isha = this.computeTime(ishaParam, t[6]);

    return [Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha, Imsak];
  }

  adjustTimes(times) {
    for (let i = 0; i < 8; i++) {
      times[i] = times[i] + this.timeZone - this.lng / 15;
    }

    times[2] = times[2] + this.dhuhrMinutes / 60;

    const maghribIsMinutes = this.methodParams[this.calcMethod][1] === 1;
    const maghribVal = this.methodParams[this.calcMethod][2];

    const ishaIsMinutes = this.methodParams[this.calcMethod][3] === 1;
    const ishaVal = this.methodParams[this.calcMethod][4];

    if (maghribIsMinutes) {
      times[5] = times[4] + maghribVal / 60;
    }
    if (ishaIsMinutes) {
      times[6] = times[5] + ishaVal / 60;
    }

    if (this.adjustHighLats !== PrayTime.None) {
      times = this.adjustHighLatTimes(times);
    }

    return times;
  }

  adjustTimesFormat(times) {
    if (this.timeFormat === PrayTime.Float) return times;

    for (let i = 0; i < 8; i++) {
      if (this.timeFormat === PrayTime.Time12)
        times[i] = this.floatToTime12(times[i], false);
      else if (this.timeFormat === PrayTime.Time12NS)
        times[i] = this.floatToTime12(times[i], true);
      else times[i] = this.floatToTime24(times[i]);
    }
    return times;
  }

  adjustHighLatTimes(times) {
    const nightTime = this.timeDiff(times[4], times[1]);

    const fajrAngle = this.methodParams[this.calcMethod][0];
    const fajrDiff = this.nightPortion(fajrAngle) * nightTime;
    if (
      Number.isNaN(times[0]) ||
      this.timeDiff(times[0], times[1]) > fajrDiff
    ) {
      times[0] = times[1] - fajrDiff;
    }

    const ishaIsMinutes = this.methodParams[this.calcMethod][3] === 1;
    const ishaAngle = ishaIsMinutes
      ? 18
      : this.methodParams[this.calcMethod][4];
    const ishaDiff = this.nightPortion(ishaAngle) * nightTime;
    if (
      Number.isNaN(times[6]) ||
      this.timeDiff(times[4], times[6]) > ishaDiff
    ) {
      times[6] = times[4] + ishaDiff;
    }

    const maghribIsMinutes = this.methodParams[this.calcMethod][1] === 1;
    const maghribAngle = maghribIsMinutes
      ? 4
      : this.methodParams[this.calcMethod][2];
    const maghribDiff = this.nightPortion(maghribAngle) * nightTime;
    if (
      Number.isNaN(times[5]) ||
      this.timeDiff(times[4], times[5]) > maghribDiff
    ) {
      times[5] = times[4] + maghribDiff;
    }

    return times;
  }

  nightPortion(angle) {
    if (this.adjustHighLats === PrayTime.AngleBased) return (1 / 60) * angle;
    if (this.adjustHighLats === PrayTime.MidNight) return 1 / 2;
    if (this.adjustHighLats === PrayTime.OneSeventh) return 1 / 7;
    return 0;
  }

  dayPortion(times) {
    return times.map((t) => t / 24);
  }

  sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = this.fixangle(357.529 + 0.98560028 * D);
    const q = this.fixangle(280.459 + 0.98564736 * D);
    const L = this.fixangle(
      q + 1.915 * this.dsin(g) + 0.02 * this.dsin(2 * g),
    );

    const e = 23.439 - 0.00000036 * D;

    const d = this.darcsin(this.dsin(e) * this.dsin(L));
    let RA =
      this.darctan2(this.dcos(e) * this.dsin(L), this.dcos(L)) / 15;
    RA = this.fixhour(RA);
    const EqT = q / 15 - RA;

    return [d, EqT];
  }

  equationOfTime(jd) {
    return this.sunPosition(jd)[1];
  }
  sunDeclination(jd) {
    return this.sunPosition(jd)[0];
  }

  computeMidDay(t) {
    const T = this.equationOfTime(this.JDate + t);
    return this.fixhour(12 - T);
  }

  computeTime(G, t) {
    const D = this.sunDeclination(this.JDate + t);
    const Z = this.computeMidDay(t);
    const V =
      (1 / 15) *
      this.darccos(
        (-this.dsin(G) - this.dsin(D) * this.dsin(this.lat)) /
          (this.dcos(D) * this.dcos(this.lat)),
      );
    return Z + (G > 90 ? -V : V);
  }

  computeAsr(step, t) {
    const D = this.sunDeclination(this.JDate + t);
    const G = -this.darccot(step + this.dtan(Math.abs(this.lat - D)));
    return this.computeTime(G, t);
  }

  floatToTime24(time) {
    if (Number.isNaN(time)) return PrayTime.InvalidTime;
    time = this.fixhour(time + 0.5 / 60);
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    return `${this.twoDigits(hours)}:${this.twoDigits(minutes)}`;
  }

  floatToTime12(time, noSuffix) {
    if (Number.isNaN(time)) return PrayTime.InvalidTime;
    time = this.fixhour(time + 0.5 / 60);
    let hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    const suffix = hours >= 12 ? " pm" : " am";
    hours = ((hours + 12 - 1) % 12) + 1;
    return `${hours}:${this.twoDigits(minutes)}${noSuffix ? "" : suffix}`;
  }

  timeDiff(time1, time2) {
    return this.fixhour(time2 - time1);
  }
  twoDigits(n) {
    return String(n).padStart(2, "0");
  }

  julianDate(year, month, day) {
    let y = year,
      m = month;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return (
      Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) +
      day +
      B -
      1524.5
    );
  }

  dtr(d) {
    return (d * Math.PI) / 180.0;
  }
  rtd(r) {
    return (r * 180.0) / Math.PI;
  }
  dsin(d) {
    return Math.sin(this.dtr(d));
  }
  dcos(d) {
    return Math.cos(this.dtr(d));
  }
  dtan(d) {
    return Math.tan(this.dtr(d));
  }
  darcsin(x) {
    return this.rtd(Math.asin(x));
  }
  darccos(x) {
    return this.rtd(Math.acos(x));
  }
  darctan2(y, x) {
    return this.rtd(Math.atan2(y, x));
  }
  darccot(x) {
    return this.rtd(Math.atan(1 / x));
  }
  fixangle(a) {
    a = a - 360.0 * Math.floor(a / 360.0);
    return a < 0 ? a + 360.0 : a;
  }
  fixhour(a) {
    a = a - 24.0 * Math.floor(a / 24.0);
    return a < 0 ? a + 24.0 : a;
  }

  getTimeZoneFromBrowser(year, month, day) {
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offsetMin = d.getTimezoneOffset();
    return -offsetMin / 60;
  }
}

/********************************************************************
 * UI + Timetable generation
 ********************************************************************/
const $ = (id) => document.getElementById(id);

const settingsKey = "iftar-timetable-settings";

const cities = [
  { name: "Riyadh", lat: 24.7136, lng: 46.6753, method: PrayTime.Makkah },
  { name: "Jeddah", lat: 21.4858, lng: 39.1925, method: PrayTime.Makkah },
  { name: "Makkah", lat: 21.3891, lng: 39.8579, method: PrayTime.Makkah },
  { name: "Madinah", lat: 24.5247, lng: 39.5692, method: PrayTime.Makkah },
  { name: "Dammam", lat: 26.4207, lng: 50.0888, method: PrayTime.Makkah },
  { name: "Mombasa", lat: -4.0545, lng: 39.6651, method: PrayTime.MWL },
  { name: "Custom…", lat: 24.7136, lng: 46.6753, method: PrayTime.MWL },
];

const methods = [
  { id: PrayTime.Jafari, label: "Jafari (Ithna Ashari)" },
  { id: PrayTime.Karachi, label: "Karachi (UIS)" },
  { id: PrayTime.ISNA, label: "ISNA" },
  { id: PrayTime.MWL, label: "MWL" },
  { id: PrayTime.Makkah, label: "Umm al-Qura (Makkah)" },
  { id: PrayTime.Egypt, label: "Egypt" },
  { id: PrayTime.Tehran, label: "Tehran" },
  { id: PrayTime.Bahrain, label: "Bahrain (Al-Hadi Calendar)" },
];

function fmtDateLong(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Hijri (Islamic) calendar conversion
// Prefer the browser's Intl Islamic calendar (more accurate than our old tabular-ish math).
// Note: Actual Hijri dates can differ by locale/country (moon sighting vs. calculated).
const hijriMonthNames = [
  "Muharram",
  "Safar",
  "Rabi' I",
  "Rabi' II",
  "Jumada I",
  "Jumada II",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qi'dah",
  "Dhu al-Hijjah",
];

function normalizeToLocalNoon(date) {
  // Avoid off-by-one around midnight and DST transitions.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

/**
 * Convert Gregorian date -> Hijri using Intl.
 * Returns { hy, hm, hd, calendar } or null if not supported.
 */
function gregorianToHijriIntl(
  input = new Date(),
  locale = "en",
  calendar = "islamic-umalqura",
) {
  const date0 = input instanceof Date ? new Date(input) : new Date(input);
  if (Number.isNaN(date0.getTime())) return null;

  const date = normalizeToLocalNoon(date0);
  const calendarsToTry = [calendar, "islamic", "islamic-civil", "islamic-tbla"];

  for (const cal of calendarsToTry) {
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat(`${locale}-u-ca-${cal}`, {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
    } catch (error) {
      continue;
    }

    const parts = fmt.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const hy = Number(get("year"));
    const hm = Number(get("month"));
    const hd = Number(get("day"));

    if (!Number.isFinite(hy) || !Number.isFinite(hm) || !Number.isFinite(hd)) {
      continue;
    }
    if (hm < 1 || hm > 12) continue;

    return { hy, hm, hd, calendar: cal };
  }

  return null;
}

function formatHijriDate(date) {
  const hijri = gregorianToHijriIntl(date, "en", "islamic-umalqura");
  if (!hijri) return "—";
  return `${hijri.hd} ${hijriMonthNames[hijri.hm - 1]} ${hijri.hy}`;
}

function parseHHMMToDate(baseDate, hhmm) {
  let s = hhmm.trim();
  const lower = s.toLowerCase();
  let isPM = false;
  let isAM = false;
  if (lower.endsWith("pm")) {
    isPM = true;
    s = s.slice(0, -2).trim();
  } else if (lower.endsWith("am")) {
    isAM = true;
    s = s.slice(0, -2).trim();
  }
  const parts = s.split(":");
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) || 0;
  let hour = hh;
  if (isPM) {
    if (hour < 12) hour += 12;
  } else if (isAM) {
    if (hour === 12) hour = 0;
  }
  const d = new Date(baseDate);
  if (!Number.isFinite(hour) || !Number.isFinite(mm)) {
    return new Date(NaN);
  }
  d.setHours(hour, mm, 0, 0);
  return d;
}

function setTodayDateInput() {
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  $("start").value = `${yyyy}-${mm}-${dd}`;
}

function initDropdowns() {
  const citySel = $("city");
  citySel.innerHTML = cities
    .map((c) => `<option value="${c.name}">${c.name}</option>`)
    .join("");

  const methodSel = $("method");
  methodSel.innerHTML = methods
    .map((m) => `<option value="${m.id}">${m.label}</option>`)
    .join("");

  const now = new Date();
  $("tz").value = String(-now.getTimezoneOffset() / 60);
}

function syncCityToLatLng() {
  const sel = $("city").value;
  const c = cities.find((x) => x.name === sel);
  if (!c) return;
  const isCustom = sel === "Custom…";
  // For preconfigured cities, reset lat/lng to defaults and disable inputs
  if (!isCustom) {
    $("lat").value = c.lat;
    $("lng").value = c.lng;
  }
  // Enable lat/lng only for custom city
  $("lat").disabled = !isCustom;
  $("lng").disabled = !isCustom;
  // Sync method for non-custom
  if (!isCustom && c.method != null) {
    $("method").value = String(c.method);
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(settingsKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveSettings() {
  const settings = {
    city: $("city").value,
    lat: $("lat").value,
    lng: $("lng").value,
    method: $("method").value,
    tz: $("tz").value,
    start: $("start").value,
    days: $("days").value,
  };
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function applySettings() {
  const settings = loadSettings();
  if (!settings) return;
  if (settings.city) $("city").value = settings.city;
  if (settings.lat) $("lat").value = settings.lat;
  if (settings.lng) $("lng").value = settings.lng;
  if (settings.method) $("method").value = settings.method;
  if (settings.tz) $("tz").value = settings.tz;
  if (settings.start) $("start").value = settings.start;
  if (settings.days) $("days").value = settings.days;
}


function buildRows() {
  const startStr = $("start").value;
  const startDate = startStr
    ? new Date(startStr + "T00:00:00")
    : new Date();
  const days = parseInt($("days").value, 10);

  const lat = parseFloat($("lat").value);
  const lng = parseFloat($("lng").value);
  const tz = parseFloat($("tz").value);

  const methodID = parseInt($("method").value, 10);

  const pt = new PrayTime(methodID);
  // default to 12-hour format
  pt.setTimeFormat(PrayTime.Time12);
  pt.setHighLatsMethod(PrayTime.MidNight);

  const rows = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);

    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

    const times = pt.getDatePrayerTimes(
      y,
      m,
      day,
      lat,
      lng,
      tz
    );
    const map = {};
    PrayTime.timeNames.forEach((name, idx) => (map[name] = times[idx]));

    rows.push({ date: d, times: map });
  }

  return rows;
}

function renderTable(rows) {
  const host = $("table");
  host.innerHTML = "";

  const head = document.createElement("div");
  head.className = "row";
  head.innerHTML = `
    <div class="cell headcell">Date</div>
    <div class="cell headcell">Fajr</div>
    <div class="cell headcell">Sunrise</div>
    <div class="cell headcell">Dhuhr</div>
    <div class="cell headcell">Asr</div>
    <div class="cell headcell">Maghrib (Iftar)</div>
    <div class="cell headcell">Isha</div>
  `;
  host.appendChild(head);

  const now = new Date();

  for (const r of rows) {
    const isToday = sameDay(r.date, now);
    const badge = isToday
      ? `<span class="badge today">Today</span>`
      : `<span class="badge">${r.date.toLocaleDateString(undefined, { weekday: 'short' })}</span>`;

    const row = document.createElement("div");
    row.className = "row";
    if (isToday) row.classList.add("today-row");
    row.innerHTML = `
      <div class="cell">
        <div class="datecell">
          <span>${fmtDateLong(r.date)}</span>
          ${badge}
        </div>
      </div>
      <div class="cell mono">${r.times.Fajr}</div>
      <div class="cell mono">${r.times.Sunrise}</div>
      <div class="cell mono">${r.times.Dhuhr}</div>
      <div class="cell mono">${r.times.Asr}</div>
      <div class="cell mono" style="font-weight:800">${r.times.Maghrib}</div>
      <div class="cell mono">${r.times.Isha}</div>
    `;
    host.appendChild(row);
  }
}

function pickTodayOrNext(rows) {
  const now = new Date();
  const today = rows.find((r) => sameDay(r.date, now));
  if (today) return today;

  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows.find((r) => r.date >= today0) || rows[0];
}

let countdownTimer = null;

function startCountdown(targetDate, label) {
  const cdH = $("cdH"),
    cdM = $("cdM"),
    cdS = $("cdS");
  const nextName = $("nextName");

  if (countdownTimer) clearInterval(countdownTimer);

  if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) {
    cdH.textContent = "--";
    cdM.textContent = "--";
    cdS.textContent = "--";
    nextName.textContent = "—";
    return;
  }

  nextName.textContent = label || "Next";

  function tick() {
    const now = new Date();
    let diffMs = targetDate - now;

    if (diffMs <= 0) {
      cdH.textContent = "00";
      cdM.textContent = "00";
      cdS.textContent = "00";
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = null;
      // Time just passed; recompute the next target.
      setTimeout(regenerate, 750);
      return;
    }

    const totalSec = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    cdH.textContent = String(h).padStart(2, "0");
    cdM.textContent = String(m).padStart(2, "0");
    cdS.textContent = String(s).padStart(2, "0");
    nextName.textContent = label || "Next";
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function getPrayerTimesMapForDate(pt, date, lat, lng, tz) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();

  const times = pt.getDatePrayerTimes(y, m, day, lat, lng, tz);
  const map = {};
  PrayTime.timeNames.forEach((name, idx) => (map[name] = times[idx]));
  return map;
}

function getNextPrayerTarget(now, pt, lat, lng, tz) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayMap = getPrayerTimesMapForDate(pt, today, lat, lng, tz);
  const prayers = [
    { key: "Fajr", label: "Fajr" },
    { key: "Dhuhr", label: "Dhuhr" },
    { key: "Asr", label: "Asr" },
    { key: "Maghrib", label: "Maghrib" },
    { key: "Isha", label: "Isha" },
  ];

  for (const p of prayers) {
    const t = todayMap[p.key];
    const d = parseHHMMToDate(today, String(t));
    if (!Number.isNaN(d.getTime()) && d > now) {
      return { name: p.label, time: String(t), date: d };
    }
  }

  // After Isha: next target is tomorrow's Fajr.
  const tomorrowMap = getPrayerTimesMapForDate(pt, tomorrow, lat, lng, tz);
  const t = tomorrowMap.Fajr;
  const d = parseHHMMToDate(tomorrow, String(t));
  return { name: "Fajr", time: String(t), date: d };
}

function regenerate() {
  const rows = buildRows();
  renderTable(rows);

  const city = $("city").value;
  const lat = $("lat").value;
  const lng = $("lng").value;
  const tz = $("tz").value;

  // Display city + method in header, and show today's Hijri date prominently.
  const todayHijri = formatHijriDate(new Date());
  const methodId = parseInt($("method").value, 10);
  const methodLabel = methods.find((m) => m.id === methodId)?.label || "";
  $("subline").textContent = `${city} • ${methodLabel}`;

  const hijriEl = $("hijriDate");
  if (hijriEl) hijriEl.textContent = todayHijri;

  const now = new Date();
  const methodID = parseInt($("method").value, 10);
  const pt = new PrayTime(methodID);
  pt.setTimeFormat(PrayTime.Time12);
  pt.setHighLatsMethod(PrayTime.MidNight);

  const next = getNextPrayerTarget(
    now,
    pt,
    parseFloat($("lat").value),
    parseFloat($("lng").value),
    parseFloat($("tz").value),
  );

  $("bigLabel").textContent = `Next Prayer: ${next.name}`;
  $("bigTime").textContent = next.time;

  startCountdown(next.date, next.name);
  saveSettings();
}

(function init() {
  initDropdowns();
  setTodayDateInput();
  // initial sync then load saved settings, then re-sync for correct state
  syncCityToLatLng();
  applySettings();
  syncCityToLatLng();

  $("city").addEventListener("change", () => {
    syncCityToLatLng();
    regenerate();
  });
  $("method").addEventListener("change", regenerate);
  $("days").addEventListener("change", regenerate);
  $("start").addEventListener("change", regenerate);
  $("lat").addEventListener("change", regenerate);
  $("lng").addEventListener("change", regenerate);
  $("tz").addEventListener("change", regenerate);

  regenerate();
})();
