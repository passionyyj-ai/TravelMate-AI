const STORAGE_KEY = "travelmate_ai_v1";
const DEVICE_ID_KEY = "travelmate_device_id";
const SYNC_DEBOUNCE_MS = 1100;
const TRAVELMATE_AUTH_STORAGE_KEY = "travelmate-ai-auth-v1";
const TRAVELMATE_AUTH_MARKER_KEY = "travelmate_ai_authenticated_email";

const state = {
  trips: [],
  activeTripId: null,
  direction: "toLocal",
  rate: null,
  supabase: null,
  user: null,
  channel: null,
  syncTimer: null,
  syncInProgress: false,
  applyingRemote: false,
  lastCloudHash: "",
  selectedImageDataUrl: "",
};

const $ = (id) => document.getElementById(id);
const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c],
  );
const nowIso = () => new Date().toISOString();

function getDeviceId() {
  let value = localStorage.getItem(DEVICE_ID_KEY);
  if (!value) {
    value = uid("device");
    localStorage.setItem(DEVICE_ID_KEY, value);
  }
  return value;
}

function stableHash(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(hash >>> 0);
}

function normalizeData() {
  state.trips = (Array.isArray(state.trips) ? state.trips : []).map((trip) => ({
    ...trip,
    id: trip.id || uid("trip"),
    updatedAt: trip.updatedAt || trip.updated_at || "1970-01-01T00:00:00.000Z",
    schedules: (Array.isArray(trip.schedules) ? trip.schedules : []).map((schedule) => ({
      ...schedule,
      id: schedule.id || uid("schedule"),
      updatedAt:
        schedule.updatedAt ||
        schedule.updated_at ||
        trip.updatedAt ||
        "1970-01-01T00:00:00.000Z",
    })),
  }));
  if (!state.trips.some((trip) => trip.id === state.activeTripId)) {
    state.activeTripId = state.trips[0]?.id || null;
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.trips = Array.isArray(saved.trips) ? saved.trips : [];
    state.activeTripId = saved.activeTripId || state.trips[0]?.id || null;
  } catch (error) {
    console.warn("Local data load failed", error);
  }
  normalizeData();
}

function localPayload() {
  return {
    version: 2,
    trips: state.trips,
    activeTripId: state.activeTripId,
    deviceId: getDeviceId(),
    updatedAt: nowIso(),
  };
}

function persist(options = {}) {
  normalizeData();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ trips: state.trips, activeTripId: state.activeTripId }),
  );
  if (!options.skipSync) scheduleCloudSave();
}

function activeTrip() {
  return state.trips.find((trip) => trip.id === state.activeTripId) || null;
}

function countryInfo(name) {
  return window.TRAVELMATE_COUNTRIES?.[name] || null;
}

function newer(a, b) {
  return new Date(a || 0).getTime() >= new Date(b || 0).getTime() ? a : b;
}

function mergeSchedules(localItems = [], remoteItems = []) {
  const map = new Map();
  for (const item of [...remoteItems, ...localItems]) {
    if (!item?.id) continue;
    const current = map.get(item.id);
    if (!current) {
      map.set(item.id, item);
      continue;
    }
    map.set(
      item.id,
      newer(item.updatedAt || item.updated_at, current.updatedAt || current.updated_at) ===
          (item.updatedAt || item.updated_at)
        ? item
        : current,
    );
  }
  return [...map.values()];
}

function mergeTrips(localTrips = [], remoteTrips = []) {
  const map = new Map();
  for (const trip of [...remoteTrips, ...localTrips]) {
    if (!trip?.id) continue;
    const current = map.get(trip.id);
    if (!current) {
      map.set(trip.id, { ...trip, schedules: mergeSchedules(trip.schedules, []) });
      continue;
    }
    const latest =
      newer(trip.updatedAt || trip.updated_at, current.updatedAt || current.updated_at) ===
      (trip.updatedAt || trip.updated_at)
        ? trip
        : current;
    map.set(trip.id, {
      ...latest,
      schedules: mergeSchedules(current.schedules, trip.schedules),
    });
  }
  return [...map.values()].sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
  );
}

function mergeCloudData(remote) {
  const remoteTrips = Array.isArray(remote?.trips) ? remote.trips : [];
  state.trips = mergeTrips(state.trips, remoteTrips);
  if (!state.activeTripId) {
    state.activeTripId = remote?.activeTripId || state.trips[0]?.id || null;
  }
  normalizeData();
}

function navigate(page) {
  document.querySelectorAll(".page").forEach((element) => element.classList.remove("active"));
  $(page + "Page")?.classList.add("active");
  document
    .querySelectorAll(".bottom-nav button")
    .forEach((button) => button.classList.toggle("active", button.dataset.go === page));
  if (page === "schedule") renderSchedules();
  if (page === "trips") renderTrips();
  if (page === "translate") updateLanguageUI();
  if (page === "tools") updateTools();
  if (page === "sync") renderSyncUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]")?.dataset.go;
  if (go) navigate(go);
});

function renderHome() {
  const trip = activeTrip();
  $("homeTripName").textContent = trip ? trip.name : "등록된 여행이 없습니다";
  $("homeTripMeta").textContent = trip
    ? `${trip.country} · ${trip.city} · ${trip.currency}`
    : "여행을 먼저 등록해 주세요.";

  const next = trip?.schedules
    ?.map((schedule) => ({ ...schedule, instant: toInstant(trip, schedule) }))
    .filter((schedule) => schedule.instant > new Date())
    .sort((a, b) => a.instant - b.instant)[0];

  $("nextTitle").textContent = next?.title || "일정이 없습니다";
  $("nextMeta").textContent = next
    ? `${next.date} ${next.start || ""} · ${next.place || ""}`
    : "일정을 등록해 주세요.";
}

function updateClocks() {
  const now = new Date();
  const trip = activeTrip();
  const format = (timeZone, options) =>
    new Intl.DateTimeFormat("ko-KR", { timeZone, ...options }).format(now);

  $("koreaClock").textContent = format("Asia/Seoul", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  $("koreaDate").textContent = format("Asia/Seoul", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const timeZone = trip?.timezone || "Asia/Seoul";
  $("localClock").textContent = format(timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  $("localDate").textContent = trip
    ? `${trip.city} · ${format(timeZone, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      })}`
    : "여행지 미선택";
}

function renderTrips() {
  const box = $("tripList");
  if (!state.trips.length) {
    box.innerHTML =
      '<div class="muted">등록된 여행이 없습니다. “새 여행”을 눌러 주세요.</div>';
    return;
  }

  box.innerHTML = state.trips
    .map(
      (trip) => `
    <article class="trip-item ${trip.id === state.activeTripId ? "active" : ""}">
      <div>
        <h3>${esc(trip.name)}</h3>
        <p>${esc(trip.country)} · ${esc(trip.city)} · ${esc(trip.currency)} · ${esc(
          trip.timezone,
        )}</p>
        <p>${esc(trip.start || "")} ~ ${esc(trip.end || "")}</p>
      </div>
      <div class="item-actions">
        ${
          trip.id !== state.activeTripId
            ? `<button class="primary" data-trip-select="${trip.id}">선택</button>`
            : ""
        }
        <button class="small-btn" data-trip-edit="${trip.id}">수정</button>
        <button class="small-btn danger" data-trip-delete="${trip.id}">삭제</button>
      </div>
    </article>`,
    )
    .join("");

  box.querySelectorAll("[data-trip-select]").forEach((button) => {
    button.onclick = () => {
      state.activeTripId = button.dataset.tripSelect;
      persist();
      refreshAll();
    };
  });
  box.querySelectorAll("[data-trip-edit]").forEach((button) => {
    button.onclick = () => openTripEditor(button.dataset.tripEdit);
  });
  box.querySelectorAll("[data-trip-delete]").forEach((button) => {
    button.onclick = () => deleteTrip(button.dataset.tripDelete);
  });
}

function populateCountries() {
  $("tripCountry").innerHTML =
    '<option value="">국가 선택</option>' +
    Object.keys(TRAVELMATE_COUNTRIES)
      .map((country) => `<option>${country}</option>`)
      .join("");
}

function populateCities(country, selected = "") {
  const info = countryInfo(country);
  $("tripCity").innerHTML =
    '<option value="">도시 선택</option>' +
    Object.keys(info?.cities || {})
      .map(
        (city) => `<option ${city === selected ? "selected" : ""}>${city}</option>`,
      )
      .join("");
}

function applyCountryCity() {
  const info = countryInfo($("tripCountry").value);
  populateCities($("tripCountry").value);
  $("tripCurrency").value = info?.currency || "";
  $("tripLanguage").value = info?.language || "";
  $("tripTimezone").innerHTML = '<option value="">시간대 선택</option>';
}

function applyCity() {
  const info = countryInfo($("tripCountry").value);
  const city = $("tripCity").value;
  const selectedTimeZone = info?.cities?.[city] || "";
  $("tripTimezone").innerHTML = Object.values(info?.cities || {})
    .filter((value, index, array) => array.indexOf(value) === index)
    .map(
      (value) =>
        `<option ${value === selectedTimeZone ? "selected" : ""}>${value}</option>`,
    )
    .join("");
}

function openTripEditor(id = "") {
  const trip = id ? state.trips.find((item) => item.id === id) : null;
  $("tripEditor").classList.remove("hidden");
  $("tripEditorTitle").textContent = id ? "여행 수정" : "새 여행 등록";
  $("tripId").value = trip?.id || "";
  $("tripName").value = trip?.name || "";
  $("tripCountry").value = trip?.country || "";
  populateCities(trip?.country || "", trip?.city || "");
  $("tripCity").value = trip?.city || "";
  $("tripCurrency").value = trip?.currency || "";
  $("tripLanguage").value = trip?.language || "";
  $("tripTimezone").innerHTML = trip?.timezone
    ? `<option>${trip.timezone}</option>`
    : '<option value="">시간대 선택</option>';
  $("tripStart").value = trip?.start || "";
  $("tripEnd").value = trip?.end || "";
  $("tripEditor").scrollIntoView({ behavior: "smooth" });
}

function saveTrip() {
  const info = countryInfo($("tripCountry").value);
  const id = $("tripId").value || uid("trip");
  const existing = state.trips.find((trip) => trip.id === id);
  const trip = {
    id,
    name: $("tripName").value.trim(),
    country: $("tripCountry").value,
    city: $("tripCity").value,
    currency: $("tripCurrency").value,
    timezone: $("tripTimezone").value,
    language: $("tripLanguage").value,
    langCode: info?.langCode || "en",
    speech: info?.speech || "en-US",
    start: $("tripStart").value,
    end: $("tripEnd").value,
    schedules: existing?.schedules || [],
    updatedAt: nowIso(),
  };

  if (!trip.name || !trip.country || !trip.city || !trip.timezone) {
    alert("여행 이름, 국가, 도시, 시간대를 모두 선택하세요.");
    return;
  }

  const index = state.trips.findIndex((item) => item.id === id);
  if (index >= 0) state.trips[index] = trip;
  else state.trips.unshift(trip);

  state.activeTripId = id;
  persist();
  $("tripEditor").classList.add("hidden");
  refreshAll();
  alert("여행을 저장했습니다.");
}

function deleteTrip(id) {
  const trip = state.trips.find((item) => item.id === id);
  if (!trip || !confirm(`"${trip.name}" 여행을 삭제할까요?`)) return;
  state.trips = state.trips.filter((item) => item.id !== id);
  if (state.activeTripId === id) state.activeTripId = state.trips[0]?.id || null;
  persist();
  refreshAll();
}

function renderSchedules() {
  const trip = activeTrip();
  $("scheduleTripName").textContent = trip ? `${trip.name} 일정` : "여행을 먼저 선택하세요.";
  const list = trip?.schedules || [];
  const box = $("scheduleList");

  if (!trip) {
    box.innerHTML = '<div class="muted">여행을 먼저 등록해 주세요.</div>';
    return;
  }
  if (!list.length) {
    box.innerHTML =
      '<div class="muted">등록된 일정이 없습니다. 직접 추가하거나 파일을 업로드하세요.</div>';
    return;
  }

  box.innerHTML = [...list]
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
    .map(
      (schedule) => `
      <article class="schedule-item">
        <div>
          <h3>${esc(schedule.title)}</h3>
          <p>${esc(schedule.date)} ${esc(schedule.start || "")}${
            schedule.end ? " ~ " + esc(schedule.end) : ""
          } · ${esc(schedule.place || "")}</p>
          <p>${esc(schedule.note || "")}</p>
        </div>
        <div class="item-actions">
          <button class="small-btn" data-sch-edit="${schedule.id}">수정</button>
          <button class="small-btn danger" data-sch-delete="${schedule.id}">삭제</button>
        </div>
      </article>`,
    )
    .join("");

  box.querySelectorAll("[data-sch-edit]").forEach((button) => {
    button.onclick = () => openScheduleEditor(button.dataset.schEdit);
  });
  box.querySelectorAll("[data-sch-delete]").forEach((button) => {
    button.onclick = () => deleteSchedule(button.dataset.schDelete);
  });
}

function openScheduleEditor(id = "") {
  const trip = activeTrip();
  if (!trip) {
    alert("여행을 먼저 선택하세요.");
    return;
  }
  const schedule = id ? trip.schedules.find((item) => item.id === id) : null;
  $("scheduleEditor").classList.remove("hidden");
  $("scheduleEditorTitle").textContent = id ? "일정 수정" : "일정 추가";
  $("scheduleId").value = schedule?.id || "";
  $("scheduleDate").value = schedule?.date || trip.start || "";
  $("scheduleStart").value = schedule?.start || "09:00";
  $("scheduleEnd").value = schedule?.end || "";
  $("scheduleTitle").value = schedule?.title || "";
  $("schedulePlace").value = schedule?.place || "";
  $("scheduleCategory").value = schedule?.category || "관광";
  $("scheduleNote").value = schedule?.note || "";
  $("scheduleEditor").scrollIntoView({ behavior: "smooth" });
}

function saveSchedule() {
  const trip = activeTrip();
  if (!trip) return;

  const id = $("scheduleId").value || uid("schedule");
  const schedule = {
    id,
    date: $("scheduleDate").value,
    start: $("scheduleStart").value,
    end: $("scheduleEnd").value,
    title: $("scheduleTitle").value.trim(),
    place: $("schedulePlace").value.trim(),
    category: $("scheduleCategory").value,
    note: $("scheduleNote").value.trim(),
    updatedAt: nowIso(),
  };

  if (!schedule.date || !schedule.title) {
    alert("날짜와 일정명을 입력하세요.");
    return;
  }

  const index = trip.schedules.findIndex((item) => item.id === id);
  if (index >= 0) trip.schedules[index] = schedule;
  else trip.schedules.push(schedule);
  trip.updatedAt = nowIso();

  persist();
  $("scheduleEditor").classList.add("hidden");
  renderSchedules();
  renderHome();
}

function deleteSchedule(id) {
  const trip = activeTrip();
  if (!trip || !confirm("이 일정을 삭제할까요?")) return;
  trip.schedules = trip.schedules.filter((item) => item.id !== id);
  trip.updatedAt = nowIso();
  persist();
  renderSchedules();
  renderHome();
}

function normalizeRow(row) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== "") return String(row[key]).trim();
    }
    return "";
  };
  return {
    id: uid("import"),
    date: pick("날짜", "Date", "date"),
    start: pick("시작시간", "시작", "Start", "start"),
    end: pick("종료시간", "종료", "End", "end"),
    title: pick("일정명", "일정", "제목", "Title", "title"),
    place: pick("장소", "Place", "place"),
    category: pick("분류", "Category", "category") || "기타",
    note: pick("메모", "비고", "Note", "note"),
    updatedAt: nowIso(),
  };
}

async function importSchedule(file) {
  const trip = activeTrip();
  if (!trip) {
    alert("여행을 먼저 선택하세요.");
    return;
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const items = rows.map(normalizeRow).filter((item) => item.date && item.title);

    if (!items.length) {
      alert("날짜와 일정명 컬럼을 확인하세요.");
      return;
    }

    trip.schedules.push(...items);
    trip.updatedAt = nowIso();
    persist();
    renderSchedules();
    renderHome();
    alert(`${items.length}개 일정을 등록했습니다.`);
  } catch (error) {
    alert("파일을 읽지 못했습니다: " + error.message);
  }
}

function downloadSample() {
  const csv =
    "\ufeff날짜,시작시간,종료시간,일정명,장소,분류,메모\n2027-05-01,09:00,11:00,루브르 박물관,Louvre Museum,관광,예약시간 확인";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = "TravelMate_일정_샘플.csv";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function updateLanguageUI() {
  const trip = activeTrip();
  const language = trip?.language || "현지어";
  $("languageGuide").textContent = trip
    ? `${trip.country} 여행: 한국어 ↔ ${language} 통역`
    : "여행을 먼저 선택하세요.";
}

function setDirection(direction) {
  state.direction = direction;
  $("toLocalBtn").classList.toggle("active", direction === "toLocal");
  $("toKoreanBtn").classList.toggle("active", direction === "toKorean");
}

function edgeHeaders() {
  const config = window.TRAVELMATE_CONFIG || {};
  const headers = { "Content-Type": "application/json" };
  if (config.supabaseAnonKey) {
    headers.apikey = config.supabaseAnonKey;
    headers.Authorization = `Bearer ${config.supabaseAnonKey}`;
  }
  return headers;
}

async function callEdgeFunction(payload) {
  const config = window.TRAVELMATE_CONFIG || {};
  if (!config.supabaseFunctionUrl) {
    throw new Error("config.js에 Supabase Edge Function 주소가 없습니다.");
  }
  const response = await fetch(config.supabaseFunctionUrl, {
    method: "POST",
    headers: edgeHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `서버 오류 ${response.status}`);
  return data;
}

function tripForApi(trip) {
  return {
    name: trip.name,
    country: trip.country,
    city: trip.city,
    currency: trip.currency,
    timezone: trip.timezone,
    language: trip.language,
  };
}

async function translate() {
  const trip = activeTrip();
  const text = $("translateInput").value.trim();

  if (!trip) {
    alert("먼저 여행 메뉴에서 현재 여행을 선택하세요.");
    return;
  }
  if (!text) {
    alert("번역할 문장을 입력하거나 말해 주세요.");
    return;
  }

  const source = state.direction === "toLocal" ? "ko" : trip.langCode;
  const target = state.direction === "toLocal" ? trip.langCode : "ko";
  $("translateBtn").disabled = true;
  $("translateOutput").textContent = "번역 중입니다…";

  try {
    const data = await callEdgeFunction({
      mode: "translate",
      text,
      source,
      target,
      style: "simple",
      trip: tripForApi(trip),
    });
    $("translateOutput").textContent =
      data.translatedText || data.result || "번역 결과가 없습니다.";
  } catch (error) {
    $("translateOutput").textContent = "번역 실패: " + error.message;
  } finally {
    $("translateBtn").disabled = false;
  }
}

function speechRecognize() {
  const trip = activeTrip();
  const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Constructor) {
    alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
    return;
  }
  const recognition = new Constructor();
  recognition.lang =
    state.direction === "toLocal" ? "ko-KR" : trip?.speech || "en-US";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    $("translateInput").value = event.results[0][0].transcript;
  };
  recognition.onerror = () => alert("음성을 인식하지 못했습니다.");
  recognition.start();
}

function readTranslation() {
  const trip = activeTrip();
  const text = $("translateOutput").textContent;
  if (!text || text.includes("번역 결과가 여기에")) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang =
    state.direction === "toLocal" ? trip?.speech || "en-US" : "ko-KR";
  speechSynthesis.speak(utterance);
}

function showTranslatorPanel(type) {
  const imageMode = type === "image";
  $("textTranslatorTab").classList.toggle("active", !imageMode);
  $("imageTranslatorTab").classList.toggle("active", imageMode);
  $("textTranslatorPanel").classList.toggle("hidden", imageMode);
  $("imageTranslatorPanel").classList.toggle("hidden", !imageMode);
}

async function imageFileToDataUrl(file, maxSize = 1600, quality = 0.84) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 선택할 수 있습니다.");
  const original = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("이미지를 열지 못했습니다."));
    element.src = original;
  });

  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function selectTranslateImage(file) {
  try {
    state.selectedImageDataUrl = await imageFileToDataUrl(file);
    $("imagePreview").src = state.selectedImageDataUrl;
    $("imagePreviewWrap").classList.remove("hidden");
    $("analyzeImageBtn").disabled = false;
    $("imageTranslateOutput").textContent =
      "이미지가 준비되었습니다. ‘이미지 번역하기’를 눌러 주세요.";
  } catch (error) {
    state.selectedImageDataUrl = "";
    alert(error.message);
  }
}

function clearTranslateImage() {
  state.selectedImageDataUrl = "";
  $("imageTranslateFile").value = "";
  $("imagePreview").removeAttribute("src");
  $("imagePreviewWrap").classList.add("hidden");
  $("analyzeImageBtn").disabled = true;
  $("imageTranslateOutput").textContent =
    "사진을 선택하면 분석 결과가 여기에 표시됩니다.";
}

async function analyzeTranslateImage() {
  const trip = activeTrip();
  if (!trip) {
    alert("먼저 여행 메뉴에서 현재 여행을 선택하세요.");
    return;
  }
  if (!state.selectedImageDataUrl) {
    alert("메뉴판 또는 표지판 이미지를 선택하세요.");
    return;
  }

  $("analyzeImageBtn").disabled = true;
  $("analyzeImageBtn").textContent = "이미지 분석 중…";
  $("imageTranslateOutput").textContent =
    "글자와 가격을 확인하고 있습니다. 이미지에 따라 시간이 조금 걸릴 수 있습니다.";

  try {
    const data = await callEdgeFunction({
      mode: "vision",
      image: state.selectedImageDataUrl,
      trip: tripForApi(trip),
    });
    $("imageTranslateOutput").textContent =
      data.result || "이미지에서 읽을 수 있는 내용을 찾지 못했습니다.";
  } catch (error) {
    $("imageTranslateOutput").textContent = "이미지 번역 실패: " + error.message;
  } finally {
    $("analyzeImageBtn").disabled = false;
    $("analyzeImageBtn").textContent = "이미지 번역하기";
  }
}

async function fetchRate() {
  const trip = activeTrip();
  if (!trip) {
    alert("여행을 먼저 선택하세요.");
    return;
  }
  $("rateStatus").textContent = "환율을 불러오는 중입니다.";
  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(
        trip.currency,
      )}&symbols=KRW`,
    );
    const data = await response.json();
    state.rate = data.rates?.KRW;
    if (!state.rate) throw new Error("지원하지 않는 통화");
    $("rateStatus").textContent = `1 ${trip.currency} = ${state.rate.toLocaleString()} KRW · ${data.date}`;
    calcCurrency();
  } catch {
    state.rate = null;
    $("rateStatus").textContent =
      "자동 환율을 불러오지 못했습니다. 잠시 후 다시 시도하세요.";
  }
}

function calcCurrency() {
  const amount = Number($("localAmount").value || 0);
  $("krwResult").textContent = state.rate
    ? `${Math.round(amount * state.rate).toLocaleString()} 원`
    : "-- 원";
}

function updateTools() {
  const trip = activeTrip();
  $("currencyGuide").textContent = trip
    ? `${trip.city} · ${trip.currency} 자동 적용`
    : "여행을 먼저 선택하세요.";
  $("localCurrencyLabel").textContent = trip ? `${trip.currency} 금액` : "현지 금액";
  state.rate = null;
  $("krwResult").textContent = "-- 원";
}

function quickSearch(type) {
  const trip = activeTrip();
  if (!trip) {
    alert("여행을 먼저 선택하세요.");
    return;
  }
  const query = {
    weather: `${trip.city} weather`,
    map: `${trip.city} map`,
    pharmacy: `pharmacy near ${trip.city}`,
  }[type];
  if (type === "translate") {
    window.open(
      `https://translate.google.com/?sl=ko&tl=${trip.langCode}&op=translate`,
      "_blank",
    );
    return;
  }
  window.open("https://www.google.com/search?q=" + encodeURIComponent(query), "_blank");
}

function setSyncVisual(status, message) {
  const badge = $("syncBadge");
  const pill = $("syncStatePill");
  badge?.classList.remove("offline", "online", "syncing", "error");
  pill?.classList.remove("offline", "online", "syncing", "error");
  badge?.classList.add(status);
  pill?.classList.add(status);

  const labels = {
    offline: "기기 저장",
    online: "동기화 완료",
    syncing: "동기화 중",
    error: "동기화 오류",
  };
  if ($("syncBadgeText")) $("syncBadgeText").textContent = labels[status] || "동기화";
  if (pill) pill.textContent = labels[status] || "동기화";
  if (message && $("syncStatus")) $("syncStatus").textContent = message;
}

function formatSyncDate(value) {
  if (!value) return "아직 없음";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function renderSyncUI() {
  const loggedIn = Boolean(state.user);
  $("loggedOutSync")?.classList.toggle("hidden", loggedIn);
  $("loggedInSync")?.classList.toggle("hidden", !loggedIn);
  if ($("syncUserEmail")) $("syncUserEmail").textContent = state.user?.email || "-";
  if (!loggedIn) {
    setSyncVisual("offline", "로그인 전에는 이 기기에만 저장됩니다.");
  }
}

async function initSupabase() {
  const config = window.TRAVELMATE_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    setSyncVisual("offline", "Supabase 설정 전에는 이 기기에만 저장됩니다.");
    return;
  }

  state.supabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: TRAVELMATE_AUTH_STORAGE_KEY,
      },
    },
  );

  state.supabase.auth.onAuthStateChange(async (event, session) => {
    const previousUserId = state.user?.id;
    state.user = session?.user || null;

    if (state.user?.email) {
      localStorage.setItem(TRAVELMATE_AUTH_MARKER_KEY, state.user.email);
    } else {
      localStorage.removeItem(TRAVELMATE_AUTH_MARKER_KEY);
    }

    if (["SIGNED_IN", "TOKEN_REFRESHED"].includes(event) && location.hash) {
      history.replaceState(null, document.title, location.pathname + location.search);
    }

    renderSyncUI();

    if (state.user && state.user.id !== previousUserId) {
      await startRealtime();
      await initialCloudMerge();
    }
    if (!state.user) stopRealtime();
  });

  const {
    data: { session },
  } = await state.supabase.auth.getSession();
  state.user = session?.user || null;
  renderSyncUI();

  if (state.user) {
    await startRealtime();
    await initialCloudMerge();
  }
}

async function sendMagicLink() {
  if (!state.supabase) {
    alert("config.js에 Supabase 주소와 Publishable key를 입력하세요.");
    return;
  }
  const email = $("syncEmail").value.trim();
  if (!email) {
    alert("이메일을 입력하세요.");
    return;
  }

  $("sendMagicLink").disabled = true;
  setSyncVisual("syncing", "로그인 이메일을 보내는 중입니다.");
  const { error } = await state.supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  $("sendMagicLink").disabled = false;

  if (error) {
    setSyncVisual("error", error.message);
    return;
  }
  setSyncVisual(
    "offline",
    "이메일로 로그인 링크를 보냈습니다. 링크를 누른 뒤 앱으로 돌아오세요.",
  );
}

async function signOut() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  localStorage.removeItem(TRAVELMATE_AUTH_MARKER_KEY);
  state.user = null;
  stopRealtime();
  renderSyncUI();
}

async function switchAccount() {
  if (!confirm("현재 계정에서 로그아웃하고 다른 계정으로 로그인할까요?")) return;
  await signOut();
  navigate("sync");
  $("syncEmail")?.focus();
  setSyncVisual("offline", "새로 사용할 TravelMate 계정의 이메일을 입력하세요.");
}

function scheduleCloudSave() {
  if (!state.user || !state.supabase || state.applyingRemote) return;
  clearTimeout(state.syncTimer);
  setSyncVisual("syncing", "변경 내용을 자동 저장할 준비 중입니다.");
  state.syncTimer = setTimeout(() => saveCloudNow(), SYNC_DEBOUNCE_MS);
}

async function saveCloudNow() {
  if (!state.user || !state.supabase || state.syncInProgress) return;
  state.syncInProgress = true;
  setSyncVisual("syncing", "클라우드에 자동 저장 중입니다.");

  const payload = localPayload();
  const dataHash = stableHash({ trips: payload.trips, activeTripId: payload.activeTripId });

  const { error } = await state.supabase.from("travel_backups").upsert(
    {
      user_id: state.user.id,
      data: payload,
      updated_at: payload.updatedAt,
    },
    { onConflict: "user_id" },
  );

  state.syncInProgress = false;
  if (error) {
    console.error(error);
    setSyncVisual("error", "자동 저장 실패: " + error.message);
    return;
  }

  state.lastCloudHash = dataHash;
  if ($("lastSyncAt")) $("lastSyncAt").textContent = formatSyncDate(payload.updatedAt);
  setSyncVisual("online", "모든 기기에 자동 저장되었습니다.");
}

async function initialCloudMerge() {
  if (!state.user || !state.supabase) return;
  setSyncVisual("syncing", "클라우드 데이터를 확인하고 있습니다.");

  const { data, error } = await state.supabase
    .from("travel_backups")
    .select("data, updated_at")
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (error) {
    setSyncVisual("error", "동기화 불러오기 실패: " + error.message);
    return;
  }

  state.applyingRemote = true;
  if (data?.data) mergeCloudData(data.data);
  persist({ skipSync: true });
  state.applyingRemote = false;
  refreshAll();

  if ($("lastSyncAt")) $("lastSyncAt").textContent = formatSyncDate(data?.updated_at);
  await saveCloudNow();
}

async function applyRealtimePayload(remoteData, updatedAt) {
  if (!remoteData || !state.user) return;
  const remoteHash = stableHash({
    trips: remoteData.trips || [],
    activeTripId: remoteData.activeTripId || null,
  });
  if (remoteHash === state.lastCloudHash) return;

  state.applyingRemote = true;
  mergeCloudData(remoteData);
  persist({ skipSync: true });
  state.applyingRemote = false;
  state.lastCloudHash = stableHash({
    trips: state.trips,
    activeTripId: state.activeTripId,
  });
  refreshAll();
  if ($("lastSyncAt")) $("lastSyncAt").textContent = formatSyncDate(updatedAt);
  setSyncVisual("online", "다른 기기의 변경 내용을 반영했습니다.");
}

async function startRealtime() {
  if (!state.user || !state.supabase) return;
  stopRealtime();
  state.channel = state.supabase
    .channel(`travel-sync-${state.user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "travel_backups",
        filter: `user_id=eq.${state.user.id}`,
      },
      (payload) => {
        const row = payload.new;
        if (row?.data) applyRealtimePayload(row.data, row.updated_at);
      },
    )
    .subscribe();
}

function stopRealtime() {
  if (state.channel && state.supabase) {
    state.supabase.removeChannel(state.channel);
  }
  state.channel = null;
}

function toInstant(trip, schedule) {
  if (!schedule.date || !schedule.start) return new Date(8640000000000000);
  const [year, month, day] = schedule.date.split("-").map(Number);
  const [hour, minute] = schedule.start.split(":").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: trip.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(probe);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const wall = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    return new Date(probe.getTime() - (wall - probe.getTime()));
  } catch {
    return probe;
  }
}

function refreshAll() {
  renderHome();
  renderTrips();
  renderSchedules();
  updateClocks();
  updateLanguageUI();
  updateTools();
  renderSyncUI();
}

$("fontBtn").onclick = () => {
  document.body.classList.toggle("large-text");
  $("fontBtn").textContent = document.body.classList.contains("large-text")
    ? "기본 글자"
    : "글자 크게";
};
$("refreshHome").onclick = () => {
  renderHome();
  updateClocks();
};
$("newTripBtn").onclick = () => openTripEditor();
$("closeTripEditor").onclick = () => $("tripEditor").classList.add("hidden");
$("saveTripBtn").onclick = saveTrip;
$("tripCountry").onchange = applyCountryCity;
$("tripCity").onchange = applyCity;
$("newScheduleBtn").onclick = () => openScheduleEditor();
$("closeScheduleEditor").onclick = () => $("scheduleEditor").classList.add("hidden");
$("saveScheduleBtn").onclick = saveSchedule;
$("importFile").onchange = (event) => {
  if (event.target.files[0]) importSchedule(event.target.files[0]);
  event.target.value = "";
};
$("downloadSample").onclick = downloadSample;
$("toLocalBtn").onclick = () => setDirection("toLocal");
$("toKoreanBtn").onclick = () => setDirection("toKorean");
$("translateBtn").onclick = translate;
$("speakInput").onclick = speechRecognize;
$("readTranslation").onclick = readTranslation;
$("textTranslatorTab").onclick = () => showTranslatorPanel("text");
$("imageTranslatorTab").onclick = () => showTranslatorPanel("image");
$("imageTranslateFile").onchange = (event) => {
  const file = event.target.files?.[0];
  if (file) selectTranslateImage(file);
};
$("removeImageBtn").onclick = clearTranslateImage;
$("analyzeImageBtn").onclick = analyzeTranslateImage;
$("refreshRate").onclick = fetchRate;
$("localAmount").oninput = calcCurrency;
document.querySelectorAll("[data-search]").forEach((button) => {
  button.onclick = () => quickSearch(button.dataset.search);
});
$("sendMagicLink").onclick = sendMagicLink;
$("forceSyncBtn").onclick = initialCloudMerge;
$("switchAccountBtn").onclick = switchAccount;
$("signOutBtn").onclick = signOut;

load();
populateCountries();
refreshAll();
setDirection("toLocal");
showTranslatorPanel("text");
setInterval(updateClocks, 1000);
initSupabase();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
