
const STORAGE_KEY="travelmate_ai_v1";
const state={trips:[],activeTripId:null,direction:"toLocal",rate:null,supabase:null};

const $=id=>document.getElementById(id);
const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    state.trips=Array.isArray(saved.trips)?saved.trips:[];
    state.activeTripId=saved.activeTripId||state.trips[0]?.id||null;
  }catch{}
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify({trips:state.trips,activeTripId:state.activeTripId}))}
function activeTrip(){return state.trips.find(t=>t.id===state.activeTripId)||null}
function countryInfo(name){return window.TRAVELMATE_COUNTRIES?.[name]||null}

function navigate(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  $(page+"Page")?.classList.add("active");
  document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.go===page));
  if(page==="schedule")renderSchedules();
  if(page==="trips")renderTrips();
  if(page==="translate")updateLanguageUI();
  if(page==="tools")updateTools();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]")?.dataset.go;
  if(go)navigate(go);
});

function renderHome(){
  const t=activeTrip();
  $("homeTripName").textContent=t?t.name:"등록된 여행이 없습니다";
  $("homeTripMeta").textContent=t?`${t.country} · ${t.city} · ${t.currency}`:"여행을 먼저 등록해 주세요.";
  const next=t?.schedules?.map(s=>({...s,instant:toInstant(t,s)})).filter(s=>s.instant>new Date()).sort((a,b)=>a.instant-b.instant)[0];
  $("nextTitle").textContent=next?.title||"일정이 없습니다";
  $("nextMeta").textContent=next?`${next.date} ${next.start||""} · ${next.place||""}`:"일정을 등록해 주세요.";
}

function updateClocks(){
  const now=new Date(),t=activeTrip();
  const fmt=(tz,opt)=>new Intl.DateTimeFormat("ko-KR",{timeZone:tz,...opt}).format(now);
  $("koreaClock").textContent=fmt("Asia/Seoul",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
  $("koreaDate").textContent=fmt("Asia/Seoul",{year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"});
  const tz=t?.timezone||"Asia/Seoul";
  $("localClock").textContent=fmt(tz,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
  $("localDate").textContent=t?`${t.city} · ${fmt(tz,{year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"})}`:"여행지 미선택";
}

function renderTrips(){
  const box=$("tripList");
  if(!state.trips.length){box.innerHTML='<div class="muted">등록된 여행이 없습니다. “새 여행”을 눌러 주세요.</div>';return}
  box.innerHTML=state.trips.map(t=>`
    <article class="trip-item ${t.id===state.activeTripId?"active":""}">
      <div><h3>${esc(t.name)}</h3><p>${esc(t.country)} · ${esc(t.city)} · ${esc(t.currency)} · ${esc(t.timezone)}</p><p>${esc(t.start||"")} ~ ${esc(t.end||"")}</p></div>
      <div class="item-actions">
        ${t.id!==state.activeTripId?`<button class="primary" data-trip-select="${t.id}">선택</button>`:""}
        <button class="small-btn" data-trip-edit="${t.id}">수정</button>
        <button class="small-btn danger" data-trip-delete="${t.id}">삭제</button>
      </div>
    </article>`).join("");
  box.querySelectorAll("[data-trip-select]").forEach(b=>b.onclick=()=>{state.activeTripId=b.dataset.tripSelect;persist();refreshAll();});
  box.querySelectorAll("[data-trip-edit]").forEach(b=>b.onclick=()=>openTripEditor(b.dataset.tripEdit));
  box.querySelectorAll("[data-trip-delete]").forEach(b=>b.onclick=()=>deleteTrip(b.dataset.tripDelete));
}
function populateCountries(){
  $("tripCountry").innerHTML='<option value="">국가 선택</option>'+Object.keys(TRAVELMATE_COUNTRIES).map(c=>`<option>${c}</option>`).join("");
}
function populateCities(country,selected=""){
  const info=countryInfo(country);
  $("tripCity").innerHTML='<option value="">도시 선택</option>'+Object.keys(info?.cities||{}).map(c=>`<option ${c===selected?"selected":""}>${c}</option>`).join("");
}
function applyCountryCity(){
  const info=countryInfo($("tripCountry").value);
  populateCities($("tripCountry").value);
  $("tripCurrency").value=info?.currency||"";
  $("tripLanguage").value=info?.language||"";
  $("tripTimezone").innerHTML='<option value="">시간대 선택</option>';
}
function applyCity(){
  const info=countryInfo($("tripCountry").value),city=$("tripCity").value;
  const tz=info?.cities?.[city]||"";
  $("tripTimezone").innerHTML=Object.values(info?.cities||{}).filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<option ${v===tz?"selected":""}>${v}</option>`).join("");
}
function openTripEditor(id=""){
  const t=id?state.trips.find(x=>x.id===id):null;
  $("tripEditor").classList.remove("hidden");
  $("tripEditorTitle").textContent=id?"여행 수정":"새 여행 등록";
  $("tripId").value=t?.id||"";
  $("tripName").value=t?.name||"";
  $("tripCountry").value=t?.country||"";
  populateCities(t?.country||"",t?.city||"");
  $("tripCity").value=t?.city||"";
  $("tripCurrency").value=t?.currency||"";
  $("tripLanguage").value=t?.language||"";
  $("tripTimezone").innerHTML=t?.timezone?`<option>${t.timezone}</option>`:'<option value="">시간대 선택</option>';
  $("tripStart").value=t?.start||"";
  $("tripEnd").value=t?.end||"";
  $("tripEditor").scrollIntoView({behavior:"smooth"});
}
function saveTrip(){
  const info=countryInfo($("tripCountry").value),id=$("tripId").value||uid("trip");
  const trip={
    id,name:$("tripName").value.trim(),country:$("tripCountry").value,city:$("tripCity").value,
    currency:$("tripCurrency").value,timezone:$("tripTimezone").value,language:$("tripLanguage").value,
    langCode:info?.langCode||"en",speech:info?.speech||"en-US",
    start:$("tripStart").value,end:$("tripEnd").value,
    schedules:state.trips.find(t=>t.id===id)?.schedules||[]
  };
  if(!trip.name||!trip.country||!trip.city||!trip.timezone)return alert("여행 이름, 국가, 도시, 시간대를 모두 선택하세요.");
  const i=state.trips.findIndex(t=>t.id===id);
  if(i>=0)state.trips[i]=trip;else state.trips.unshift(trip);
  state.activeTripId=id;persist();$("tripEditor").classList.add("hidden");refreshAll();alert("여행을 저장했습니다.");
}
function deleteTrip(id){
  const t=state.trips.find(x=>x.id===id);if(!t||!confirm(`"${t.name}" 여행을 삭제할까요?`))return;
  state.trips=state.trips.filter(x=>x.id!==id);if(state.activeTripId===id)state.activeTripId=state.trips[0]?.id||null;persist();refreshAll();
}

function renderSchedules(){
  const t=activeTrip();$("scheduleTripName").textContent=t?`${t.name} 일정`:"여행을 먼저 선택하세요.";
  const list=t?.schedules||[],box=$("scheduleList");
  if(!t){box.innerHTML='<div class="muted">여행을 먼저 등록해 주세요.</div>';return}
  if(!list.length){box.innerHTML='<div class="muted">등록된 일정이 없습니다. 직접 추가하거나 파일을 업로드하세요.</div>';return}
  box.innerHTML=[...list].sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)).map(s=>`
    <article class="schedule-item">
      <div><h3>${esc(s.title)}</h3><p>${esc(s.date)} ${esc(s.start||"")}${s.end?" ~ "+esc(s.end):""} · ${esc(s.place||"")}</p><p>${esc(s.note||"")}</p></div>
      <div class="item-actions"><button class="small-btn" data-sch-edit="${s.id}">수정</button><button class="small-btn danger" data-sch-delete="${s.id}">삭제</button></div>
    </article>`).join("");
  box.querySelectorAll("[data-sch-edit]").forEach(b=>b.onclick=()=>openScheduleEditor(b.dataset.schEdit));
  box.querySelectorAll("[data-sch-delete]").forEach(b=>b.onclick=()=>deleteSchedule(b.dataset.schDelete));
}
function openScheduleEditor(id=""){
  const t=activeTrip();if(!t)return alert("여행을 먼저 선택하세요.");
  const s=id?t.schedules.find(x=>x.id===id):null;
  $("scheduleEditor").classList.remove("hidden");$("scheduleEditorTitle").textContent=id?"일정 수정":"일정 추가";
  $("scheduleId").value=s?.id||"";$("scheduleDate").value=s?.date||t.start||"";$("scheduleStart").value=s?.start||"09:00";$("scheduleEnd").value=s?.end||"";
  $("scheduleTitle").value=s?.title||"";$("schedulePlace").value=s?.place||"";$("scheduleCategory").value=s?.category||"관광";$("scheduleNote").value=s?.note||"";
  $("scheduleEditor").scrollIntoView({behavior:"smooth"});
}
function saveSchedule(){
  const t=activeTrip();if(!t)return;
  const id=$("scheduleId").value||uid("schedule"),s={id,date:$("scheduleDate").value,start:$("scheduleStart").value,end:$("scheduleEnd").value,title:$("scheduleTitle").value.trim(),place:$("schedulePlace").value.trim(),category:$("scheduleCategory").value,note:$("scheduleNote").value.trim()};
  if(!s.date||!s.title)return alert("날짜와 일정명을 입력하세요.");
  const i=t.schedules.findIndex(x=>x.id===id);if(i>=0)t.schedules[i]=s;else t.schedules.push(s);
  persist();$("scheduleEditor").classList.add("hidden");renderSchedules();renderHome();
}
function deleteSchedule(id){const t=activeTrip();if(!t||!confirm("이 일정을 삭제할까요?"))return;t.schedules=t.schedules.filter(x=>x.id!==id);persist();renderSchedules();renderHome()}

function normalizeRow(row){
  const pick=(...k)=>{for(const x of k)if(row[x]!==undefined&&row[x]!=="")return String(row[x]).trim();return""};
  return {id:uid("import"),date:pick("날짜","Date","date"),start:pick("시작시간","시작","Start","start"),end:pick("종료시간","종료","End","end"),title:pick("일정명","일정","제목","Title","title"),place:pick("장소","Place","place"),category:pick("분류","Category","category")||"기타",note:pick("메모","비고","Note","note")};
}
async function importSchedule(file){
  const t=activeTrip();if(!t)return alert("여행을 먼저 선택하세요.");
  try{
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:""});
    const items=rows.map(normalizeRow).filter(x=>x.date&&x.title);if(!items.length)return alert("날짜와 일정명 컬럼을 확인하세요.");
    t.schedules.push(...items);persist();renderSchedules();renderHome();alert(`${items.length}개 일정을 등록했습니다.`);
  }catch(e){alert("파일을 읽지 못했습니다: "+e.message)}
}
function downloadSample(){
  const csv="\ufeff날짜,시작시간,종료시간,일정명,장소,분류,메모\n2027-05-01,09:00,11:00,루브르 박물관,Louvre Museum,관광,예약시간 확인";
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="TravelMate_일정_샘플.csv";a.click();URL.revokeObjectURL(a.href);
}

function updateLanguageUI(){
  const t=activeTrip(),lang=t?.language||"현지어";$("languageGuide").textContent=t?`${t.country} 여행: 한국어 ↔ ${lang} 통역`:"여행을 먼저 선택하세요.";
}
function setDirection(dir){state.direction=dir;$("toLocalBtn").classList.toggle("active",dir==="toLocal");$("toKoreanBtn").classList.toggle("active",dir==="toKorean")}
async function translate(){
  const t=activeTrip(),text=$("translateInput").value.trim();if(!t||!text)return alert("여행과 번역할 문장을 확인하세요.");
  const source=state.direction==="toLocal"?"ko":t.langCode,target=state.direction==="toLocal"?t.langCode:"ko";
  const cfg=window.TRAVELMATE_CONFIG||{};
  if(cfg.supabaseFunctionUrl){
    try{
      const headers={"Content-Type":"application/json"};
      if(cfg.supabaseAnonKey){headers.apikey=cfg.supabaseAnonKey;headers.Authorization=`Bearer ${cfg.supabaseAnonKey}`}
      const r=await fetch(cfg.supabaseFunctionUrl,{method:"POST",headers,body:JSON.stringify({text,source,target,mode:"translate"})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"번역 실패");$("translateOutput").textContent=d.translatedText||d.result||"";return;
    }catch(e){$("translateOutput").textContent="AI 번역 연결 실패: "+e.message;return}
  }
  const url=`https://translate.google.com/?sl=${source}&tl=${target}&text=${encodeURIComponent(text)}&op=translate`;window.open(url,"_blank");$("translateOutput").textContent="Google 번역을 새 창에서 열었습니다.";
}
function speechRecognize(){
  const t=activeTrip(),Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Ctor)return alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
  const r=new Ctor();r.lang=state.direction==="toLocal"?"ko-KR":(t?.speech||"en-US");r.interimResults=false;r.onresult=e=>$("translateInput").value=e.results[0][0].transcript;r.onerror=()=>alert("음성을 인식하지 못했습니다.");r.start();
}
function readTranslation(){
  const t=activeTrip(),text=$("translateOutput").textContent;if(!text)return;
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=state.direction==="toLocal"?(t?.speech||"en-US"):"ko-KR";speechSynthesis.speak(u);
}

async function fetchRate(){
  const t=activeTrip();if(!t)return alert("여행을 먼저 선택하세요.");
  $("rateStatus").textContent="환율을 불러오는 중입니다.";
  try{
    const r=await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(t.currency)}&symbols=KRW`);
    const d=await r.json();state.rate=d.rates?.KRW;if(!state.rate)throw new Error("지원하지 않는 통화");
    $("rateStatus").textContent=`1 ${t.currency} = ${state.rate.toLocaleString()} KRW · ${d.date}`;calcCurrency();
  }catch(e){state.rate=null;$("rateStatus").textContent="자동 환율을 불러오지 못했습니다. 잠시 후 다시 시도하세요."}
}
function calcCurrency(){const amount=Number($("localAmount").value||0);$("krwResult").textContent=state.rate?`${Math.round(amount*state.rate).toLocaleString()} 원`:"-- 원"}
function updateTools(){const t=activeTrip();$("currencyGuide").textContent=t?`${t.city} · ${t.currency} 자동 적용`:"여행을 먼저 선택하세요.";$("localCurrencyLabel").textContent=t?`${t.currency} 금액`:"현지 금액";state.rate=null;$("krwResult").textContent="-- 원";}
function quickSearch(type){
  const t=activeTrip();if(!t)return alert("여행을 먼저 선택하세요.");
  const q={weather:`${t.city} weather`,map:`${t.city} map`,pharmacy:`pharmacy near ${t.city}`}[type];
  if(type==="translate"){window.open(`https://translate.google.com/?sl=ko&tl=${t.langCode}&op=translate`,"_blank");return}
  window.open("https://www.google.com/search?q="+encodeURIComponent(q),"_blank");
}

function initSupabase(){
  const cfg=window.TRAVELMATE_CONFIG||{};
  if(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase){state.supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);$("syncStatus").textContent="Supabase 연결 설정이 준비되었습니다."}
}
async function sendMagicLink(){
  if(!state.supabase)return alert("config.js에 Supabase 주소와 anon key를 입력하세요.");
  const email=$("syncEmail").value.trim();if(!email)return alert("이메일을 입력하세요.");
  const {error}=await state.supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
  $("syncStatus").textContent=error?error.message:"이메일로 로그인 링크를 보냈습니다.";
}
async function cloudSave(){
  if(!state.supabase)return alert("Supabase 설정이 필요합니다.");
  const {data:{user}}=await state.supabase.auth.getUser();if(!user)return alert("이메일 로그인 후 이용하세요.");
  const payload={user_id:user.id,data:{trips:state.trips,activeTripId:state.activeTripId},updated_at:new Date().toISOString()};
  const {error}=await state.supabase.from("travel_backups").upsert(payload,{onConflict:"user_id"});
  $("syncStatus").textContent=error?error.message:"클라우드에 저장했습니다.";
}
async function cloudLoad(){
  if(!state.supabase)return alert("Supabase 설정이 필요합니다.");
  const {data:{user}}=await state.supabase.auth.getUser();if(!user)return alert("이메일 로그인 후 이용하세요.");
  const {data,error}=await state.supabase.from("travel_backups").select("data").eq("user_id",user.id).single();
  if(error)return $("syncStatus").textContent=error.message;
  state.trips=data.data?.trips||[];state.activeTripId=data.data?.activeTripId||state.trips[0]?.id||null;persist();refreshAll();$("syncStatus").textContent="클라우드 데이터를 불러왔습니다.";
}

function toInstant(t,s){
  if(!s.date||!s.start)return new Date(8640000000000000);
  const [y,m,d]=s.date.split("-").map(Number),[hh,mm]=s.start.split(":").map(Number);
  const probe=new Date(Date.UTC(y,m-1,d,hh,mm));
  try{
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:t.timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(probe);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const wall=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
    return new Date(probe.getTime()-(wall-probe.getTime()));
  }catch{return probe}
}
function refreshAll(){renderHome();renderTrips();renderSchedules();updateClocks();updateLanguageUI();updateTools()}

$("fontBtn").onclick=()=>{document.body.classList.toggle("large-text");$("fontBtn").textContent=document.body.classList.contains("large-text")?"기본 글자":"글자 크게"};
$("refreshHome").onclick=()=>{renderHome();updateClocks()};
$("newTripBtn").onclick=()=>openTripEditor();$("closeTripEditor").onclick=()=>$("tripEditor").classList.add("hidden");$("saveTripBtn").onclick=saveTrip;
$("tripCountry").onchange=applyCountryCity;$("tripCity").onchange=applyCity;
$("newScheduleBtn").onclick=()=>openScheduleEditor();$("closeScheduleEditor").onclick=()=>$("scheduleEditor").classList.add("hidden");$("saveScheduleBtn").onclick=saveSchedule;
$("importFile").onchange=e=>{if(e.target.files[0])importSchedule(e.target.files[0]);e.target.value=""};$("downloadSample").onclick=downloadSample;
$("toLocalBtn").onclick=()=>setDirection("toLocal");$("toKoreanBtn").onclick=()=>setDirection("toKorean");$("translateBtn").onclick=translate;$("speakInput").onclick=speechRecognize;$("readTranslation").onclick=readTranslation;
$("refreshRate").onclick=fetchRate;$("localAmount").oninput=calcCurrency;document.querySelectorAll("[data-search]").forEach(b=>b.onclick=()=>quickSearch(b.dataset.search));
$("sendMagicLink").onclick=sendMagicLink;$("uploadCloud").onclick=cloudSave;$("downloadCloud").onclick=cloudLoad;

load();populateCountries();initSupabase();refreshAll();setInterval(updateClocks,1000);
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js");
