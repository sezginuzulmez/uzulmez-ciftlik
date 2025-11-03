// ===== Storage Keys =====
const STORAGE_KEY = "uzulmezRecords";
const USERS_KEY = "uzulmezUsers";
const CURRENT_USER_KEY = "uzulmezCurrentUser";
const FAIL_KEY = "uzulmezLoginFail"; // {count, until}

// ===== Elements =====
const authSetup = document.getElementById("authSetup");
const authLogin = document.getElementById("authLogin");
const appMain = document.getElementById("appMain");
const userBadge = document.getElementById("userBadge");
const lockBtn = document.getElementById("lockBtn");

const setupForm = document.getElementById("setupForm");
const setupName = document.getElementById("setupName");
const setupPin = document.getElementById("setupPin");
const setupPin2 = document.getElementById("setupPin2");
const setupCreate = document.getElementById("setupCreate");

const loginUser = document.getElementById("loginUser");
const loginPin = document.getElementById("loginPin");
const loginBtn = document.getElementById("loginBtn");
const loginHint = document.getElementById("loginHint");

const entryForm = document.getElementById("entryForm");
const typeSel = document.getElementById("type");
const category = document.getElementById("category");
const productSelect = document.getElementById("productSelect");
const productOther = document.getElementById("productOther");
const purchaseDate = document.getElementById("purchaseDate");
const paymentDate = document.getElementById("paymentDate");
const unit = document.getElementById("unit");
const quantity = document.getElementById("quantity");
const unitPrice = document.getElementById("unitPrice");
const totalPrice = document.getElementById("totalPrice");
const paidAmount = document.getElementById("paidAmount");
const remainingAmount = document.getElementById("remainingAmount");

const search = document.getElementById("search");
const filterType = document.getElementById("filterType");
const tableBody = document.querySelector("#recordsTable tbody");
const sumIncome = document.getElementById("sumIncome");
const sumExpense = document.getElementById("sumExpense");
const sumNet = document.getElementById("sumNet");
const sumRemaining = document.getElementById("sumRemaining");
const exportCsvBtn = document.getElementById("exportCsv");
const exportJsonBtn = document.getElementById("exportJson");
const importJsonInput = document.getElementById("importJson");
const clearAllBtn = document.getElementById("clearAll");
const installBtn = document.getElementById("installBtn");
const addBtn = document.getElementById("addBtn");

const fltAll = document.getElementById("fltAll");
const fltYemGider = document.getElementById("fltYemGider");
const fltSutSatis = document.getElementById("fltSutSatis");
const fltGelir = document.getElementById("fltGelir");
const fltGider = document.getElementById("fltGider");
const fltOverdue = document.getElementById("fltOverdue");

const tplSilaj = document.getElementById("tplSilaj");
const tplSut = document.getElementById("tplSut");
const tplAkaryakit = document.getElementById("tplAkaryakit");
const tplIlac = document.getElementById("tplIlac");
const tplBakimTraktor = document.getElementById("tplBakimTraktor");

// charts
let chartMonthly = null;
let chartCategory = null;

// quick filter state
let quickFilter = "ALL"; // ALL | YEM_GIDER | SUT_SATIS | GELIR | GIDER | OVERDUE

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});
installBtn.addEventListener('click', async ()=>{
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  }
});

// ===== Helpers =====
function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (e) { return fallback; }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function loadRecords() { return loadJSON(STORAGE_KEY, []); }
function saveRecords(data) { saveJSON(STORAGE_KEY, data); }
function formatTL(n) {
  if (isNaN(n)) return "0";
  return new Intl.NumberFormat('tr-TR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function toNum(v){ const n = parseFloat(v||"0"); return isNaN(n)?0:n; }
function computeTotal(q, up) {
  q = toNum(q);
  up = toNum(up);
  return q * up;
}
function isOverdue(rec){
  if (!rec.paymentDate) return false;
  const d = new Date(rec.paymentDate);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  // compare only date part
  const dd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return rec.remainingAmount > 0 && d < dd;
}

// crypto hash
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ===== Auth Flow =====
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function getUsers() { return loadJSON(USERS_KEY, []); }
function saveUsers(u) { saveJSON(USERS_KEY, u); }
function getCurrentUser() { return loadJSON(CURRENT_USER_KEY, null); }
function setCurrentUser(u) { saveJSON(CURRENT_USER_KEY, u); }

function refreshLoginUsers() {
  const users = getUsers();
  loginUser.innerHTML = users.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join("");
}

function updateAuthViews() {
  const users = getUsers();
  const current = getCurrentUser();
  if (users.length === 0) { // first-time setup
    show(authSetup); hide(authLogin); hide(appMain);
    userBadge.textContent = "";
  } else if (!current) { // login needed
    hide(authSetup); show(authLogin); hide(appMain);
    refreshLoginUsers();
    userBadge.textContent = "";
  } else { // logged in
    hide(authSetup); hide(authLogin); show(appMain);
    userBadge.textContent = `${current.name} • ${current.role}`;
    const isAdmin = current.role === "admin";
    userMgmt.style.display = isAdmin ? "block" : "none";
    addBtn.disabled = !isAdmin;
    clearAllBtn.style.display = isAdmin ? "inline-block" : "none";
  }
}

// throttle failed attempts
function getFailState() { return loadJSON(FAIL_KEY, {count:0, until:0}); }
function setFailState(s) { saveJSON(FAIL_KEY, s); }

setupCreate.addEventListener("click", async ()=>{
  if (setupPin.value !== setupPin2.value) { alert("PIN'ler eşleşmiyor."); return; }
  if (!/^\d{4,12}$/.test(setupPin.value)) { alert("PIN 4–12 rakam olmalı."); return; }
  const users = getUsers();
  if (users.length > 0) { alert("Zaten kullanıcı var. Lütfen giriş yapın."); updateAuthViews(); return; }
  const u = {
    id: crypto.randomUUID(),
    name: setupName.value.trim() || "Yönetici",
    role: "admin",
    pinHash: await sha256(setupPin.value)
  };
  saveUsers([u]);
  setCurrentUser({id:u.id, name:u.name, role:u.role});
  setupForm.reset();
  updateAuthViews();
  render();
  alert("Yönetici oluşturuldu.");
});

loginBtn.addEventListener("click", async ()=>{
  const fail = getFailState();
  const now = Date.now();
  if (fail.until && now < fail.until) {
    const sec = Math.ceil((fail.until - now)/1000);
    loginHint.textContent = `Çok fazla deneme. ${sec} sn sonra tekrar deneyin.`;
    return;
  }
  const users = getUsers();
  const sel = users.find(u => u.id === loginUser.value);
  if (!sel) return;
  const ok = (await sha256(loginPin.value)) === sel.pinHash;
  if (ok) {
    setCurrentUser({id:sel.id, name:sel.name, role:sel.role});
    setFailState({count:0, until:0});
    loginPin.value = "";
    updateAuthViews();
    render();
  } else {
    fail.count = (fail.count || 0) + 1;
    if (fail.count >= 5) {
      fail.until = now + 30_000; // 30s lock
      fail.count = 0;
    }
    setFailState(fail);
    loginHint.textContent = "Hatalı PIN.";
  }
});

lockBtn.addEventListener("click", ()=>{
  setCurrentUser(null);
  updateAuthViews();
});

// ===== User Management (Admin only) =====
function renderUsers() {
  const users = getUsers();
  usersTableBody.innerHTML = "";
  users.forEach((u,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${u.name}</td>
      <td>${u.role}</td>
      <td>
        <button class="secondary" data-reset="${u.id}">PIN Sıfırla</button>
        <button class="danger" data-del="${u.id}">Sil</button>
      </td>
    `;
    usersTableBody.appendChild(tr);
  });
  usersTableBody.querySelectorAll("button[data-reset]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-reset");
      const pin = prompt("Yeni PIN (4–12 rakam):");
      if (!pin) return;
      if (!/^\d{4,12}$/.test(pin)) { alert("Geçersiz PIN."); return; }
      const users = getUsers();
      const u = users.find(x=>x.id===id);
      if (!u) return;
      u.pinHash = await sha256(pin);
      saveUsers(users);
      alert("PIN güncellendi.");
    });
  });
  usersTableBody.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      let users = getUsers();
      if (users.length <= 1) { alert("Son kullanıcı silinemez."); return; }
      if (!confirm("Bu kullanıcı silinsin mi?")) return;
      const current = getCurrentUser();
      users = users.filter(u=>u.id!==id);
      saveUsers(users);
      if (current && current.id === id) {
        setCurrentUser(null);
        updateAuthViews();
      }
      renderUsers();
    });
  });
}

addUserBtn.addEventListener("click", async ()=>{
  const name = (newUserName.value || "").trim();
  const role = newUserRole.value;
  const pin = newUserPin.value;
  if (!name || !/^\d{4,12}$/.test(pin)) { alert("Ad ve geçerli PIN girin."); return; }
  const users = getUsers();
  users.push({ id: crypto.randomUUID(), name, role, pinHash: await sha256(pin) });
  saveUsers(users);
  newUserName.value = ""; newUserPin.value = "";
  refreshLoginUsers();
  renderUsers();
  alert("Kullanıcı eklendi.");
});

// ===== Records (with permissions) =====
let editId = null;

// live computations
function recomputeTotals() {
  const total = computeTotal(quantity.value, unitPrice.value);
  totalPrice.value = total.toFixed(2);
  let rem = total - toNum(paidAmount.value);
  if (rem < 0) rem = 0;
  remainingAmount.value = rem.toFixed(2);
}
[quantity, unitPrice, paidAmount].forEach(el=> el.addEventListener("input", recomputeTotals));

// dynamic enable/disable for productOther
function syncProductOther(){
  const cat = category.value;
  const isYem = cat === "Yem";
  const isDiger = cat === "Diğer";
  const isOtherSelected = productSelect.value === "Diğer";
  if (isDiger) {
    productOther.disabled = false;
    return;
  }
  if (isYem) {
    productOther.disabled = !isOtherSelected;
    if (!isOtherSelected) productOther.value = "";
    return;
  }
  productOther.disabled = true;
  productOther.value = "";
}

// helpers to fill options
function setOptions(selectEl, values, defaultVal=null){
  const current = selectEl.value;
  selectEl.innerHTML = values.map(v=>`<option value="${v}">${v}</option>`).join("");
  if (defaultVal && values.includes(defaultVal)) {
    selectEl.value = defaultVal;
  } else if (values.includes(current)) {
    selectEl.value = current;
  } else {
    selectEl.value = values[0] || "";
  }
}

// Constants
const PRODUCTS_YEM = ["Saman","Silaj","Posa","Çöğenler Süt","Süt","Tariş Süt","Ödemiş Süt","Gebe Yemi","Düve Yemi","Arpa","Mısır","Soya","Bypass Yağı","Toksin Bağlayıcı","Buffer","Soda","Diğer"];
const PRODUCTS_BAKIM = ["Traktör","Yem Karma","Sağımhane","Demir","Çatı","Ev","Beyaz Eşya","Mobilya"];
const UNITS_ALL = ["kg","ton","balya","çuval","litre","adet"];

function disableSelect(selectEl){
  selectEl.innerHTML = `<option value="-">-</option>`;
  selectEl.value = "-";
  selectEl.disabled = true;
}
function enableSelect(selectEl){
  selectEl.disabled = false;
}

function applyCategoryRules(){
  const cat = category.value;

  // Default states
  enableSelect(productSelect);
  enableSelect(unit);

  // Product rules
  if (cat === "Yem") {
    setOptions(productSelect, PRODUCTS_YEM, "Silaj");
    enableSelect(productSelect);
  } else if (cat === "Bakım/Onarım") {
    setOptions(productSelect, PRODUCTS_BAKIM, PRODUCTS_BAKIM[0]);
    enableSelect(productSelect);
  } else if (cat === "Diğer") {
    disableSelect(productSelect);
  } else {
    disableSelect(productSelect);
  }

  // Unit rules
  if (cat === "Yem") {
    setOptions(unit, UNITS_ALL, "kg");
    enableSelect(unit);
  } else if (cat === "Akaryakıt" || cat === "Süt Satışı") {
    setOptions(unit, ["litre"], "litre");
    enableSelect(unit);
  } else if (cat === "İlaç" || cat === "Hayvan Satışı" || cat === "Hayvan Alımı") {
    setOptions(unit, ["adet"], "adet");
    enableSelect(unit);
  } else if (cat === "Elektrik" || cat === "İşçilik" || cat === "Bakım/Onarım" || cat === "Diğer") {
    disableSelect(unit);
  } else {
    setOptions(unit, UNITS_ALL, "kg");
    enableSelect(unit);
  }

  // Handle productOther
  if (cat === "Diğer") {
    productOther.disabled = false;
    productOther.placeholder = "Açıklama giriniz (zorunlu)";
  } else if (cat === "Yem") {
    productOther.placeholder = "Diğer seçilirse açıklama";
    syncProductOther();
  } else {
    productOther.placeholder = "Serbest metin";
    productOther.value = "";
    productOther.disabled = true;
  }

  recomputeTotals();
}

category.addEventListener("change", ()=>{
  applyCategoryRules();
});

productSelect.addEventListener("change", syncProductOther);

// initial apply
applyCategoryRules();
syncProductOther();

// ===== Templates =====
function applyTemplate(tpl){
  // set defaults then apply rules
  typeSel.value = tpl.type || "gider";
  category.value = tpl.category;
  applyCategoryRules();
  if (!productSelect.disabled && tpl.product) {
    const options = Array.from(productSelect.options).map(o=>o.value);
    productSelect.value = options.includes(tpl.product) ? tpl.product : productSelect.value;
    syncProductOther();
  }
  if (!unit.disabled && tpl.unit) {
    unit.value = tpl.unit;
  }
  quantity.value = "";
  unitPrice.value = "";
  paidAmount.value = "";
  recomputeTotals();
  quantity.focus();
}
tplSilaj.addEventListener("click", ()=> applyTemplate({type:"gider", category:"Yem", product:"Silaj", unit:"kg"}));
tplSut.addEventListener("click", ()=> applyTemplate({type:"gelir", category:"Süt Satışı", unit:"litre"}));
tplAkaryakit.addEventListener("click", ()=> applyTemplate({type:"gider", category:"Akaryakıt", unit:"litre"}));
tplIlac.addEventListener("click", ()=> applyTemplate({type:"gider", category:"İlaç", unit:"adet"}));
tplBakimTraktor.addEventListener("click", ()=> applyTemplate({type:"gider", category:"Bakım/Onarım", product:"Traktör"}));

entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const current = getCurrentUser();
  if (!current || current.role !== "admin") {
    alert("Bu işlem için yetkiniz yok.");
    return;
  }
  const cat = category.value;

  // Build chosenProduct according to rules
  let chosenProduct = "";
  if (cat === "Yem") {
    chosenProduct = productSelect.value === "Diğer" ? (productOther.value || "Diğer") : productSelect.value;
  } else if (cat === "Bakım/Onarım") {
    chosenProduct = productSelect.value || "";
  } else if (cat === "Diğer") {
    if (!productOther.value.trim()) {
      alert("Diğer kategorisi için açıklama zorunludur.");
      productOther.focus();
      return;
    }
    chosenProduct = productOther.value.trim();
  } else {
    chosenProduct = "";
  }

  const unitVal = unit.disabled ? "-" : (unit.value || "-");

  const total = computeTotal(quantity.value, unitPrice.value);
  const rec = {
    id: editId ?? crypto.randomUUID(),
    type: typeSel.value,
    category: (category.value||"").trim(),
    product: (chosenProduct||"").trim(),
    purchaseDate: purchaseDate.value || "",
    paymentDate: paymentDate.value || "",
    unit: unitVal,
    quantity: toNum(quantity.value),
    unitPrice: toNum(unitPrice.value),
    totalPrice: toNum(total),
    paidAmount: toNum(paidAmount.value),
    remainingAmount: Math.max(0, toNum(total) - toNum(paidAmount.value)),
    createdAt: Date.now()
  };

  const data = loadRecords();
  if (editId) {
    const idx = data.findIndex(x => x.id === editId);
    if (idx >= 0) data[idx] = rec;
    editId = null;
  } else {
    data.push(rec);
  }
  saveRecords(data);
  entryForm.reset();
  purchaseDate.value = new Date().toISOString().slice(0,10);
  applyCategoryRules();
  syncProductOther();
  recomputeTotals();
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
});

function onEdit(id) {
  const current = getCurrentUser();
  if (!current || current.role !== "admin") { alert("Bu işlem için yetkiniz yok."); return; }
  const data = loadRecords();
  const r = data.find(x => x.id === id);
  if (!r) return;
  editId = r.id;
  typeSel.value = r.type || "gider";
  category.value = r.category || "Diğer";
  applyCategoryRules();

  if (!productSelect.disabled) {
    const options = Array.from(productSelect.options).map(o=>o.value);
    if (r.product && options.includes(r.product)) {
      productSelect.value = r.product;
      productOther.value = "";
    } else if (r.product && category.value === "Yem") {
      productSelect.value = "Diğer";
      productOther.value = r.product;
    } else if (category.value === "Diğer") {
      productOther.value = r.product || "";
    } else if (category.value === "Bakım/Onarım" && r.product) {
      if (!options.includes(r.product)) productSelect.value = options[0];
    } else {
      productOther.value = "";
    }
    syncProductOther();
  } else {
    if (category.value !== "Diğer") productOther.value = "";
  }

  purchaseDate.value = r.purchaseDate || new Date().toISOString().slice(0,10);
  paymentDate.value = r.paymentDate || "";
  if (!unit.disabled) unit.value = r.unit && r.unit !== "-" ? r.unit : unit.value;
  quantity.value = r.quantity ?? "";
  unitPrice.value = r.unitPrice ?? "";
  paidAmount.value = r.paidAmount ?? "";
  recomputeTotals();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.onEdit = onEdit;

function onDelete(id) {
  const current = getCurrentUser();
  if (!current || current.role !== "admin") { alert("Bu işlem için yetkiniz yok."); return; }
  if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
  const data = loadRecords().filter(x => x.id !== id);
  saveRecords(data);
  render();
}
window.onDelete = onDelete;

// ===== Render & Filters =====
function setChipOn(activeBtn){
  [fltAll,fltYemGider,fltSutSatis,fltGelir,fltGider,fltOverdue].forEach(b=> b.classList.remove("chipOn"));
  activeBtn.classList.add("chipOn");
}
fltAll.addEventListener("click", ()=>{ quickFilter="ALL"; setChipOn(fltAll); render(); });
fltYemGider.addEventListener("click", ()=>{ quickFilter="YEM_GIDER"; setChipOn(fltYemGider); render(); });
fltSutSatis.addEventListener("click", ()=>{ quickFilter="SUT_SATIS"; setChipOn(fltSutSatis); render(); });
fltGelir.addEventListener("click", ()=>{ quickFilter="GELIR"; setChipOn(fltGelir); render(); });
fltGider.addEventListener("click", ()=>{ quickFilter="GIDER"; setChipOn(fltGider); render(); });
fltOverdue.addEventListener("click", ()=>{ quickFilter="OVERDUE"; setChipOn(fltOverdue); render(); });

function render() {
  const q = (search.value || "").toLowerCase();
  const fType = filterType.value;
  const data = loadRecords()
    .sort((a,b)=>b.createdAt - a.createdAt)
    .map(r=>({ // back-compat defaults
      ...r,
      category: r.category || "Diğer",
      product: r.product || "",
      paidAmount: toNum(r.paidAmount),
      remainingAmount: ("remainingAmount" in r) ? toNum(r.remainingAmount) : Math.max(0, toNum(r.totalPrice)-toNum(r.paidAmount))
    }))
    .filter(r => {
      const haystack = [r.product, r.type, r.purchaseDate, r.paymentDate, r.category].join(" ").toLowerCase();
      const matchQuery = haystack.includes(q);
      const matchType = fType === "hepsi" ? true : r.type === fType;
      // quick filters
      let matchQuick = true;
      if (quickFilter === "YEM_GIDER") matchQuick = (r.type==="gider" && r.category==="Yem");
      else if (quickFilter === "SUT_SATIS") matchQuick = (r.type==="gelir" && r.category==="Süt Satışı");
      else if (quickFilter === "GELIR") matchQuick = (r.type==="gelir");
      else if (quickFilter === "GIDER") matchQuick = (r.type==="gider");
      else if (quickFilter === "OVERDUE") matchQuick = isOverdue(r);
      return matchQuery && matchType && matchQuick;
    });

  let income = 0, expense = 0, remaining = 0;
  tableBody.innerHTML = "";
  const current = getCurrentUser();
  const isAdmin = current && current.role === "admin";
  data.forEach((r, i) => {
    if (r.type === "gelir") income += (r.totalPrice || 0);
    if (r.type === "gider") expense += (r.totalPrice || 0);
    remaining += (r.remainingAmount || 0);

    const tr = document.createElement("tr");
    if (isOverdue(r)) tr.classList.add("overdue");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td><span class="badge ${r.type}">${r.type}</span></td>
      <td>${r.category || "-"}</td>
      <td>${r.product || "-"}</td>
      <td>${r.purchaseDate || "-"}</td>
      <td>${r.paymentDate || "-"}</td>
      <td>${r.unit || "-"}</td>
      <td>${r.quantity ?? "-"}</td>
      <td>${r.unitPrice ? formatTL(r.unitPrice) : "-"}</td>
      <td>${r.totalPrice ? formatTL(r.totalPrice) : "-"}</td>
      <td>${r.paidAmount ? formatTL(r.paidAmount) : "-"}</td>
      <td>${r.remainingAmount ? formatTL(r.remainingAmount) : "-"}</td>
      <td>
        ${isAdmin ? `<button onclick="onEdit('${r.id}')" class="secondary">Düzenle</button>
        <button onclick="onDelete('${r.id}')" class="danger">Sil</button>` : `<span class="muted">-</span>`}
      </td>
    `;
    tableBody.appendChild(tr);
  });

  sumIncome.textContent = formatTL(income);
  sumExpense.textContent = formatTL(expense);
  sumNet.textContent = formatTL(income - expense);
  sumRemaining.textContent = formatTL(remaining);

  // charts
  renderCharts(data);
  if (userMgmt.style.display !== "none") renderUsers();
}

// ===== Charts =====
function monthKey(dateStr) {
  if (!dateStr) return "0000-00";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "0000-00";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function renderCharts(rows){
  const monthly = {};
  rows.forEach(r=>{
    const key = monthKey(r.purchaseDate || r.paymentDate);
    if (!monthly[key]) monthly[key] = {gelir:0, gider:0};
    if (r.type === "gelir") monthly[key].gelir += (r.totalPrice||0);
    if (r.type === "gider") monthly[key].gider += (r.totalPrice||0);
  });
  const months = Object.keys(monthly).filter(k=>k!=="0000-00").sort();
  const gelirArr = months.map(m=>monthly[m].gelir);
  const giderArr = months.map(m=>monthly[m].gider);

  const ctxM = document.getElementById("chartMonthly").getContext("2d");
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctxM, {
    type: "bar",
    data: { labels: months, datasets: [
      { label: "Gelir", data: gelirArr },
      { label: "Gider", data: giderArr }
    ]},
    options: {
      responsive:true,
      plugins:{ legend:{ position:"top" }, title:{ display:true, text:"Aylık Gelir-Gider" } },
      scales:{ y:{ beginAtZero:true } }
    }
  });

  const byCat = {};
  rows.filter(r=>r.type==="gider").forEach(r=>{
    const k = (r.category||"Diğer");
    byCat[k] = (byCat[k]||0) + (r.totalPrice||0);
  });
  const catLabels = Object.keys(byCat);
  const catValues = catLabels.map(k=>byCat[k]);
  const ctxC = document.getElementById("chartCategory").getContext("2d");
  if (chartCategory) chartCategory.destroy();
  chartCategory = new Chart(ctxC, {
    type: "doughnut",
    data: { labels: catLabels, datasets: [{ data: catValues }] },
    options: {
      responsive:true,
      plugins:{ legend:{ position:"right" }, title:{ display:true, text:"Gider Kalem Dağılımı" } }
    }
  });
}

// PWA Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

// Initial auth check
updateAuthViews();
if (getCurrentUser()) render();
