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
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&featuretype=city,town,municipality`,
      {
        headers: {
          "User-Agent": "AdhanTimings/1.0",
        },
      }
    );

    if (!response.ok) throw new Error("API error");

    const data = await response.json();

    if (data.length === 0) {
      dropdown.innerHTML = '<div class="city-dropdown-empty">No cities found</div>';
      return;
    }

    dropdown.innerHTML = data
      .map(
        (place) => `
      <div class="city-dropdown-item" data-lat="${place.lat}" data-lng="${place.lon}" data-name="${place.display_name.split(",")[0]}">
        <div class="name">${place.display_name.split(",")[0]}</div>
        <div class="country">${place.display_name.split(",").slice(1, 3).join(",")}</div>
        <div class="coords">${parseFloat(place.lat).toFixed(4)}, ${parseFloat(place.lon).toFixed(4)}</div>
      </div>
    `
      )
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

  dropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".city-dropdown-item");
    if (item) {
      const lat = item.dataset.lat;
      const lng = item.dataset.lng;
      const name = item.dataset.name;

      $("lat").value = lat;
      $("lng").value = lng;
      searchInput.value = name;
      dropdown.classList.remove("active");

      saveSettings();
      regenerate();
    }
  });

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
    // Default to Makkah on first load
    $("citySearch").value = "Makkah";
    $("lat").value = 21.3891;
    $("lng").value = 39.8579;
    $("method").value = String(PrayTime.Makkah);
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
    <div class="cell headcell" role="columnheader">Date</div>
    <div class="cell headcell" role="columnheader">Fajr</div>
    <div class="cell headcell" role="columnheader">Sunrise</div>
    <div class="cell headcell" role="columnheader">Dhuhr</div>
    <div class="cell headcell" role="columnheader">Asr</div>
    <div class="cell headcell" role="columnheader">Maghrib (Iftar)</div>
    <div class="cell headcell" role="columnheader">Isha</div>
  `;
  host.appendChild(head);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  let i = 0;
  for (const r of rows) {
    const isToday = sameDay(r.date, now);
    const isTomorrow = sameDay(r.date, tomorrowStart);
    const badge = isToday
      ? `<span class="badge today">Today</span>`
      : isTomorrow
        ? `<span class="badge tomorrow">Tomorrow</span>`
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
      <div class="cell mono" role="cell" aria-label="Sunrise ${r.times.Sunrise}">${r.times.Sunrise}</div>
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
    const imsak = todayMap.Imsak || PrayTime.InvalidTime;
    const iftar = todayMap.Maghrib || PrayTime.InvalidTime;
    imsakEl.textContent = `Imsak ${imsak} | Iftar ${iftar}`;
  }

  const city = $("citySearch").value;

  // Display city + method in header, and show today's Hijri date prominently.
  const todayHijri = formatHijriDate(new Date());
  const methodId = parseInt($("method").value, 10);
  const methodLabel = methods.find((m) => m.id === methodId)?.label || "";
  $("subline").textContent = `${city} • ${methodLabel}`;

  const hijriEl = $("hijriDate");
  if (hijriEl) hijriEl.textContent = todayHijri;

  $("bigLabel").textContent = `Next Prayer: ${next.name}`;
  $("bigTime").textContent = next.time;

  const nextAt = $("nextAt");
  if (nextAt) nextAt.textContent = `at ${next.time}`;

  // Show current prayer
  const currentEl = $("currentName");
  const current = getCurrentPrayer(now, pt, latN, lngN, tzN);
  if (currentEl) {
    currentEl.textContent = current ? current.name : "—";
  }

  updateNowLine();

  startCountdown(next.date, next.name);
  saveSettings();
}

/********************************************************************
 * Prayer Notifications
 ********************************************************************/
let notificationsEnabled = false;
let notificationTimer = null;
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
  if (notificationsEnabled) {
    notificationsEnabled = false;
    stopNotificationChecker();
    btn.textContent = "🔔 Notify";
    btn.classList.remove("btn--active");
    try {
      localStorage.setItem("adhan-notifications", "off");
    } catch { /* ignore */ }
  } else {
    requestNotificationPermission().then((granted) => {
      if (granted) {
        notificationsEnabled = true;
        startNotificationChecker();
        btn.textContent = "🔕 On";
        btn.classList.add("btn--active");
        try {
          localStorage.setItem("adhan-notifications", "on");
        } catch { /* ignore */ }
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
      btn.textContent = "🔕 On";
      btn.classList.add("btn--active");
    }
  } catch { /* ignore */ }
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
  return getStoredTheme() || getSystemTheme();
}

function updateThemeButton(btn, theme) {
  if (theme === "light") {
    btn.textContent = "☀️ Light";
  } else {
    btn.textContent = "🌙 Dark";
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

(function init() {
  initDropdowns();
  setTodayDateInput();
  setupCitySearch();
  applySettings();
  initCalendarConverter();

  // Theme toggle
  const themeBtn = $("themeBtn");
  initTheme(themeBtn);
  themeBtn.addEventListener("click", () => toggleTheme(themeBtn));

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

  // Notifications
  const notifyBtn = $("notifyBtn");
  notifyBtn.addEventListener("click", () => toggleNotifications(notifyBtn));
  restoreNotificationState(notifyBtn);

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
      toggleAdvanced.textContent = "⚙️ Hide";
    } else {
      chipMethod.classList.add("chip--hidden");
      chipMethod.classList.remove("chip--visible");
      chipTz.classList.add("chip--hidden");
      chipTz.classList.remove("chip--visible");
      chipLatLng.classList.add("chip--hidden");
      chipLatLng.classList.remove("chip--visible");
      toggleAdvanced.textContent = "⚙️ Advanced";
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

    const btn = $("locateBtn");
    btn.classList.add("locating");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        $("lat").value = lat;
        $("lng").value = lng;

        // Reverse geocode to get city name
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
          $("citySearch").value = "My Location";
        }

        btn.classList.remove("locating");
        saveSettings();
        regenerate();
      },
      (err) => {
        btn.classList.remove("locating");
        if (err.code === err.PERMISSION_DENIED) {
          alert("Location access was denied. Please allow location access in your browser settings.");
        } else {
          alert("Could not get your location. Please search for a city instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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

  // Social share handlers
  const shareCity = $("citySearch").value || "Unknown";
  const shareText = `Prayer Times for ${shareCity}`;
  const shareUrl = window.location.href;

  $("shareFacebook").href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  $("shareTwitter").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  $("shareWhatsApp").href = `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
  $("shareEmail").href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareText + "\n" + shareUrl)}`;

  regenerate();
})();
