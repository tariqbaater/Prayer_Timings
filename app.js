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
    } catch (_error) {
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

/**
 * Convert Hijri date -> Gregorian using binary search over Intl.
 * Searches Gregorian dates to find the one matching the target Hijri date.
 * Returns a Date object or null if not found.
 */
function hijriToGregorian(hy, hm, hd) {
  // Approximate: Hijri year ~354 days, epoch ~622 CE
  const approxDays = Math.floor((hy - 1) * 354.36667 + (hm - 1) * 29.5 + hd);
  const epochOffset = new Date(622, 6, 16).getTime();
  const approxMs = epochOffset + approxDays * 86400000;
  const approxDate = new Date(approxMs);

  // Binary search within +/- 30 days of the approximation
  let lo = new Date(approxDate.getTime() - 30 * 86400000);
  let hi = new Date(approxDate.getTime() + 30 * 86400000);

  // First try: linear scan (more reliable for small ranges)
  for (let d = new Date(lo); d <= hi; d.setDate(d.getDate() + 1)) {
    const h = gregorianToHijriIntl(d, "en", "islamic-umalqura");
    if (h && h.hy === hy && h.hm === hm && h.hd === hd) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }

  // Wider search if not found (edge cases around year boundaries)
  lo = new Date(approxDate.getTime() - 90 * 86400000);
  hi = new Date(approxDate.getTime() + 90 * 86400000);
  for (let d = new Date(lo); d <= hi; d.setDate(d.getDate() + 1)) {
    const h = gregorianToHijriIntl(d, "en", "islamic-umalqura");
    if (h && h.hy === hy && h.hm === hm && h.hd === hd) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }

  return null;
}

function formatGregorianLong(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatHijriLong(date) {
  const hijri = gregorianToHijriIntl(date, "en", "islamic-umalqura");
  if (!hijri) return "—";
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${dayName}, ${hijri.hd} ${hijriMonthNames[hijri.hm - 1]} ${hijri.hy} AH`;
}

/********************************************************************
 * Calendar Converter UI
 ********************************************************************/
function initCalendarConverter() {
  const tabGreg = $("tabGreg");
  const tabHijri = $("tabHijri");
  const panelGreg = $("panelGreg");
  const panelHijri = $("panelHijri");

  if (!tabGreg || !tabHijri) return;

  // Populate Hijri month dropdown
  const monthSelect = $("convHijriMonth");
  hijriMonthNames.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx + 1);
    opt.textContent = `${idx + 1} - ${name}`;
    monthSelect.appendChild(opt);
  });

  // Set default Hijri year to current
  const todayHijri = gregorianToHijriIntl(new Date(), "en", "islamic-umalqura");
  if (todayHijri) {
    $("convHijriYear").value = todayHijri.hy;
    $("convHijriMonth").value = todayHijri.hm;
    $("convHijriDay").value = todayHijri.hd;
  }

  // Tab switching
  tabGreg.addEventListener("click", () => {
    tabGreg.classList.add("active");
    tabHijri.classList.remove("active");
    panelGreg.classList.remove("hidden");
    panelHijri.classList.add("hidden");
  });

  tabHijri.addEventListener("click", () => {
    tabHijri.classList.add("active");
    tabGreg.classList.remove("active");
    panelHijri.classList.remove("hidden");
    panelGreg.classList.add("hidden");
  });

  // Gregorian -> Hijri
  const gregInput = $("convGregDate");
  const gregResult = $("convGregHijri");

  // Set today as default
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  gregInput.value = `${yyyy}-${mm}-${dd}`;

  function convertGregToHijri() {
    const val = gregInput.value;
    if (!val) {
      gregResult.textContent = "—";
      return;
    }
    const date = new Date(val + "T12:00:00");
    if (Number.isNaN(date.getTime())) {
      gregResult.textContent = "Invalid date";
      return;
    }
    gregResult.textContent = formatHijriLong(date);
  }

  gregInput.addEventListener("change", convertGregToHijri);
  gregInput.addEventListener("input", convertGregToHijri);

  $("convGregToday").addEventListener("click", () => {
    const t = new Date();
    gregInput.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    convertGregToHijri();
  });

  // Initial conversion
  convertGregToHijri();

  // Hijri -> Gregorian
  const hijriDay = $("convHijriDay");
  const hijriMonth = $("convHijriMonth");
  const hijriYear = $("convHijriYear");
  const hijriResult = $("convHijriGreg");

  function convertHijriToGreg() {
    const hd = parseInt(hijriDay.value, 10);
    const hm = parseInt(hijriMonth.value, 10);
    const hy = parseInt(hijriYear.value, 10);

    if (!Number.isFinite(hd) || !Number.isFinite(hm) || !Number.isFinite(hy)) {
      hijriResult.textContent = "—";
      return;
    }

    if (hd < 1 || hd > 30 || hm < 1 || hm > 12 || hy < 1) {
      hijriResult.textContent = "Invalid date";
      return;
    }

    hijriResult.textContent = "Converting...";

    // Use setTimeout to avoid blocking UI during search
    setTimeout(() => {
      const greg = hijriToGregorian(hy, hm, hd);
      if (greg) {
        hijriResult.textContent = formatGregorianLong(greg);
      } else {
        hijriResult.textContent = "Date not found";
      }
    }, 10);
  }

  hijriDay.addEventListener("change", convertHijriToGreg);
  hijriMonth.addEventListener("change", convertHijriToGreg);
  hijriYear.addEventListener("change", convertHijriToGreg);

  // Initial conversion
  convertHijriToGreg();
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
  const methodSel = $("method");
  methodSel.innerHTML = methods
    .map((m) => `<option value="${m.id}">${m.label}</option>`)
    .join("");

  const now = new Date();
  $("tz").value = String(-now.getTimezoneOffset() / 60);
}

let citySearchTimeout = null;

async function searchCity(query) {
  const dropdown = $("cityDropdown");
  
  if (!query || query.length < 2) {
    dropdown.classList.remove("active");
    return;
  }

  dropdown.classList.add("active");
  dropdown.innerHTML = '<div class="city-dropdown-loading">Searching...</div>';

  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8`
    );

    if (!response.ok) throw new Error("API error");

    const data = await response.json();
    const features = data.features || [];

    if (!features.length) {
      dropdown.innerHTML = '<div class="city-dropdown-empty">No cities found</div>';
      return;
    }

    dropdown.innerHTML = features
      .map((f) => {
        const p    = f.properties;
        const name = p.name || p.city || p.town || p.village || "Unknown";
        const sub  = [p.state, p.country].filter(Boolean).join(", ");
        const lat  = f.geometry.coordinates[1];
        const lng  = f.geometry.coordinates[0];
        return `<div class="city-dropdown-item" data-lat="${lat}" data-lng="${lng}" data-name="${name}">
          <div class="name">${name}</div>
          <div class="country">${sub}</div>
          <div class="coords">${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}</div>
        </div>`;
      })
      .join("");
  } catch (_error) {
    dropdown.innerHTML = '<div class="city-dropdown-error">Search failed. Try again.</div>';
  }
}

function setupCitySearch() {
  const searchInput = $("citySearch");
  const dropdown = $("cityDropdown");

  searchInput.addEventListener("input", (e) => {
    clearTimeout(citySearchTimeout);
    citySearchTimeout = setTimeout(() => {
      searchCity(e.target.value);
    }, 300);
  });

  searchInput.addEventListener("focus", () => {
    if (searchInput.value.length >= 2) {
      dropdown.classList.add("active");
    }
  });

  function selectCity(item) {
    $("lat").value = item.dataset.lat;
    $("lng").value = item.dataset.lng;
    searchInput.value = item.dataset.name;
    dropdown.classList.remove("active");
    saveSettings();
    regenerate();
  }

  // touchstart fires before scroll cancellation and before blur — most reliable on mobile
  dropdown.addEventListener("touchstart", (e) => {
    const item = e.target.closest(".city-dropdown-item");
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      selectCity(item);
    }
  }, { passive: false });

  // mousedown for desktop — fires before blur
  dropdown.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const item = e.target.closest(".city-dropdown-item");
    if (item) selectCity(item);
  });

  // Close on outside tap or click
  document.addEventListener("touchstart", (e) => {
    if (!e.target.closest(".city-search-chip")) {
      dropdown.classList.remove("active");
    }
  }, { passive: true });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".city-search-chip")) {
      dropdown.classList.remove("active");
    }
  });
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(settingsKey);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function saveSettings() {
  const settings = {
    city: $("citySearch").value,
    lat: $("lat").value,
    lng: $("lng").value,
    method: $("method").value,
    tz: $("tz").value,
    start: $("start").value,
    days: $("days").value,
  };
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

async function geolocateUser(locateBtn) {
  if (!navigator.geolocation) return;
  if (locateBtn) locateBtn.classList.add("locating");

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude.toFixed(4);
      const lng = pos.coords.longitude.toFixed(4);
      $("lat").value = lat;
      $("lng").value = lng;
      $("tz").value = -(new Date().getTimezoneOffset()) / 60;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          { headers: { "User-Agent": "AdhanTimings/1.0" } }
        );
        if (res.ok) {
          const data = await res.json();
          const city = data.address.city || data.address.town || data.address.village || data.address.state || "";
          $("citySearch").value = city;
        }
      } catch {
        if (locateBtn) $("citySearch").value = "My Location";
      }

      if (locateBtn) locateBtn.classList.remove("locating");
      saveSettings();
      regenerate();
    },
    () => {
      if (locateBtn) locateBtn.classList.remove("locating");
    },
    { enableHighAccuracy: !!locateBtn, timeout: 10000 }
  );
}

function applySettings() {
  const settings = loadSettings();
  if (settings) {
    if (settings.city) $("citySearch").value = settings.city;
    if (settings.lat) $("lat").value = settings.lat;
    if (settings.lng) $("lng").value = settings.lng;
    if (settings.method) $("method").value = settings.method;
    if (settings.tz) $("tz").value = settings.tz;
    if (settings.start) $("start").value = settings.start;
    if (settings.days) $("days").value = settings.days;
  } else {
    // First visit: default to Makkah, then silently detect location
    $("citySearch").value = "Makkah";
    $("lat").value = 21.3891;
    $("lng").value = 39.8579;
    $("method").value = String(PrayTime.Makkah);
    geolocateUser(null);
  }
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
  head.className = "row row--head";
  head.setAttribute("role", "row");
  head.innerHTML = `
    <div class="cell headcell" role="columnheader">${t("col.date")}</div>
    <div class="cell headcell" role="columnheader">${t("col.fajr")}</div>
    <div class="cell headcell col-sunrise" role="columnheader">${t("col.sunrise")}</div>
    <div class="cell headcell" role="columnheader">${t("col.dhuhr")}</div>
    <div class="cell headcell" role="columnheader">${t("col.asr")}</div>
    <div class="cell headcell" role="columnheader">${t("col.maghrib")}</div>
    <div class="cell headcell" role="columnheader">${t("col.isha")}</div>
  `;
  host.appendChild(head);

  const now = new Date();

  let i = 0;
  for (const r of rows) {
    const isToday = sameDay(r.date, now);
    const badge = isToday
      ? `<span class="badge today">${t("badge.today")}</span>`
      : `<span class="badge">${r.date.toLocaleDateString(undefined, {
          weekday: "short",
        })}</span>`;

    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("role", "row");
    if (isToday) row.classList.add("today-row");
    if (i % 2 === 1) row.classList.add("row--alt");

    row.innerHTML = `
      <div class="cell" role="cell">
        <div class="datecell">
          <span>${fmtDateLong(r.date)}</span>
          ${badge}
        </div>
      </div>
      <div class="cell mono" role="cell" aria-label="Fajr ${r.times.Fajr}">${r.times.Fajr}</div>
      <div class="cell mono col-sunrise" role="cell" aria-label="Sunrise ${r.times.Sunrise}">${r.times.Sunrise}</div>
      <div class="cell mono" role="cell" aria-label="Dhuhr ${r.times.Dhuhr}">${r.times.Dhuhr}</div>
      <div class="cell mono" role="cell" aria-label="Asr ${r.times.Asr}">${r.times.Asr}</div>
      <div class="cell mono" role="cell" aria-label="Maghrib ${r.times.Maghrib}" style="font-weight:800">${r.times.Maghrib}</div>
      <div class="cell mono" role="cell" aria-label="Isha ${r.times.Isha}">${r.times.Isha}</div>
    `;
    host.appendChild(row);
    i++;
  }

  // Auto-scroll to today row
  const todayRow = host.querySelector(".today-row");
  if (todayRow) {
    todayRow.scrollIntoView({ behavior: "smooth", block: "center" });
  }
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
    updateNowLine();
    const now = new Date();
    const diffMs = targetDate - now;

    if (diffMs <= 0) {
      cdH.textContent = "00";
      cdM.textContent = "00";
      cdS.textContent = "00";
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = null;
      playAdhanTone();
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
      return { key: p.key, name: p.label, time: String(t), date: d };
    }
  }

  // After Isha: next target is tomorrow's Fajr.
  const tomorrowMap = getPrayerTimesMapForDate(pt, tomorrow, lat, lng, tz);
  const t = tomorrowMap.Fajr;
  const d = parseHHMMToDate(tomorrow, String(t));
  return { key: "Fajr", name: "Fajr", time: String(t), date: d };
}

function getCurrentPrayer(now, pt, lat, lng, tz) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const prayers = [
    { key: "Fajr", label: "Fajr" },
    { key: "Sunrise", label: "Sunrise" },
    { key: "Dhuhr", label: "Dhuhr" },
    { key: "Asr", label: "Asr" },
    { key: "Maghrib", label: "Maghrib" },
    { key: "Isha", label: "Isha" },
  ];

  const todayMap = getPrayerTimesMapForDate(pt, today, lat, lng, tz);
  const yesterdayMap = getPrayerTimesMapForDate(pt, yesterday, lat, lng, tz);

  // Check yesterday's Isha first (can extend into today early morning)
  const yesterdayIsha = yesterdayMap.Isha;
  const yesterdayIshaDate = parseHHMMToDate(yesterday, String(yesterdayIsha));
  if (
    !Number.isNaN(yesterdayIshaDate.getTime()) &&
    now >= yesterdayIshaDate &&
    now < todayMap.Fajr
  ) {
    return { key: "Isha", name: "Isha", time: String(yesterdayIsha) };
  }

  // Check today's prayers in order
  for (let i = prayers.length - 1; i >= 0; i--) {
    const p = prayers[i];
    const t = todayMap[p.key];
    const d = parseHHMMToDate(today, String(t));
    if (!Number.isNaN(d.getTime()) && now >= d) {
      return { key: p.key, name: p.label, time: String(t) };
    }
  }

  return null;
}

function updateNowLine() {
  const host = $("nowLine");
  if (!host) return;
  const tz = parseFloat($("tz").value);
  const tzLabel = Number.isFinite(tz) ? `TZ ${tz > 0 ? "+" : ""}${tz}` : "TZ —";
  const now = new Date();
  const nowStr = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  host.textContent = `Now: ${nowStr} • ${tzLabel}`;
}

function regenerate() {
  const rows = buildRows();
  // Next prayer target and dashboard values.
  const now = new Date();
  const methodID = parseInt($("method").value, 10);
  const pt = new PrayTime(methodID);
  pt.setTimeFormat(PrayTime.Time12);
  pt.setHighLatsMethod(PrayTime.MidNight);

  const latN = parseFloat($("lat").value);
  const lngN = parseFloat($("lng").value);
  const tzN = parseFloat($("tz").value);

  const next = getNextPrayerTarget(now, pt, latN, lngN, tzN);
  renderTable(rows);

  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayMap = getPrayerTimesMapForDate(pt, todayDate, latN, lngN, tzN);
  const imsakEl = $("imsakIftar");
  if (imsakEl) {
    const maghribToday = parseHHMMToDate(todayDate, String(todayMap.Maghrib));
    const showTomorrow = now >= maghribToday;
    if (showTomorrow) {
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowMap = getPrayerTimesMapForDate(pt, tomorrowDate, latN, lngN, tzN);
      const imsak = tomorrowMap.Imsak || PrayTime.InvalidTime;
      const iftar = tomorrowMap.Maghrib || PrayTime.InvalidTime;
      imsakEl.textContent = `${t("prayer.imsak")} ${imsak} | ${t("prayer.iftar")} ${iftar}`;
    } else {
      const imsak = todayMap.Imsak || PrayTime.InvalidTime;
      const iftar = todayMap.Maghrib || PrayTime.InvalidTime;
      imsakEl.textContent = `${t("prayer.imsak")} ${imsak} | ${t("prayer.iftar")} ${iftar}`;
    }
  }

  const city = $("citySearch").value;

  // Display city + method in header, and show today's Hijri date prominently.
  const todayHijri = formatHijriDate(new Date());
  const methodId = parseInt($("method").value, 10);
  const methodLabel = methods.find((m) => m.id === methodId)?.label || "";
  $("subline").textContent = `${city} • ${methodLabel}`;

  const hijriEl = $("hijriDate");
  if (hijriEl) hijriEl.textContent = todayHijri;

  $("bigLabel").textContent = `${t("label.next_prayer")}: ${t("prayer." + next.key.toLowerCase())}`;
  $("bigTime").textContent = next.time;

  const nextAt = $("nextAt");
  if (nextAt) nextAt.textContent = `${t("stat.at")} ${next.time}`;

  // Show current prayer
  const currentEl = $("currentName");
  const current = getCurrentPrayer(now, pt, latN, lngN, tzN);
  if (currentEl) {
    currentEl.textContent = current ? t("prayer." + current.key.toLowerCase()) : "—";
  }

  updateNowLine();

  startCountdown(next.date, t("prayer." + next.key.toLowerCase()));
  saveSettings();
}

/********************************************************************
 * Prayer Notifications
 ********************************************************************/
let notificationsEnabled = false;
let notificationTimer = null;
let audioEnabled = false;
let audioContext = null;
const notifiedPrayers = new Set();

function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Your browser does not support notifications.");
    return false;
  }

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") {
    alert("Notifications are blocked. Please enable them in your browser settings.");
    return false;
  }

  const result = await Notification.requestPermission();
  return result === "granted";
}

function firePrayerNotification(prayerName, prayerTime) {
  if (!canNotify()) return;

  const key = `${prayerName}-${new Date().toDateString()}`;
  if (notifiedPrayers.has(key)) return;
  notifiedPrayers.add(key);

  const notification = new Notification("Adhan Timings", {
    body: `It's time for ${prayerName} (${prayerTime})`,
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: `prayer-${prayerName}`,
    renotify: true,
  });

  notification.addEventListener("click", () => {
    window.focus();
    notification.close();
  });

  // Auto-close after 30 seconds
  setTimeout(() => notification.close(), 30000);
}

function checkPrayerNotifications() {
  if (!notificationsEnabled || !canNotify()) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const methodID = parseInt($("method").value, 10);
  const pt = new PrayTime(methodID);
  pt.setTimeFormat(PrayTime.Time12);
  pt.setHighLatsMethod(PrayTime.MidNight);

  const latN = parseFloat($("lat").value);
  const lngN = parseFloat($("lng").value);
  const tzN = parseFloat($("tz").value);

  const todayMap = getPrayerTimesMapForDate(pt, today, latN, lngN, tzN);

  const prayers = [
    { key: "Fajr", label: "Fajr" },
    { key: "Dhuhr", label: "Dhuhr" },
    { key: "Asr", label: "Asr" },
    { key: "Maghrib", label: "Maghrib" },
    { key: "Isha", label: "Isha" },
  ];

  for (const p of prayers) {
    const timeStr = String(todayMap[p.key]);
    const prayerDate = parseHHMMToDate(today, timeStr);
    if (Number.isNaN(prayerDate.getTime())) continue;

    const diffMs = prayerDate - now;
    // Fire notification if prayer is within 60 seconds (past or future)
    if (diffMs >= -60000 && diffMs <= 60000) {
      firePrayerNotification(p.label, timeStr);
    }
  }
}

function startNotificationChecker() {
  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = setInterval(checkPrayerNotifications, 30000);
  checkPrayerNotifications(); // Check immediately
}

function stopNotificationChecker() {
  if (notificationTimer) {
    clearInterval(notificationTimer);
    notificationTimer = null;
  }
}

function toggleNotifications(btn) {
  const sp = btn.querySelector("[data-i18n]");
  if (notificationsEnabled) {
    notificationsEnabled = false;
    stopNotificationChecker();
    if (sp) { sp.dataset.i18n = "btn.notify"; sp.textContent = t("btn.notify"); }
    btn.classList.remove("btn--active");
    try { localStorage.setItem("adhan-notifications", "off"); } catch { /* ignore */ }
  } else {
    requestNotificationPermission().then((granted) => {
      if (granted) {
        notificationsEnabled = true;
        startNotificationChecker();
        if (sp) { sp.dataset.i18n = "btn.notify_on"; sp.textContent = t("btn.notify_on"); }
        btn.classList.add("btn--active");
        try { localStorage.setItem("adhan-notifications", "on"); } catch { /* ignore */ }
      }
    });
  }
}

function restoreNotificationState(btn) {
  try {
    const saved = localStorage.getItem("adhan-notifications");
    if (saved === "on" && canNotify()) {
      notificationsEnabled = true;
      startNotificationChecker();
      const sp = btn.querySelector("[data-i18n]");
      if (sp) { sp.dataset.i18n = "btn.notify_on"; sp.textContent = t("btn.notify_on"); }
      btn.classList.add("btn--active");
    }
  } catch { /* ignore */ }
}

function playAdhanTone() {
  if (!audioEnabled || !audioContext) return;
  try {
    if (audioContext.state === "suspended") audioContext.resume();
    const notes = [392, 440, 523.25]; // G4, A4, C5
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = audioContext.currentTime + i * 0.6;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
      osc.start(t0);
      osc.stop(t0 + 0.56);
    });
  } catch { /* ignore */ }
}

function toggleAudio(btn) {
  const sp = btn.querySelector("[data-i18n]");
  audioEnabled = !audioEnabled;
  if (audioEnabled) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } else if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    if (sp) { sp.dataset.i18n = "btn.sound_on"; sp.textContent = t("btn.sound_on"); }
    btn.classList.add("btn--active");
    try { localStorage.setItem("adhan-audio", "on"); } catch { /* ignore */ }
    playAdhanTone(); // preview
  } else {
    if (sp) { sp.dataset.i18n = "btn.sound"; sp.textContent = t("btn.sound"); }
    btn.classList.remove("btn--active");
    try { localStorage.setItem("adhan-audio", "off"); } catch { /* ignore */ }
  }
}

function restoreAudioState(btn) {
  try {
    if (localStorage.getItem("adhan-audio") === "on") {
      audioEnabled = true;
      const sp = btn.querySelector("[data-i18n]");
      if (sp) { sp.dataset.i18n = "btn.sound_on"; sp.textContent = t("btn.sound_on"); }
      btn.classList.add("btn--active");
      // AudioContext must wait for user gesture; created lazily on first click
    }
  } catch { /* ignore */ }
}

/********************************************************************
 * Dua of the Day — 30 duas from Hisnul Muslim
 ********************************************************************/
const DUAS = [
  {
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
    transliteration: "Alhamdu lillahil-ladhi ahyana ba'da ma amatana wa ilayhin-nushur",
    translation: "All praise is for Allah who gave us life after having taken it from us, and unto Him is the resurrection.",
    source: "Bukhari 6312"
  },
  {
    arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ",
    transliteration: "Allahumma bika asbahna wa bika amsayna wa bika nahya wa bika namutu wa ilaykan-nushur",
    translation: "O Allah, by You we enter the morning, and by You we enter the evening, by You we live and by You we die, and to You is the resurrection.",
    source: "Abu Dawud 5068 / Tirmidhi 3391"
  },
  {
    arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
    transliteration: "A'udhu bikalimati-llahit-tammati min sharri ma khalaq",
    translation: "I seek refuge in the perfect words of Allah from the evil of what He has created.",
    source: "Muslim 2708"
  },
  {
    arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
    transliteration: "Bismillahil-ladhi la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i wa huwas-sami'ul-'alim",
    translation: "In the name of Allah, with Whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing.",
    source: "Abu Dawud 5088 / Tirmidhi 3388"
  },
  {
    arabic: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    transliteration: "Allahumma anta rabbi la ilaha illa anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mastata'tu, a'udhu bika min sharri ma sana'tu, abu'u laka bini'matika 'alayya, wa abu'u bidhanbī, faghfir li fa'innahu la yaghfirudh-dhunuba illa ant",
    translation: "O Allah, You are my Lord. There is no god but You. You created me and I am Your servant, and I am faithful to my covenant and my promise to You as much as I am able. I seek refuge in You from the evil I have done. I acknowledge Your blessing upon me and I confess my sin, so forgive me, for none forgives sins but You.",
    source: "Bukhari 6306 (Sayyidul Istighfar)"
  },
  {
    arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    transliteration: "Subhanallahi wa bihamdih",
    translation: "Glory be to Allah and praise Him.",
    source: "Bukhari 6405 (100×)"
  },
  {
    arabic: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
    transliteration: "Allahumma salli wa sallim 'ala nabiyyina Muhammad",
    translation: "O Allah, bestow Your prayers and peace upon our Prophet Muhammad.",
    source: "General sunnah"
  },
  {
    arabic: "رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ",
    transliteration: "Rabbighfir li wa liwalidayya",
    translation: "My Lord, forgive me and my parents.",
    source: "Quran 71:28"
  },
  {
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
    translation: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
    source: "Quran 2:201"
  },
  {
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ",
    transliteration: "Allahumma inni as'alukal-'afiyata fid-dunya wal-akhirah",
    translation: "O Allah, I ask You for well-being in this world and the Hereafter.",
    source: "Ibn Majah 3871"
  },
  {
    arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ وَأَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ",
    transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazani wa a'udhu bika minal-'ajzi wal-kasal",
    translation: "O Allah, I seek refuge in You from worry and grief, and I seek refuge in You from incapacity and laziness.",
    source: "Bukhari 6369"
  },
  {
    arabic: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    transliteration: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir",
    translation: "There is no god but Allah, alone, without partner. His is the dominion and His is the praise, and He is over all things powerful.",
    source: "Bukhari 6403 (100×)"
  },
  {
    arabic: "سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ",
    transliteration: "Subhanallahi wal-hamdu lillahi wa la ilaha illallahu wallahu akbar",
    translation: "Glory be to Allah, all praise be to Allah, there is no god but Allah, and Allah is the Greatest.",
    source: "Muslim 2695"
  },
  {
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا طَيِّبًا وَعَمَلًا مُتَقَبَّلًا",
    transliteration: "Allahumma inni as'aluka 'ilman nafi'an wa rizqan tayyiban wa 'amalan mutaqabbala",
    translation: "O Allah, I ask You for beneficial knowledge, wholesome provision, and accepted deeds.",
    source: "Ibn Majah 925"
  },
  {
    arabic: "رَبِّ زِدْنِي عِلْمًا",
    transliteration: "Rabbi zidni 'ilma",
    translation: "My Lord, increase me in knowledge.",
    source: "Quran 20:114"
  },
  {
    arabic: "اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي",
    transliteration: "Allahummah-dini wa saddidni",
    translation: "O Allah, guide me and make me upright.",
    source: "Muslim 2725"
  },
  {
    arabic: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
    transliteration: "Hasbiyallahu la ilaha illa huwa, 'alayhi tawakkaltu wa huwa rabbul-'arshil-'azim",
    translation: "Allah is sufficient for me. There is no god but Him. I have put my trust in Him, and He is the Lord of the Mighty Throne.",
    source: "Abu Dawud 5081 (7×)"
  },
  {
    arabic: "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ",
    transliteration: "Allahummak-fini bihalалika 'an haramika wa aghnini bifadlika 'amman siwak",
    translation: "O Allah, suffice me with what You have made lawful against what You have made unlawful, and enrich me with Your bounty from dependence on anyone other than You.",
    source: "Tirmidhi 3563"
  },
  {
    arabic: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ",
    transliteration: "Ya Hayyu ya Qayyumu birahmatika astaghith",
    translation: "O Ever-Living, O Sustainer of all existence, by Your mercy I seek help.",
    source: "Tirmidhi 3524"
  },
  {
    arabic: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    transliteration: "La ilaha illa anta subhanaka inni kuntu minaz-zalimin",
    translation: "There is no god but You, glory be to You, indeed I have been of the wrongdoers.",
    source: "Quran 21:87 (Dua of Yunus ﷺ)"
  },
  {
    arabic: "رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ",
    transliteration: "Rabbi inni lima anzalta ilayya min khayrin faqir",
    translation: "My Lord, I am in absolute need of the good You send me.",
    source: "Quran 28:24 (Dua of Musa ﷺ)"
  },
  {
    arabic: "اللَّهُمَّ أَصْلِحْ لِي دِينِيَ الَّذِي هُوَ عِصْمَةُ أَمْرِي وَأَصْلِحْ لِي دُنْيَايَ الَّتِي فِيهَا مَعَاشِي",
    transliteration: "Allahumma aslih li dini alladhi huwa 'ismatu amri, wa aslih li dunyaya allati fiha ma'ashi",
    translation: "O Allah, set right for me my religious commitment which is the safeguard of my affair, and set right for me my worldly affairs wherein is my livelihood.",
    source: "Muslim 2720"
  },
  {
    arabic: "اللَّهُمَّ مُصَرِّفَ الْقُلُوبِ صَرِّفْ قُلُوبَنَا عَلَى طَاعَتِكَ",
    transliteration: "Allahumma musarrifal-qulub, sarrif qulubana 'ala ta'atik",
    translation: "O Allah, Controller of the hearts, direct our hearts to Your obedience.",
    source: "Muslim 2654"
  },
  {
    arabic: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً",
    transliteration: "Rabbana la tuzigh qulubana ba'da idh hadaytana wa hab lana milladunka rahmah",
    translation: "Our Lord, do not let our hearts deviate after You have guided us, and grant us from Yourself mercy.",
    source: "Quran 3:8"
  },
  {
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَأَعُوذُ بِكَ مِنَ النَّارِ",
    transliteration: "Allahumma inni as'alukal-jannata wa a'udhu bika minan-nar",
    translation: "O Allah, I ask You for Paradise and I seek refuge in You from the Fire.",
    source: "Abu Dawud 792"
  },
  {
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الثَّبَاتَ فِي الْأَمْرِ وَأَسْأَلُكَ عَزِيمَةَ الرُّشْدِ",
    transliteration: "Allahumma inni as'alukat-thabata fil-amr, wa as'aluka 'azimatar-rushd",
    translation: "O Allah, I ask You for steadfastness in all my affairs, and I ask You for the determination to be rightly guided.",
    source: "Nasa'i 1304"
  },
  {
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ حُبَّكَ وَحُبَّ مَنْ يُحِبُّكَ وَحُبَّ عَمَلٍ يُقَرِّبُنِي إِلَى حُبِّكَ",
    transliteration: "Allahumma inni as'aluka hubbaka wa hubba man yuhibbuka wa hubba 'amalin yuqarribuni ila hubbik",
    translation: "O Allah, I ask You for Your love, and the love of those who love You, and the love of deeds that will bring me closer to Your love.",
    source: "Tirmidhi 3490"
  },
  {
    arabic: "رَبِّ أَعِنِّي وَلَا تُعِنْ عَلَيَّ وَانْصُرْنِي وَلَا تَنْصُرْ عَلَيَّ",
    transliteration: "Rabbi a'inni wa la tu'in 'alayya, wansurni wa la tansur 'alayya",
    translation: "My Lord, help me and do not help against me, grant me victory and do not grant victory over me.",
    source: "Abu Dawud 1510 / Tirmidhi 3551"
  },
  {
    arabic: "اللَّهُمَّ بَارِكْ لَنَا فِي رَجَبٍ وَشَعْبَانَ وَبَلِّغْنَا رَمَضَانَ",
    transliteration: "Allahumma barik lana fi Rajaba wa Sha'bana wa ballighna Ramadan",
    translation: "O Allah, bless us in Rajab and Sha'ban and bring us to Ramadan.",
    source: "Ahmad 2346"
  },
  {
    arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْبُخْلِ وَأَعُوذُ بِكَ مِنَ الْجُبْنِ",
    transliteration: "Allahumma inni a'udhu bika minal-bukhli wa a'udhu bika minal-jubn",
    translation: "O Allah, I seek refuge in You from miserliness, and I seek refuge in You from cowardice.",
    source: "Bukhari 2822"
  },
];

/********************************************************************
 * Language / i18n
 ********************************************************************/
const TRANSLATIONS = {
  en: {
    "tab.prayer": "Prayer Times", "tab.articles": "Articles", "tab.books": "Books",
    "tab.apps": "Islamic Apps", "tab.zakat": "Zakat", "tab.contact": "Contact",
    "apps.subtitle": `A curated collection of Islamic apps and tools from <a href="https://nuqayah.com/projects" target="_blank" rel="noopener">nuqayah.com</a>.`,
    "chip.method": "Method", "chip.tz": "TZ", "chip.hrs": "hrs",
    "chip.lat": "Lat", "chip.lng": "Lng", "chip.days": "Days",
    "btn.today": "Today", "btn.copy": "Copy", "btn.share": "Share",
    "btn.dark": "Dark", "btn.light": "Light", "btn.advanced": "Advanced Settings", "btn.hide_advanced": "Hide Advanced Settings",
    "btn.notify": "Notify", "btn.notify_on": "Notifying",
    "btn.sound": "Sound", "btn.sound_on": "Sound On",
    "btn.ics": "Download .ics",
    "search.placeholder": "Search city...",
    "col.date": "Date", "col.fajr": "Fajr", "col.sunrise": "Sunrise",
    "col.dhuhr": "Dhuhr", "col.asr": "Asr", "col.maghrib": "Maghrib", "col.isha": "Isha",
    "badge.today": "Today",
    "stat.current": "Current", "stat.hours": "Hours", "stat.minutes": "Minutes",
    "stat.seconds": "Seconds", "stat.at": "at",
    "label.next_prayer": "Next Prayer",
    "prayer.fajr": "Fajr", "prayer.sunrise": "Sunrise", "prayer.dhuhr": "Dhuhr",
    "prayer.asr": "Asr", "prayer.maghrib": "Maghrib", "prayer.isha": "Isha",
    "prayer.imsak": "Imsak", "prayer.iftar": "Iftar", "prayer.midnight": "Midnight",
    "sidebar.qibla": "Qibla Direction", "qibla.placeholder": "Set your location to see the Qibla direction.",
    "sidebar.islamqa": "Islamic Q&A", "sidebar.islamqa.placeholder": "Search IslamQA…",
    "sidebar.ayah": "Daily Ayah", "sidebar.dua": "Dua of the Day", "sidebar.calendar": "Calendar Converter",
    "calendar.greg.tab": "Gregorian → Hijri", "calendar.hijri.tab": "Hijri → Gregorian",
    "calendar.greg.label": "Gregorian Date", "calendar.today": "Today",
    "calendar.hijri.result": "Hijri Date",
    "lang.label": "العربية",
    "gold.fetching": "Fetching live price…",
    "gold.live": "Live price · goldapi.io",
    "gold.error": "Could not fetch — enter manually",
    "zakat.empty": "Enter your wealth details above to calculate your Zakat obligation.",
    "zakat.liable": "Your net wealth of {net} exceeds the Nisab. You are obligated to pay Zakat this year.",
    "zakat.exempt": "Your net wealth of {net} is below the Nisab threshold of {nisab}. Zakat is not obligatory for you this year.",
    "zakat.amount.label": "Your Zakat due (2.5%)",
    "zakat.title": "Zakat Calculator",
    "zakat.subtitle": "Enter your assets and liabilities below. Zakat is 2.5% of your net zakatable wealth if it meets or exceeds the Nisab threshold for a full lunar year (Hawl).",
    "zakat.label.currency": "Currency",
    "zakat.label.goldprice": "Gold price / gram",
    "zakat.nisab.label": "Nisab (85g gold)",
    "zakat.section.assets": "Assets",
    "zakat.row.cash": "Cash & Bank Savings",
    "zakat.row.gold": "Gold & Silver (market value)",
    "zakat.row.investments": "Investments & Stocks",
    "zakat.row.business": "Business Inventory",
    "zakat.row.receivables": "Money Owed to You",
    "zakat.row.other": "Other Zakatable Assets",
    "zakat.section.liabilities": "Liabilities",
    "zakat.row.debts": "Outstanding Debts",
    "zakat.row.expenses": "Bills & Expenses Due",
    "zakat.row.bizliab": "Business Liabilities",
    "zakat.result.assets": "Total Assets",
    "zakat.result.liabilities": "Total Liabilities",
    "zakat.result.net": "Net Zakatable Wealth",
    "zakat.result.nisab": "Nisab Threshold",
    "disclaimer.articles": `All articles displayed here are the intellectual property of <a href="https://islamqa.info" target="_blank" rel="noopener">islamqa.info</a>. Adhan Timings does not claim ownership of, nor hold any copyright over, any of the content listed below. This content is presented solely for convenience and ease of access. Please visit islamqa.info directly to support their work.`,
    "disclaimer.books": `All books displayed here are the intellectual property of <a href="https://islamqa.info" target="_blank" rel="noopener">islamqa.info</a> and their respective authors. Adhan Timings does not claim ownership of, nor hold any copyright over, any of the content listed below. This content is presented solely for convenience and ease of access. Please visit islamqa.info directly to support their work.`,
    "faq.heading": "Frequently Asked Questions",
    "faq.q1": "What is Zakat?",
    "faq.a1": `<p>Zakat (زكاة) is the third pillar of Islam — a mandatory annual act of worship through wealth. The word means both <em>purification</em> and <em>growth</em>. By giving Zakat, a Muslim purifies the remainder of their wealth and contributes to the welfare of the broader community. It is mentioned alongside Salah over 80 times in the Quran, reflecting its fundamental importance in the faith.</p>`,
    "faq.q2": "Who is obligated to pay Zakat?",
    "faq.a2": `<p>Zakat is obligatory upon every Muslim who is: <strong>an adult</strong>, <strong>of sound mind</strong>, and <strong>in possession of wealth equal to or above the Nisab</strong> for a complete lunar year (Hawl). It does not apply to non-Muslims, children, or those whose wealth falls below the Nisab threshold.</p>`,
    "faq.q3": "What is Nisab?",
    "faq.a3": `<p>Nisab is the minimum threshold of wealth that must be owned before Zakat becomes obligatory. There are two standards: <strong>Gold Nisab</strong> — equivalent to 85 grams of gold, and <strong>Silver Nisab</strong> — equivalent to 595 grams of silver. Most contemporary scholars recommend using the gold standard as it is more conservative. Enter your local gold price per gram above and the calculator will compute the Nisab automatically.</p>`,
    "faq.q4": "What is Hawl (the lunar year condition)?",
    "faq.a4": `<p>Hawl refers to the condition that wealth must remain at or above the Nisab for a complete Islamic (lunar) year — approximately 354 days — before Zakat is due. If your wealth drops below Nisab at any point during the year, the clock resets. It is common practice to set a personal Zakat date (e.g. the beginning of Ramadan) and assess your wealth annually on that date.</p>`,
    "faq.q5": "What is the Zakat rate?",
    "faq.a5": `<p>The standard Zakat rate is <strong>2.5%</strong> of your total net zakatable wealth (assets minus liabilities). This applies to cash, gold, silver, trade goods, and investments. Different rates apply to agricultural produce and livestock, which follow their own specific rulings.</p>`,
    "faq.q6": "Which types of wealth require Zakat?",
    "faq.a6": `<ul><li><strong>Cash:</strong> savings accounts, current accounts, foreign currencies held</li><li><strong>Gold &amp; Silver:</strong> in any form — jewelry, bullion, coins, or investments</li><li><strong>Business inventory:</strong> goods held for trade at market value</li><li><strong>Investments:</strong> stocks and shares based on their zakatable portion</li><li><strong>Receivables:</strong> money owed to you that you expect to be repaid</li><li><strong>Agricultural produce &amp; livestock:</strong> subject to separate detailed rulings</li></ul>`,
    "faq.q7": "What wealth is exempt from Zakat?",
    "faq.a7": `<ul><li>Your primary home and personal residence</li><li>Personal vehicle used for daily commuting</li><li>Clothing, furniture, and personal possessions</li><li>Tools and equipment used for your profession</li><li>Debts owed by others that are unlikely to be repaid</li></ul><p>These items are considered personal needs and are not subject to Zakat.</p>`,
    "faq.q8": "Who can receive Zakat?",
    "faq.a8": `<p>The Quran (9:60) specifies eight categories of Zakat recipients:</p><ol><li><strong>Al-Fuqara</strong> — the poor who lack basic necessities</li><li><strong>Al-Masakin</strong> — the needy who are in financial hardship</li><li><strong>Al-Amileen</strong> — administrators collecting and distributing Zakat</li><li><strong>Al-Mu'allafatu Qulubuhum</strong> — those whose hearts are being reconciled</li><li><strong>Fir-Riqab</strong> — those in bondage or captivity</li><li><strong>Al-Gharimeen</strong> — those overwhelmed by debt</li><li><strong>Fi Sabilillah</strong> — those striving in the cause of Allah</li><li><strong>Ibnus-Sabil</strong> — stranded travellers in genuine need</li></ol>`,
    "faq.q9": "Can I pay Zakat to my family members?",
    "faq.a9": `<p>Zakat <strong>cannot</strong> be given to your direct ascendants (parents, grandparents), direct descendants (children, grandchildren), or your spouse, as you are already financially responsible for them. However, it <strong>can</strong> be given to brothers, sisters, aunts, uncles, cousins, and other relatives who are genuinely in need — and doing so carries double reward: once for Zakat and once for maintaining family ties (Silat al-Rahim).</p>`,
    "faq.q10": "What is the difference between Zakat and Sadaqah?",
    "faq.a10": `<p><strong>Zakat</strong> is a mandatory (fard) pillar of Islam with strict rules regarding eligibility, calculation, and qualified recipients. Refusing to pay Zakat is a major sin. <strong>Sadaqah</strong> is voluntary charity that can be given at any time, in any amount, to any person or cause. Both are acts of worship, but Sadaqah is far broader — even a smile or a kind word is considered Sadaqah in Islam.</p>`,
    "faq.q11": "Can Zakat be paid in installments?",
    "faq.a11": `<p>Yes. Zakat may be paid in installments throughout the year as long as the full calculated amount is fulfilled by the end of the Hawl. Many Muslims choose to pay a portion monthly for ease of planning. It is also permissible to pay Zakat in advance before the Hawl is complete, particularly during Ramadan to maximise reward.</p>`,
    "faq.q12": "What if I missed paying Zakat in previous years?",
    "faq.a12": `<p>If you were eligible to pay Zakat in previous years but did not, the unpaid Zakat remains a debt upon you and must be calculated and paid for each outstanding year. Scholars advise estimating the wealth you held during those years as best you can, calculating 2.5% for each eligible year, and paying it immediately. It is also recommended to make sincere repentance (Tawbah) to Allah.</p>`,
    "contact.heading": "We'd Love to Hear From You",
    "contact.body1": "Adhan Timings is a community-driven tool built with the intention of making Islamic prayer times accessible and beautiful for everyone, everywhere. Your feedback is invaluable in helping us grow and improve.",
    "contact.body2": "Do you have a suggestion for a new feature? Perhaps a calculation method we're missing, a city that isn't resolving correctly, or an idea that would make your daily prayer routine easier? We want to know. Every message is read personally and taken seriously — no request is too small.",
    "contact.body3": "If you've encountered a bug, noticed incorrect prayer times for your location, or simply want to share how this app has helped you, please reach out. Your experience matters, and together we can make Adhan Timings better for the entire Muslim community.",
    "contact.highlight1": "Feature requests",
    "contact.highlight2": "Bug reports",
    "contact.highlight3": "General feedback",
    "contact.label.name": "Your Name",
    "contact.label.email": "Your Email",
    "contact.label.subject": "Subject",
    "contact.label.message": "Message",
    "contact.ph.name": "e.g. Abdullah Al-Farsi",
    "contact.ph.subject": "e.g. Suggestion for Hanafi Asr method",
    "contact.ph.message": "Share your thoughts, suggestions, or report an issue…",
    "contact.note": "Your message will open in your default email client addressed to us directly.",
    "contact.submit": "Send Message",
  },
  ar: {
    "tab.prayer": "أوقات الصلاة", "tab.articles": "مقالات", "tab.books": "كتب",
    "tab.apps": "تطبيقات إسلامية", "tab.zakat": "الزكاة", "tab.contact": "تواصل معنا",
    "apps.subtitle": `مجموعة مختارة من التطبيقات والأدوات الإسلامية من <a href="https://nuqayah.com/projects" target="_blank" rel="noopener">nuqayah.com</a>.`,
    "chip.method": "الطريقة", "chip.tz": "التوقيت", "chip.hrs": "س",
    "chip.lat": "خط العرض", "chip.lng": "خط الطول", "chip.days": "أيام",
    "btn.today": "اليوم", "btn.copy": "نسخ", "btn.share": "مشاركة",
    "btn.dark": "مظلم", "btn.light": "مضيء", "btn.advanced": "إعدادات متقدمة", "btn.hide_advanced": "إخفاء الإعدادات المتقدمة",
    "btn.notify": "تنبيهات", "btn.notify_on": "مفعّل",
    "btn.sound": "صوت", "btn.sound_on": "صوت مفعّل",
    "btn.ics": "تحميل .ics",
    "search.placeholder": "ابحث عن مدينة...",
    "col.date": "التاريخ", "col.fajr": "الفجر", "col.sunrise": "الشروق",
    "col.dhuhr": "الظهر", "col.asr": "العصر", "col.maghrib": "المغرب", "col.isha": "العشاء",
    "badge.today": "اليوم",
    "stat.current": "الحالي", "stat.hours": "ساعات", "stat.minutes": "دقائق",
    "stat.seconds": "ثوانٍ", "stat.at": "في",
    "label.next_prayer": "الصلاة القادمة",
    "prayer.fajr": "الفجر", "prayer.sunrise": "الشروق", "prayer.dhuhr": "الظهر",
    "prayer.asr": "العصر", "prayer.maghrib": "المغرب", "prayer.isha": "العشاء",
    "prayer.imsak": "الإمساك", "prayer.iftar": "الإفطار", "prayer.midnight": "منتصف الليل",
    "sidebar.qibla": "اتجاه القبلة", "qibla.placeholder": "حدّد موقعك لمعرفة اتجاه القبلة.",
    "sidebar.islamqa": "أسئلة وأجوبة إسلامية", "sidebar.islamqa.placeholder": "ابحث في إسلام سؤال وجواب…",
    "sidebar.ayah": "آية اليوم", "sidebar.dua": "دعاء اليوم", "sidebar.calendar": "محوّل التقويم",
    "calendar.greg.tab": "ميلادي ← هجري", "calendar.hijri.tab": "هجري ← ميلادي",
    "calendar.greg.label": "التاريخ الميلادي", "calendar.today": "اليوم",
    "calendar.hijri.result": "التاريخ الهجري",
    "lang.label": "English",
    "gold.fetching": "جارٍ جلب السعر…",
    "gold.live": "سعر مباشر · goldapi.io",
    "gold.error": "تعذّر الجلب — أدخل يدويًا",
    "zakat.empty": "أدخل تفاصيل ثروتك أعلاه لحساب زكاتك.",
    "zakat.liable": "صافي ثروتك {net} يتجاوز النصاب. يجب عليك أداء الزكاة هذا العام.",
    "zakat.exempt": "صافي ثروتك {net} أقل من عتبة النصاب {nisab}. الزكاة غير واجبة عليك هذا العام.",
    "zakat.amount.label": "زكاتك الواجبة (2.5%)",
    "zakat.title": "حاسبة الزكاة",
    "zakat.subtitle": "أدخل أصولك والتزاماتك أدناه. الزكاة 2.5% من صافي ثروتك الزكوية إذا بلغت النصاب أو تجاوزته طوال سنة قمرية كاملة (الحَوْل).",
    "zakat.label.currency": "العملة",
    "zakat.label.goldprice": "سعر الذهب / غرام",
    "zakat.nisab.label": "النصاب (85 غرام ذهب)",
    "zakat.section.assets": "الأصول",
    "zakat.row.cash": "النقد والمدخرات البنكية",
    "zakat.row.gold": "الذهب والفضة (القيمة السوقية)",
    "zakat.row.investments": "الاستثمارات والأسهم",
    "zakat.row.business": "بضائع التجارة",
    "zakat.row.receivables": "الديون المستحقة لك",
    "zakat.row.other": "أصول زكوية أخرى",
    "zakat.section.liabilities": "الالتزامات",
    "zakat.row.debts": "الديون القائمة",
    "zakat.row.expenses": "الفواتير والمصاريف المستحقة",
    "zakat.row.bizliab": "التزامات تجارية",
    "zakat.result.assets": "إجمالي الأصول",
    "zakat.result.liabilities": "إجمالي الالتزامات",
    "zakat.result.net": "صافي الثروة الزكوية",
    "zakat.result.nisab": "عتبة النصاب",
    "disclaimer.articles": `جميع المقالات المعروضة هنا هي الملكية الفكرية لـ <a href="https://islamqa.info" target="_blank" rel="noopener">islamqa.info</a>. لا يدّعي تطبيق أوقات الأذان ملكية أي محتوى أدناه ولا يحمل أي حق مؤلف عليه. يُقدَّم هذا المحتوى للسهولة وتيسير الوصول فحسب. يُرجى زيارة islamqa.info مباشرةً لدعم عملهم.`,
    "disclaimer.books": `جميع الكتب المعروضة هنا هي الملكية الفكرية لـ <a href="https://islamqa.info" target="_blank" rel="noopener">islamqa.info</a> ومؤلفيها المعنيين. لا يدّعي تطبيق أوقات الأذان ملكية أي محتوى أدناه ولا يحمل أي حق مؤلف عليه. يُقدَّم هذا المحتوى للسهولة وتيسير الوصول فحسب. يُرجى زيارة islamqa.info مباشرةً لدعم عملهم.`,
    "faq.heading": "أسئلة متكررة",
    "faq.q1": "ما هي الزكاة؟",
    "faq.a1": `<p>الزكاة (زكاة) هي الركن الثالث من أركان الإسلام — عبادة سنوية واجبة من خلال المال. وتعني الكلمة <em>التطهير</em> و<em>النماء</em>. بأداء الزكاة يُطهِّر المسلم بقية ماله ويُسهم في رعاية المجتمع الأوسع. وقد وردت مقترنةً بالصلاة أكثر من 80 مرة في القرآن الكريم، مما يعكس أهميتها الجوهرية في الدين.</p>`,
    "faq.q2": "من يجب عليه أداء الزكاة؟",
    "faq.a2": `<p>تجب الزكاة على كل مسلم: <strong>بالغ</strong>، <strong>عاقل</strong>، <strong>يمتلك نصاباً أو يزيد عليه</strong> طوال سنة قمرية كاملة (الحَوْل). ولا تجب على غير المسلمين، ولا على الأطفال، ولا على من كان ماله دون النصاب.</p>`,
    "faq.q3": "ما هو النصاب؟",
    "faq.a3": `<p>النصاب هو الحد الأدنى من المال الذي يجب توافره حتى تجب الزكاة. وثمة معياران: <strong>نصاب الذهب</strong> — ما يعادل 85 غراماً من الذهب، و<strong>نصاب الفضة</strong> — ما يعادل 595 غراماً من الفضة. ويوصي أكثر العلماء المعاصرين باعتماد معيار الذهب لأنه أكثر تحفظاً. أدخل سعر الذهب المحلي بالغرام أعلاه وسيحسب الحاسبة النصاب تلقائياً.</p>`,
    "faq.q4": "ما هو الحَوْل (شرط السنة الهجرية)؟",
    "faq.a4": `<p>الحَوْل هو اشتراط أن يبقى المال عند النصاب أو فوقه طوال سنة إسلامية (قمرية) كاملة — نحو 354 يوماً — حتى تجب الزكاة. فإن نقص المال عن النصاب في أي وقت خلال العام، أُعيد احتساب الحَوْل من جديد. ومن الشائع أن يحدد المسلم تاريخاً سنوياً للزكاة (كبداية رمضان) ليقيّم ماله سنوياً.</p>`,
    "faq.q5": "ما نسبة الزكاة؟",
    "faq.a5": `<p>نسبة الزكاة المقررة هي <strong>2.5%</strong> من إجمالي الثروة الزكوية الصافية (الأصول ناقص الديون). وينطبق ذلك على النقود والذهب والفضة وبضائع التجارة والاستثمارات. وتُطبَّق نسب مختلفة على الزروع والمواشي وفق أحكامها الخاصة.</p>`,
    "faq.q6": "ما الأموال التي تجب فيها الزكاة؟",
    "faq.a6": `<ul><li><strong>النقود:</strong> حسابات التوفير والجارية والعملات الأجنبية</li><li><strong>الذهب والفضة:</strong> بأي صورة — مجوهرات أو سبائك أو عملات أو استثمارات</li><li><strong>بضائع التجارة:</strong> السلع المعدة للبيع بسعر السوق</li><li><strong>الاستثمارات:</strong> الأسهم والحصص بحسب الجزء الخاضع للزكاة</li><li><strong>الديون المستحقة:</strong> الأموال التي يُتوقع استردادها</li><li><strong>الزروع والمواشي:</strong> تخضع لأحكام تفصيلية خاصة</li></ul>`,
    "faq.q7": "ما الأموال المعفاة من الزكاة؟",
    "faq.a7": `<ul><li>المسكن الأساسي ومحل الإقامة الخاص</li><li>السيارة الشخصية للاستخدام اليومي</li><li>الملابس والأثاث والمقتنيات الشخصية</li><li>الأدوات والمعدات المهنية</li><li>الديون المشكوك في استردادها</li></ul><p>هذه الأموال تُعدّ من الحاجات الشخصية ولا تجب فيها الزكاة.</p>`,
    "faq.q8": "من يستحق الزكاة؟",
    "faq.a8": `<p>حدد القرآن الكريم (9:60) ثمانية أصناف من مستحقي الزكاة:</p><ol><li><strong>الفقراء</strong> — من يفتقرون إلى الضروريات الأساسية</li><li><strong>المساكين</strong> — المحتاجون المعوزون</li><li><strong>العاملون عليها</strong> — القائمون على جمع الزكاة وتوزيعها</li><li><strong>المؤلَّفة قلوبهم</strong> — من يُستألف قلبهم على الإسلام</li><li><strong>في الرقاب</strong> — لتحرير الرقيق والمكاتبين</li><li><strong>الغارمون</strong> — المثقلون بالديون</li><li><strong>في سبيل الله</strong> — الساعون في سبيل الله</li><li><strong>ابن السبيل</strong> — المسافر المنقطع في حاجة حقيقية</li></ol>`,
    "faq.q9": "هل يجوز إعطاء الزكاة للأقارب؟",
    "faq.a9": `<p><strong>لا يجوز</strong> صرف الزكاة للأصول (الآباء والأجداد) ولا للفروع (الأبناء والأحفاد) ولا للزوج/الزوجة، لأن نفقتهم واجبة على المزكّي. غير أنه <strong>يجوز</strong> إعطاؤها للإخوة والأخوات والعمات والأعمام والأقارب الذين هم في حاجة حقيقية — وفي ذلك أجران: أجر الزكاة وأجر صلة الرحم.</p>`,
    "faq.q10": "ما الفرق بين الزكاة والصدقة؟",
    "faq.a10": `<p><strong>الزكاة</strong> ركن واجب (فرض) من أركان الإسلام، لها شروط محددة في الاستحقاق والحساب والمصارف، والامتناع عنها كبيرة من الكبائر. <strong>الصدقة</strong> تطوعية تُعطى في أي وقت وبأي قدر ولأي شخص أو قضية. وكلتاهما عبادة، إلا أن الصدقة أوسع نطاقاً — حتى الابتسامة والكلمة الطيبة تُعدّان صدقة في الإسلام.</p>`,
    "faq.q11": "هل يجوز دفع الزكاة على أقساط؟",
    "faq.a11": `<p>نعم. يجوز دفع الزكاة على أقساط طوال العام ما دام المبلغ المحسوب كاملاً يُؤدَّى قبل انقضاء الحَوْل. ويؤثر كثيرون على دفع جزء منها شهرياً لسهولة التخطيط. كما يجوز تعجيل الزكاة قبل تمام الحَوْل، لا سيما في رمضان مضاعفةً للأجر.</p>`,
    "faq.q12": "ماذا لو فاتتني الزكاة في السنوات الماضية؟",
    "faq.a12": `<p>إن كنت مستحقاً لأداء الزكاة في سنوات ماضية ولم تُؤدِّها، فإن الزكاة تبقى ديناً في ذمتك يجب حسابه وأداؤه عن كل سنة ماضية. وينصح العلماء بتقدير الثروة التي كنت تمتلكها خلال تلك السنوات بقدر الإمكان، وحساب 2.5% عن كل سنة مستحقة، وأدائها فوراً. ويُستحسن كذلك التوبة الصادقة إلى الله.</p>`,
    "contact.heading": "يسعدنا التواصل معك",
    "contact.body1": "أوقات الأذان أداة مجتمعية بُنيت بنية إتاحة أوقات الصلاة الإسلامية وتجميلها للجميع في كل مكان. ملاحظاتك لا تُقدَّر بثمن في مساعدتنا على النمو والتحسن.",
    "contact.body2": "هل لديك اقتراح لميزة جديدة؟ ربما طريقة حساب نفتقر إليها، أو مدينة لا تُحلّ بشكل صحيح، أو فكرة تُيسّر روتين صلاتك اليومية؟ نودّ أن نعلم. كل رسالة تُقرأ شخصياً وتُؤخذ بجدية — لا طلب صغير في نظرنا.",
    "contact.body3": "إن صادفت خطأً، أو لاحظت أوقات صلاة غير صحيحة لموقعك، أو أردت ببساطة أن تشاركنا كيف ساعدك هذا التطبيق، يُرجى التواصل معنا. تجربتك تهمّنا، ومعاً يمكننا تحسين أوقات الأذان لصالح الأمة الإسلامية.",
    "contact.highlight1": "طلبات الميزات",
    "contact.highlight2": "الإبلاغ عن الأخطاء",
    "contact.highlight3": "ملاحظات عامة",
    "contact.label.name": "اسمك",
    "contact.label.email": "بريدك الإلكتروني",
    "contact.label.subject": "الموضوع",
    "contact.label.message": "رسالتك",
    "contact.ph.name": "مثلاً: عبدالله الفارسي",
    "contact.ph.subject": "مثلاً: اقتراح لطريقة عصر الحنفي",
    "contact.ph.message": "شاركنا أفكارك أو اقتراحاتك أو أبلغنا عن مشكلة…",
    "contact.note": "ستفتح رسالتك في برنامج البريد الإلكتروني الافتراضي لديك مرسلةً إلينا مباشرةً.",
    "contact.submit": "إرسال الرسالة",
  },
};

let currentLang = localStorage.getItem("adhan-lang") || "en";

function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("adhan-lang", lang);
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;

  const btn = $("langBtn");
  if (btn) btn.textContent = t("lang.label");

  applyI18n();

  // Reset articles/books so they re-fetch in the new language
  const articlesGrid = $("articles-grid");
  const booksGrid    = $("books-grid");
  if (articlesGrid) {
    delete articlesGrid.dataset.loaded;
    if (!document.getElementById("tab-articles").hidden) loadArticles();
  }
  if (booksGrid) {
    delete booksGrid.dataset.loaded;
    if (!document.getElementById("tab-books").hidden) loadBooks();
  }

  // Re-render dynamic content only when coordinates are available
  const themeBtn = $("themeBtn");
  if (themeBtn) updateThemeButton(themeBtn, getCurrentTheme());
  if (!isNaN(parseFloat($("lat")?.value))) updateDashboard();

  // Re-run zakat calculation to update translated verdict text
  if (zakatInitialized) calculateZakat();
}

/********************************************************************
 * Theme (Dark / Light)
 ********************************************************************/
const themeKey = "adhan-theme";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme, animate = false) {
  if (animate) {
    document.documentElement.classList.add("theme-transition");
    setTimeout(() => document.documentElement.classList.remove("theme-transition"), 350);
  }

  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f4f4f5" : "#8b5cf6");
  }
}

function getStoredTheme() {
  try {
    return localStorage.getItem(themeKey);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(themeKey, theme);
  } catch { /* ignore */ }
}

function getCurrentTheme() {
  return getStoredTheme() || "light";
}

function updateThemeButton(btn, theme) {
  const span = btn.querySelector("[data-i18n]");
  if (theme === "light") {
    btn.firstChild.textContent = "☀️ ";
    if (span) span.textContent = t("btn.light");
  } else {
    btn.firstChild.textContent = "🌙 ";
    if (span) span.textContent = t("btn.dark");
  }
}

function initTheme(btn) {
  const theme = getCurrentTheme();
  applyTheme(theme);
  updateThemeButton(btn, theme);

  // Listen for system theme changes (only applies when no stored preference)
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    if (!getStoredTheme()) {
      const newTheme = e.matches ? "light" : "dark";
      applyTheme(newTheme);
      updateThemeButton(btn, newTheme);
    }
  });
}

function toggleTheme(btn) {
  const current = getCurrentTheme();
  const next = current === "dark" ? "light" : "dark";
  storeTheme(next);
  applyTheme(next, true);
  updateThemeButton(btn, next);
}

/********************************************************************
 * Dua of the Day — render
 ********************************************************************/
function renderDua() {
  const container = $("duaContent");
  if (!container) return;
  const start = new Date(new Date().getFullYear(), 0, 1);
  const dayOfYear = Math.floor((new Date() - start) / 86400000);
  const dua = DUAS[dayOfYear % DUAS.length];
  container.innerHTML = `
    <div class="dua-arabic">${dua.arabic}</div>
    <div class="dua-transliteration">${dua.transliteration}</div>
    <div class="dua-translation">"${dua.translation}"</div>
    <div class="dua-source">${dua.source}</div>`;
}

/********************************************************************
 * .ics Calendar Export
 ********************************************************************/
function fmtIcsDate(d) {
  return d.getUTCFullYear()
    + String(d.getUTCMonth() + 1).padStart(2, "0")
    + String(d.getUTCDate()).padStart(2, "0")
    + "T"
    + String(d.getUTCHours()).padStart(2, "0")
    + String(d.getUTCMinutes()).padStart(2, "0")
    + "00Z";
}

function buildIcs() {
  const rows = buildRows();
  const city = $("citySearch").value || "Unknown Location";
  const tzOffset = parseFloat($("tz").value) || 0;
  const prayers = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Adhan Timings//Prayer Times//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Prayer Times - " + city,
  ];

  for (const row of rows) {
    for (const prayer of prayers) {
      const timeStr = row.times[prayer];
      if (!timeStr || timeStr === "-----") continue;
      const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) continue;
      let h = parseInt(m[1]), min = parseInt(m[2]);
      const ap = m[3].toUpperCase();
      if (ap === "PM" && h !== 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
      const local = new Date(row.date);
      local.setHours(h, min, 0, 0);
      const utcMs = local.getTime() - tzOffset * 3600000;
      const dtStart = fmtIcsDate(new Date(utcMs));
      const dtEnd   = fmtIcsDate(new Date(utcMs + 10 * 60000));
      lines.push(
        "BEGIN:VEVENT",
        "DTSTART:" + dtStart,
        "DTEND:" + dtEnd,
        "SUMMARY:" + prayer + " - " + city,
        "UID:" + dtStart + "-" + prayer.toLowerCase() + "@adhan-timings",
        "END:VEVENT"
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadIcs() {
  const content = buildIcs();
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const city = ($("citySearch").value || "prayer-times").replace(/\s+/g, "-").toLowerCase();
  a.href = url;
  a.download = city + "-prayer-times.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

(function init() {
  initDropdowns();
  setTodayDateInput();
  setupCitySearch();
  applySettings();
  initCalendarConverter();

  // Language toggle
  const langBtn = $("langBtn");
  if (langBtn) {
    // Apply saved language on load
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = currentLang;
    langBtn.textContent = t("lang.label");
    applyI18n();
    langBtn.addEventListener("click", () => setLanguage(currentLang === "en" ? "ar" : "en"));
  }

  // Theme toggle
  const themeBtn = $("themeBtn");
  initTheme(themeBtn);
  themeBtn.addEventListener("click", () => toggleTheme(themeBtn));

  // Notification toggle
  const notifBtn = $("notifBtn");
  if (notifBtn) {
    restoreNotificationState(notifBtn);
    notifBtn.addEventListener("click", () => toggleNotifications(notifBtn));
  }

  // Audio toggle
  const audioBtn = $("audioBtn");
  if (audioBtn) {
    restoreAudioState(audioBtn);
    audioBtn.addEventListener("click", () => {
      if (!audioContext && audioEnabled) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      toggleAudio(audioBtn);
    });
  }


  $("method").addEventListener("change", () => {
    saveSettings();
    regenerate();
  });
  $("days").addEventListener("change", () => {
    saveSettings();
    regenerate();
  });
  $("start").addEventListener("change", () => {
    saveSettings();
    regenerate();
  });
  $("lat").addEventListener("change", () => {
    saveSettings();
    regenerate();
  });
  $("lng").addEventListener("change", () => {
    saveSettings();
    regenerate();
  });
  $("tz").addEventListener("change", () => {
    saveSettings();
    regenerate();
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ignore if typing in an input
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "SELECT" ||
      e.target.tagName === "TEXTAREA"
    )
      return;

    const startInput = $("start");
    const current = startInput.value ? new Date(startInput.value + "T00:00:00") : new Date();

    if (e.key === "t" || e.key === "T") {
      e.preventDefault();
      setTodayDateInput();
      saveSettings();
      regenerate();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      current.setDate(current.getDate() - 1);
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      startInput.value = `${yyyy}-${mm}-${dd}`;
      saveSettings();
      regenerate();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      current.setDate(current.getDate() + 1);
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      startInput.value = `${yyyy}-${mm}-${dd}`;
      saveSettings();
      regenerate();
    } else if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      toggleTheme(themeBtn);
    }
  });


  // Toggle advanced settings
  const toggleAdvanced = $("toggleAdvanced");
  const chipMethod = $("chipMethod");
  const chipTz = $("chipTz");
  const chipLatLng = $("chipLatLng");
  let advancedVisible = false;

  toggleAdvanced.addEventListener("click", () => {
    advancedVisible = !advancedVisible;
    if (advancedVisible) {
      chipMethod.classList.remove("chip--hidden");
      chipMethod.classList.add("chip--visible");
      chipTz.classList.remove("chip--hidden");
      chipTz.classList.add("chip--visible");
      chipLatLng.classList.remove("chip--hidden");
      chipLatLng.classList.add("chip--visible");
      const sp = toggleAdvanced.querySelector("[data-i18n]");
      if (sp) { sp.dataset.i18n = "btn.hide_advanced"; sp.textContent = t("btn.hide_advanced"); }
    } else {
      chipMethod.classList.add("chip--hidden");
      chipMethod.classList.remove("chip--visible");
      chipTz.classList.add("chip--hidden");
      chipTz.classList.remove("chip--visible");
      chipLatLng.classList.add("chip--hidden");
      chipLatLng.classList.remove("chip--visible");
      const sp = toggleAdvanced.querySelector("[data-i18n]");
      if (sp) { sp.dataset.i18n = "btn.advanced"; sp.textContent = t("btn.advanced"); }
    }
  });

  // Today button
  $("todayBtn").addEventListener("click", () => {
    setTodayDateInput();
    saveSettings();
    regenerate();
  });

  // Copy today's times
  $("copyBtn").addEventListener("click", () => {
    const rows = buildRows();
    const now = new Date();
    const today = rows.find((r) => sameDay(r.date, now));
    if (!today) return;

    const city = $("citySearch").value;
    const text = `${city} Prayer Times - ${fmtDateLong(today.date)}
Fajr: ${today.times.Fajr}
Sunrise: ${today.times.Sunrise}
Dhuhr: ${today.times.Dhuhr}
Asr: ${today.times.Asr}
Maghrib: ${today.times.Maghrib}
Isha: ${today.times.Isha}`;

    // Try clipboard API first, fallback for mobile
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback("copyBtn");
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  });

  function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      showCopyFeedback("copyBtn");
    } catch {
      // Last resort - show the text in an alert
      alert(text);
    }
    document.body.removeChild(textArea);
  }

  function showCopyFeedback(btnId) {
    const btn = $(btnId);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = original), 1500);
  }

  // Geolocation: use my location
  $("locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    geolocateUser($("locateBtn"));
  });

  // Share modal
  const shareModal = $("shareModal");
  const modalClose = $("modalClose");
  const shareBtn = $("shareBtn");

  shareBtn.addEventListener("click", () => {
    shareModal.classList.add("active");
  });

  modalClose.addEventListener("click", () => {
    shareModal.classList.remove("active");
  });

  shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) {
      shareModal.classList.remove("active");
    }
  });

  // Generate PDF using template
  $("downloadPdf").addEventListener("click", async () => {
    const btn = $("downloadPdf");
    const originalText = btn.innerHTML;
    btn.innerHTML = "Generating...";
    btn.disabled = true;

    try {
      if (!window.PDFLib) {
        alert("PDF library not loaded. Please refresh and try again.");
        return;
      }

      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;

      // Load the template
      const templateBytes = await fetch("assets/adhan_format_no_table.pdf").then(r => {
        if (!r.ok) throw new Error("Template not found");
        return r.arrayBuffer();
      });

      const pdfDoc = await PDFDocument.load(templateBytes);
      const page = pdfDoc.getPage(0);
      const { width, height } = page.getSize(); // A4 portrait: 595.28 × 841.89 pt

      const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const city  = $("citySearch").value || "Unknown";
      const rows  = buildRows();
      const hijri = formatHijriDate(new Date());

      // ── Layout measurements (calibrated against the template) ──
      // "Adhan Timings" script text ends at ~43 % from top
      // Footer decoration starts at ~82 % from top
      // pdf-lib y=0 is at the bottom of the page
      const contentTop    = height - Math.round(height * 0.43); // ~480 pt from bottom
      const contentBottom = Math.round(height * 0.18);           // ~152 pt from bottom
      const tableLeft     = 32;
      const tableRight    = width - 32;
      const tableWidth    = tableRight - tableLeft;

      // City + Hijri date subtitle
      const subtitleSize = 9;
      const subtitle = `${city}  ·  ${hijri}`;
      const subtitleW = fontBold.widthOfTextAtSize(subtitle, subtitleSize);
      page.drawText(subtitle, {
        x: width / 2 - subtitleW / 2,
        y: contentTop - 2,
        size: subtitleSize,
        font: fontBold,
        color: rgb(43 / 255, 87 / 255, 70 / 255),
      });

      // ── Table ──
      const tableTop      = contentTop - 20;   // just below subtitle
      const tableAreaH    = tableTop - contentBottom;
      const headerH       = Math.min(tableAreaH / (rows.length + 2), 15);
      const rowH          = (tableAreaH - headerH) / rows.length;
      const fontSize      = Math.max(Math.min(rowH * 0.58, 8.5), 6.5);
      const headerFontSz  = Math.max(Math.min(headerH * 0.58, 8), 6.5);

      // Column widths — date column wider than the six prayer-time columns
      const dateColW = tableWidth * 0.21;
      const timeColW = (tableWidth - dateColW) / 6;
      const colWidths = [dateColW, timeColW, timeColW, timeColW, timeColW, timeColW, timeColW];
      const colX = colWidths.map((_, i) =>
        tableLeft + colWidths.slice(0, i).reduce((s, w) => s + w, 0)
      );
      const cols = ["Date", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

      // Header row
      const headerY = tableTop - headerH;
      page.drawRectangle({
        x: tableLeft, y: headerY,
        width: tableWidth, height: headerH,
        color: rgb(43 / 255, 87 / 255, 70 / 255),
      });
      cols.forEach((col, i) => {
        const tw = fontBold.widthOfTextAtSize(col, headerFontSz);
        page.drawText(col, {
          x: colX[i] + (colWidths[i] - tw) / 2,
          y: headerY + (headerH - headerFontSz) / 2,
          size: headerFontSz,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      });

      // Data rows
      const green    = rgb(43 / 255, 87 / 255, 70 / 255);
      const darkText = rgb(0.15, 0.15, 0.15);
      const divider  = rgb(0.78, 0.75, 0.70);

      rows.forEach((r, i) => {
        const rowY    = headerY - (i + 1) * rowH;
        const isToday = sameDay(r.date, new Date());

        // Row background
        if (isToday) {
          page.drawRectangle({
            x: tableLeft, y: rowY, width: tableWidth, height: rowH,
            color: rgb(0.84, 0.92, 0.87),
            borderColor: green, borderWidth: 0.7,
          });
        } else if (i % 2 === 1) {
          page.drawRectangle({
            x: tableLeft, y: rowY, width: tableWidth, height: rowH,
            color: rgb(0.96, 0.94, 0.90),
          });
        }

        const dateStr = r.date.toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        });
        const cells     = [dateStr, r.times.Fajr, r.times.Sunrise, r.times.Dhuhr, r.times.Asr, r.times.Maghrib, r.times.Isha];
        const textColor = isToday ? green : darkText;
        const rowFont   = isToday ? fontBold : font;

        cells.forEach((cell, j) => {
          const tw = rowFont.widthOfTextAtSize(cell, fontSize);
          page.drawText(cell, {
            x: colX[j] + (colWidths[j] - tw) / 2,
            y: rowY + (rowH - fontSize) / 2,
            size: fontSize,
            font: rowFont,
            color: textColor,
          });
        });

        // Row divider
        if (!isToday) {
          page.drawLine({
            start: { x: tableLeft, y: rowY },
            end:   { x: tableRight, y: rowY },
            thickness: 0.3,
            color: divider,
          });
        }
      });

      // Outer border
      page.drawRectangle({
        x: tableLeft,
        y: headerY - rows.length * rowH,
        width: tableWidth,
        height: headerH + rows.length * rowH,
        borderColor: green,
        borderWidth: 0.8,
      });

      // Save & download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `prayer-times-${city.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
      shareModal.classList.remove("active");
    }
  });

  // .ics download
  const downloadIcsBtn = $("downloadIcs");
  if (downloadIcsBtn) downloadIcsBtn.addEventListener("click", downloadIcs);

  // Social share handlers
  const shareCity = $("citySearch").value || "Unknown";
  const shareText = `Prayer Times for ${shareCity}`;
  const shareUrl = window.location.href;

  $("shareFacebook").href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  $("shareTwitter").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  $("shareWhatsApp").href = `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
  $("shareEmail").href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareText + "\n" + shareUrl)}`;

  // Contact form
  $("contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name    = $("contactName").value.trim();
    const email   = $("contactEmail").value.trim();
    const subject = $("contactSubject").value.trim();
    const message = $("contactMessage").value.trim();
    if (!name || !email || !subject || !message) return;
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    window.location.href = `mailto:tariqbaater@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // Islamic Q&A search
  $("islamqaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const query = $("islamqaInput").value.trim();
    if (!query) return;
    window.open(`https://islamqa.info/${currentLang}/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
  });

  // Daily Ayah
  (async function loadDailyAyah() {
    const container = $("ayahContent");
    const todayKey  = `ayah_${new Date().toDateString()}`;

    function render(ayah) {
      container.innerHTML = `
        <div class="ayah-arabic">${ayah.arabic}</div>
        <div class="ayah-english">"${ayah.english}"</div>
        <div class="ayah-ref">
          <span class="ayah-ref-name">${ayah.surah}</span>
          <span class="ayah-ref-num">${ayah.surahNum}:${ayah.ayahNum}</span>
        </div>`;
    }

    const cached = localStorage.getItem(todayKey);
    if (cached) { render(JSON.parse(cached)); return; }

    // Pick a verse: spread evenly across the year using a prime step
    const start   = new Date(new Date().getFullYear(), 0, 1);
    const dayOfYear = Math.floor((new Date() - start) / 86400000) + 1;
    const verseNum  = ((dayOfYear * 17) % 6236) + 1;

    try {
      const res  = await fetch(`https://api.alquran.cloud/v1/ayah/${verseNum}/editions/quran-uthmani,en.sahih`);
      const json = await res.json();
      if (json.code !== 200) throw new Error();
      const [ar, en] = json.data;
      const ayah = {
        arabic:   ar.text,
        english:  en.text,
        surah:    ar.surah.englishName,
        surahNum: ar.surah.number,
        ayahNum:  ar.numberInSurah,
      };
      localStorage.setItem(todayKey, JSON.stringify(ayah));
      render(ayah);
    } catch {
      container.innerHTML = `<div class="ayah-error">Could not load today's ayah.<br>Check your connection and refresh.</div>`;
    }
  })();

  renderDua();
  initContentTabs();
  regenerate();
})();

/********************************************************************
 * Content Tabs — Articles & Books
 ********************************************************************/
function initContentTabs() {
  const tabs   = document.querySelectorAll(".content-tab");
  const panels = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });

      panels.forEach((p) => {
        p.hidden = p.id !== `tab-${target}`;
      });

      if (target === "articles" && !$("articles-grid").dataset.loaded) loadArticles();
      if (target === "books"    && !$("books-grid").dataset.loaded)    loadBooks();
      if (target === "zakat")                                          initZakatCalculator();
    });
  });
}

function parseArticleItems(doc) {
  return Array.from(doc.querySelectorAll('a[data-sut="post-item"]')).map((a) => {
    const href    = a.getAttribute("href") || "";
    const full    = href.startsWith("http") ? href : `https://islamqa.info${href}`;
    const title   = (a.querySelector('[data-sut="post-item-title"]') || a.querySelector("h2"))?.textContent.trim() || "Article";
    const excerpt = a.querySelector('[data-sut="post-item-excerpt"]')?.textContent.trim() || "";
    return `<a class="article-card" href="${full}" target="_blank" rel="noopener">
      <div class="article-cover-placeholder">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div class="article-card-body">
        <div class="article-card-title">${title}</div>
        ${excerpt ? `<div class="article-card-excerpt">${excerpt}</div>` : ""}
      </div>
      <div class="article-card-footer">Read article →</div>
    </a>`;
  });
}

async function fetchViaProxy(url) {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  ];
  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const text = await res.text();
        if (text.length > 500) return text;
      }
    } catch { /* try next proxy */ }
  }
  throw new Error("All proxies failed");
}

async function loadArticles() {
  const grid  = $("articles-grid");
  grid.innerHTML = Array(8).fill(`<div class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-body"><div class="skeleton-line skeleton-line--title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line--short"></div></div></div>`).join("");
  const BASE  = `https://islamqa.info/${currentLang}/articles`;

  try {
    // Fetch page 1 and detect total pages
    const html1 = await fetchViaProxy(BASE);
    const doc1  = new DOMParser().parseFromString(html1, "text/html");
    if (!doc1.querySelectorAll('a[data-sut="post-item"]').length) throw new Error("no items");

    const pageNums = Array.from(doc1.querySelectorAll('a[href*="?page="]'))
      .map((a) => parseInt(new URL(a.href, "https://islamqa.info").searchParams.get("page"), 10))
      .filter((n) => !isNaN(n));
    const totalPages = pageNums.length ? Math.max(...pageNums) : 1;

    // Fetch remaining pages concurrently
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchViaProxy(`${BASE}?page=${i + 2}`)
        .then((h) => new DOMParser().parseFromString(h, "text/html"))
    );
    const otherDocs = await Promise.all(remaining);

    const allCards = [doc1, ...otherDocs].flatMap(parseArticleItems);
    grid.innerHTML = allCards.join("") || `<div class="islamqa-error">No articles found.</div>`;
  } catch {
    grid.innerHTML = `<div class="islamqa-error">Could not load articles.<br>
      <a class="islamqa-browse-btn" href="https://islamqa.info/${currentLang}/articles" target="_blank" rel="noopener">Browse on islamqa.info →</a></div>`;
  }
  grid.dataset.loaded = "1";
}

function parseBookItems(doc) {
  return Array.from(doc.querySelectorAll('a[data-sut="post-item"]')).map((a) => {
    const href    = a.getAttribute("href") || "";
    const full    = href.startsWith("http") ? href : `https://islamqa.info${href}`;
    const title   = (a.querySelector('[data-sut="post-item-title"]') || a.querySelector("h2"))?.textContent.trim() || "Book";
    const excerpt = a.querySelector('[data-sut="book-item-excerpt"]')?.textContent.trim() || "";
    const img     = a.querySelector("img");
    const src     = img ? (img.getAttribute("src") || "") : "";
    const cover   = src
      ? `<img class="book-cover" src="${src}" alt="" loading="lazy">`
      : `<div class="book-cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>`;
    return `<a class="book-card" href="${full}" target="_blank" rel="noopener">
      ${cover}
      <div class="article-card-body">
        <div class="article-card-title">${title}</div>
        ${excerpt ? `<div class="article-card-excerpt">${excerpt}</div>` : ""}
      </div>
      <div class="article-card-footer">Read book →</div>
    </a>`;
  });
}

async function loadBooks() {
  const grid  = $("books-grid");
  grid.innerHTML = Array(8).fill(`<div class="skeleton-card skeleton-card--tall"><div class="skeleton-cover skeleton-cover--tall"></div><div class="skeleton-body"><div class="skeleton-line skeleton-line--title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line--short"></div></div></div>`).join("");
  const BASE  = `https://islamqa.info/${currentLang}/books`;

  try {
    // Fetch page 1 and detect total pages
    const html1 = await fetchViaProxy(BASE);
    const doc1  = new DOMParser().parseFromString(html1, "text/html");
    if (!doc1.querySelectorAll('a[data-sut="post-item"]').length) throw new Error("no items");

    // Find the highest page number from pagination links
    const pageNums = Array.from(doc1.querySelectorAll('a[href*="?page="]'))
      .map((a) => parseInt(new URL(a.href, "https://islamqa.info").searchParams.get("page"), 10))
      .filter((n) => !isNaN(n));
    const totalPages = pageNums.length ? Math.max(...pageNums) : 1;

    // Fetch remaining pages concurrently
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchViaProxy(`${BASE}?page=${i + 2}`)
        .then((h) => new DOMParser().parseFromString(h, "text/html"))
    );
    const otherDocs = await Promise.all(remaining);

    const allCards = [doc1, ...otherDocs].flatMap(parseBookItems);
    grid.innerHTML = allCards.join("") || `<div class="islamqa-error">No books found.</div>`;
  } catch {
    grid.innerHTML = `<div class="islamqa-error">Could not load books.<br>
      <a class="islamqa-browse-btn" href="https://islamqa.info/${currentLang}/books" target="_blank" rel="noopener">Browse on islamqa.info →</a></div>`;
  }
  grid.dataset.loaded = "1";
}

/********************************************************************
 * Zakat Calculator
 ********************************************************************/
const GOLD_API_KEY = "goldapi-8xgjsmm8v5h5j-io"; // see .env

const CURRENCY_SYMBOLS = {
  USD: "$", GBP: "£", EUR: "€",
  SAR: "SAR ", INR: "₹", PKR: "PKR ", BDT: "৳ ",
};

async function fetchGoldPrice(currencyCode) {
  const input = $("goldPrice");
  const hint  = $("goldPriceHint");
  if (!input) return;

  const prev = input.value;
  input.disabled = true;
  if (hint) { hint.textContent = t("gold.fetching"); hint.className = "gold-price-hint"; }

  try {
    const res = await fetch(`https://www.goldapi.io/api/XAU/${currencyCode}`, {
      headers: { "x-access-token": GOLD_API_KEY, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    if (!data.price) throw new Error("no price");
    const perGram = data.price / 31.1035;
    input.value = perGram.toFixed(2);
    if (hint) { hint.textContent = t("gold.live"); hint.className = "gold-price-hint gold-price-hint--live"; }
  } catch (err) {
    input.value = prev || "85";
    if (hint) { hint.textContent = t("gold.error"); hint.className = "gold-price-hint gold-price-hint--error"; }
  } finally {
    input.disabled = false;
    calculateZakat();
  }
}

let zakatInitialized = false;

function initZakatCalculator() {
  if (zakatInitialized) return;
  zakatInitialized = true;

  const calcIds = ["goldPrice","z_cash","z_gold","z_investments","z_business","z_receivables","z_other","z_debts","z_expenses","z_bizliab"];
  calcIds.forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", calculateZakat);
  });

  const currencyEl = $("zakatCurrency");
  if (currencyEl) {
    currencyEl.addEventListener("change", () => fetchGoldPrice(currencyEl.value));
  }

  // FAQ accordion
  document.querySelectorAll(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });

  calculateZakat(); // show nisab immediately with default price
  fetchGoldPrice(currencyEl?.value || "USD"); // then update with live price
}

function calculateZakat() {
  const currencyCode = $("zakatCurrency")?.value || "USD";
  const currSymbol   = CURRENCY_SYMBOLS[currencyCode] || currencyCode + " ";
  const goldPrice    = parseFloat($("goldPrice")?.value) || 85;
  const nisab     = 85 * goldPrice;

  const val = (id) => parseFloat($(id)?.value) || 0;
  const assets      = val("z_cash") + val("z_gold") + val("z_investments") + val("z_business") + val("z_receivables") + val("z_other");
  const liabilities = val("z_debts") + val("z_expenses") + val("z_bizliab");
  const net         = Math.max(0, assets - liabilities);
  const isLiable    = net >= nisab;
  const zakatDue    = isLiable ? net * 0.025 : 0;

  const fmt = (n) => currSymbol + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  $("nisabDisplay").textContent     = fmt(nisab);
  $("zr_nisab").textContent         = fmt(nisab);
  $("zr_assets").textContent        = fmt(assets);
  $("zr_liabilities").textContent   = fmt(liabilities);
  $("zr_net").textContent           = fmt(net);

  const verdict = $("zakatVerdict");
  const amount  = $("zakatAmount");

  if (assets === 0) {
    verdict.className   = "zakat-verdict";
    verdict.textContent = t("zakat.empty");
    amount.innerHTML    = "";
    return;
  }

  if (isLiable) {
    verdict.className   = "zakat-verdict zakat-verdict--liable";
    verdict.textContent = t("zakat.liable").replace("{net}", fmt(net));
    amount.innerHTML    = `<span class="zakat-amount-label">${t("zakat.amount.label")}</span><span class="zakat-amount-value">${fmt(zakatDue)}</span>`;
  } else {
    verdict.className   = "zakat-verdict zakat-verdict--exempt";
    verdict.textContent = t("zakat.exempt").replace("{net}", fmt(net)).replace("{nisab}", fmt(nisab));
    amount.innerHTML    = "";
  }
}
