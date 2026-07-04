const DEFAULT_PROFIT_PER_LOAD = 250;
const OWNER_PIN = "2468";
const STORAGE_KEY = "haul-ledger-v4";
const LEGACY_STORAGE_KEYS = ["haul-ledger-v3", "haul-ledger-v2", "haul-ledger-v1"];
const SESSION_KEY = "haul-ledger-session-v1";

const expenseTypes = ["Fuel", "DEF", "Tolls", "Repairs", "Washout", "Other"];
const seedData = {
  drivers: [
    { id: "d1", name: "Ray Morgan", token: "RAY-4821" },
    { id: "d2", name: "Jess Carter", token: "JESS-7394" },
    { id: "d3", name: "Mike Allen", token: "MIKE-1568" }
  ],
  trucks: [
    { id: "t1", name: "Truck 12" },
    { id: "t2", name: "Truck 18" },
    { id: "t3", name: "Truck 22" }
  ],
  jobs: [
    {
      id: "j1",
      date: todayISO(),
      name: "Rock - North pad",
      route: "Bluegrass Quarry to North pad",
      driverId: "d1",
      truckId: "t1",
      loads: 4,
      profitPerLoad: DEFAULT_PROFIT_PER_LOAD
    },
    {
      id: "j2",
      date: todayISO(),
      name: "Fill dirt - Lot 8",
      route: "Yard to Lot 8",
      driverId: "d2",
      truckId: "t2",
      loads: 3,
      profitPerLoad: DEFAULT_PROFIT_PER_LOAD
    }
  ],
  expenses: [
    { id: "e1", date: todayISO(), jobId: "j1", driverId: "d1", truckId: "t1", type: "Fuel", amount: 200, note: "Morning fill" }
  ],
  timeEntries: [
    { id: "m1", date: todayISO(), jobId: "j1", driverId: "d1", start: "07:00", end: "15:30" }
  ]
};

let state = loadState();
let session = loadSession();

const els = {
  body: document.body,
  pageTitle: document.querySelector("#pageTitle"),
  interfaceGate: document.querySelector("#interfaceGate"),
  ownerLoginForm: document.querySelector("#ownerLoginForm"),
  ownerPin: document.querySelector("#ownerPin"),
  driverLoginForm: document.querySelector("#driverLoginForm"),
  driverToken: document.querySelector("#driverToken"),
  switchInterfaceButton: document.querySelector("#switchInterfaceButton"),
  workDate: document.querySelector("#workDate"),
  ownerView: document.querySelector("#ownerView"),
  driverView: document.querySelector("#driverView"),
  summaryGrid: document.querySelector("#summaryGrid"),
  jobList: document.querySelector("#jobList"),
  expenseList: document.querySelector("#expenseList"),
  breakdownList: document.querySelector("#breakdownList"),
  driverForm: document.querySelector("#driverForm"),
  driverNameInput: document.querySelector("#driverNameInput"),
  driverList: document.querySelector("#driverList"),
  driverSummary: document.querySelector("#driverSummary"),
  assignedJobs: document.querySelector("#assignedJobs"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseJob: document.querySelector("#expenseJob"),
  expenseType: document.querySelector("#expenseType"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseNote: document.querySelector("#expenseNote"),
  timeForm: document.querySelector("#timeForm"),
  timeJob: document.querySelector("#timeJob"),
  timeStart: document.querySelector("#timeStart"),
  timeEnd: document.querySelector("#timeEnd"),
  addJobButton: document.querySelector("#addJobButton"),
  jobDialog: document.querySelector("#jobDialog"),
  jobForm: document.querySelector("#jobForm"),
  jobDialogTitle: document.querySelector("#jobDialogTitle"),
  jobId: document.querySelector("#jobId"),
  jobName: document.querySelector("#jobName"),
  jobRoute: document.querySelector("#jobRoute"),
  jobDriver: document.querySelector("#jobDriver"),
  jobTruck: document.querySelector("#jobTruck"),
  jobLoads: document.querySelector("#jobLoads"),
  jobProfitPerLoad: document.querySelector("#jobProfitPerLoad"),
  saveJobButton: document.querySelector("#saveJobButton"),
  toast: document.querySelector("#toast")
};

boot();

function boot() {
  els.workDate.value = todayISO();
  fillStaticSelects();
  bindEvents();
  render();
  registerServiceWorker();
}

function bindEvents() {
  els.ownerLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (els.ownerPin.value !== OWNER_PIN) {
      showToast("Wrong owner PIN");
      return;
    }

    session = { mode: "owner", driverId: "" };
    saveSession();
    els.ownerPin.value = "";
    render();
  });

  els.driverLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const driver = findDriverByToken(els.driverToken.value);
    if (!driver) {
      showToast("Token not found");
      return;
    }

    session = { mode: "driver", driverId: driver.id };
    saveSession();
    els.driverToken.value = "";
    render();
  });

  els.switchInterfaceButton.addEventListener("click", () => {
    session = { mode: "", driverId: "" };
    saveSession();
    render();
  });

  els.workDate.addEventListener("change", render);
  els.addJobButton.addEventListener("click", () => openJobDialog());
  els.jobForm.addEventListener("submit", saveJob);
  els.driverForm.addEventListener("submit", saveDriver);
  els.expenseForm.addEventListener("submit", saveExpense);
  els.timeForm.addEventListener("submit", saveTime);
}

function fillStaticSelects() {
  fillSelect(els.jobDriver, state.drivers, "name");
  fillSelect(els.jobTruck, state.trucks, "name");
  fillSelect(els.expenseType, expenseTypes.map((type) => ({ id: type, name: type })), "name");
}

function render() {
  const selectedDate = els.workDate.value || todayISO();
  const selectedDriverId = session.driverId || state.drivers[0]?.id;
  const mode = session.mode;

  els.interfaceGate.classList.toggle("active", !mode);
  els.ownerView.classList.toggle("active", mode === "owner");
  els.driverView.classList.toggle("active", mode === "driver");
  els.switchInterfaceButton.hidden = !mode;
  els.body.classList.toggle("gate-mode", !mode);
  els.body.classList.toggle("driver-mode", mode === "driver");
  els.body.classList.toggle("owner-mode", mode === "owner");
  els.pageTitle.textContent = mode === "owner" ? "Daily Net" : mode === "driver" ? driverName(selectedDriverId) : "Choose App";

  clearViews();

  if (mode === "owner") {
    renderOwner(selectedDate);
  }

  if (mode === "driver") {
    renderDriver(selectedDate, selectedDriverId);
  }
}

function renderOwner(date) {
  const jobs = jobsForDate(date);
  const expenses = expensesForDate(date);
  const grossProfit = jobs.reduce((sum, job) => sum + job.loads * job.profitPerLoad, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const net = grossProfit - totalExpenses;
  const loads = jobs.reduce((sum, job) => sum + job.loads, 0);

  els.summaryGrid.innerHTML = [
    metric("Gross Profit", money(grossProfit), "green"),
    metric("Expenses", money(totalExpenses), "amber"),
    metric("Net", money(net), "net"),
    metric("Loads", loads.toString(), "blue")
  ].join("");

  els.jobList.innerHTML = jobs.length ? jobs.map(jobCard).join("") : empty("No jobs for this date.");
  els.expenseList.innerHTML = expenses.length ? expenses.map(expenseCard).join("") : empty("No expenses entered.");
  els.breakdownList.innerHTML = renderBreakdown(jobs, expenses);
  els.driverList.innerHTML = state.drivers.length ? state.drivers.map(driverCard).join("") : empty("No drivers yet.");

  els.jobList.querySelectorAll("[data-edit-job]").forEach((button) => {
    button.addEventListener("click", () => openJobDialog(button.dataset.editJob));
  });
  els.driverList.querySelectorAll("[data-copy-token]").forEach((button) => {
    button.addEventListener("click", () => copyDriverToken(button.dataset.copyToken));
  });
  els.driverList.querySelectorAll("[data-regenerate-token]").forEach((button) => {
    button.addEventListener("click", () => regenerateDriverToken(button.dataset.regenerateToken));
  });
}

function renderDriver(date, driverId) {
  const jobs = jobsForDate(date).filter((job) => job.driverId === driverId);
  const expenses = expensesForDate(date).filter((expense) => expense.driverId === driverId);
  const times = state.timeEntries.filter((entry) => entry.date === date && entry.driverId === driverId);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const hours = times.reduce((sum, entry) => sum + hoursBetween(entry.start, entry.end), 0);

  els.driverSummary.innerHTML = `
    <div class="card-top">
      <div>
        <h2>${driverName(driverId)}</h2>
        <p class="meta">${jobs.length} assigned job${jobs.length === 1 ? "" : "s"} today</p>
      </div>
      <span class="pill amber">${money(totalExpenses)}</span>
    </div>
    <div class="pill-row">
      <span class="pill blue">${hours.toFixed(1)} hr</span>
      <span class="pill">${expenses.length} expense${expenses.length === 1 ? "" : "s"}</span>
    </div>
  `;

  els.assignedJobs.innerHTML = jobs.length ? jobs.map(driverJobCard).join("") : empty("No assigned jobs for this driver.");
  fillJobSelect(els.expenseJob, jobs);
  fillJobSelect(els.timeJob, jobs);
}

function renderBreakdown(jobs, expenses) {
  if (!jobs.length) return empty("No net breakdown yet.");

  return jobs.map((job) => {
    const jobExpenses = expenses.filter((expense) => expense.jobId === job.id);
    const cost = jobExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const gross = job.loads * job.profitPerLoad;
    const net = gross - cost;

    return `
      <article class="breakdown-card">
        <div class="card-top">
          <div>
            <h3>${escapeHTML(job.name)}</h3>
            <p class="meta">${driverName(job.driverId)} · ${truckName(job.truckId)}</p>
          </div>
          <strong>${money(net)}</strong>
        </div>
        <div class="pill-row">
          <span class="pill green">${money(gross)} gross</span>
          <span class="pill amber">${money(cost)} costs</span>
          <span class="pill blue">${job.loads} loads</span>
        </div>
      </article>
    `;
  }).join("");
}

function jobCard(job) {
  const expenses = expensesForDate(job.date).filter((expense) => expense.jobId === job.id);
  const cost = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const gross = job.loads * job.profitPerLoad;

  return `
    <article class="job-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(job.name)}</h3>
          <p class="meta">${escapeHTML(job.route || "No route")} · ${driverName(job.driverId)} · ${truckName(job.truckId)}</p>
        </div>
        <strong>${money(gross - cost)}</strong>
      </div>
      <div class="pill-row">
        <span class="pill blue">${job.loads} loads</span>
        <span class="pill green">${money(job.profitPerLoad)}/load</span>
        <span class="pill amber">${money(cost)} costs</span>
      </div>
      <div class="card-actions">
        <button class="secondary-button" type="button" data-edit-job="${job.id}">Edit</button>
      </div>
    </article>
  `;
}

function driverJobCard(job) {
  const times = state.timeEntries.filter((entry) => entry.jobId === job.id);
  const hours = times.reduce((sum, entry) => sum + hoursBetween(entry.start, entry.end), 0);

  return `
    <article class="job-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(job.name)}</h3>
          <p class="meta">${escapeHTML(job.route || "No route")} · ${truckName(job.truckId)}</p>
        </div>
        <span class="pill blue">${job.loads} loads</span>
      </div>
      <div class="pill-row">
        <span class="pill">${hours.toFixed(1)} hr logged</span>
      </div>
    </article>
  `;
}

function expenseCard(expense) {
  const job = state.jobs.find((item) => item.id === expense.jobId);
  return `
    <article class="expense-card">
      <div class="card-top">
        <div>
          <h3>${expense.type}</h3>
          <p class="meta">${job ? escapeHTML(job.name) : "Unassigned"} · ${driverName(expense.driverId)} · ${truckName(expense.truckId)}</p>
          ${expense.note ? `<p class="tiny">${escapeHTML(expense.note)}</p>` : ""}
        </div>
        <strong>${money(expense.amount)}</strong>
      </div>
    </article>
  `;
}

function driverCard(driver) {
  const assignedJobs = state.jobs.filter((job) => job.driverId === driver.id).length;
  return `
    <article class="driver-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(driver.name)}</h3>
          <p class="meta">${assignedJobs} assigned job${assignedJobs === 1 ? "" : "s"}</p>
        </div>
        <code class="token-code">${escapeHTML(driver.token)}</code>
      </div>
      <div class="card-actions">
        <button class="secondary-button" type="button" data-copy-token="${driver.id}">Copy Token</button>
        <button class="danger-button" type="button" data-regenerate-token="${driver.id}">New Token</button>
      </div>
    </article>
  `;
}

function openJobDialog(jobId = "") {
  const job = state.jobs.find((item) => item.id === jobId);
  els.jobDialogTitle.textContent = job ? "Edit Job" : "Add Job";
  els.jobId.value = job?.id || "";
  els.jobName.value = job?.name || "";
  els.jobRoute.value = job?.route || "";
  els.jobDriver.value = job?.driverId || state.drivers[0]?.id || "";
  els.jobTruck.value = job?.truckId || state.trucks[0]?.id || "";
  els.jobLoads.value = job?.loads || 1;
  els.jobProfitPerLoad.value = job?.profitPerLoad || DEFAULT_PROFIT_PER_LOAD;
  els.jobDialog.showModal();
}

function saveJob(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();

  const existingId = els.jobId.value;
  const job = {
    id: existingId || crypto.randomUUID(),
    date: els.workDate.value || todayISO(),
    name: els.jobName.value.trim(),
    route: els.jobRoute.value.trim(),
    driverId: els.jobDriver.value,
    truckId: els.jobTruck.value,
    loads: Number(els.jobLoads.value),
    profitPerLoad: Number(els.jobProfitPerLoad.value)
  };

  if (existingId) {
    state.jobs = state.jobs.map((item) => item.id === existingId ? job : item);
  } else {
    state.jobs.push(job);
  }

  persist();
  els.jobDialog.close();
  showToast(existingId ? "Job updated" : "Job added");
  render();
}

function saveDriver(event) {
  event.preventDefault();
  const name = els.driverNameInput.value.trim();
  if (!name) return;

  state.drivers.push({
    id: crypto.randomUUID(),
    name,
    token: generateDriverToken(name)
  });

  els.driverForm.reset();
  persist();
  fillStaticSelects();
  showToast("Driver added");
  render();
}

function copyDriverToken(driverId) {
  const driver = state.drivers.find((item) => item.id === driverId);
  if (!driver) return;

  navigator.clipboard?.writeText(driver.token)
    .then(() => showToast("Token copied"))
    .catch(() => showToast(driver.token));
}

function regenerateDriverToken(driverId) {
  const driver = state.drivers.find((item) => item.id === driverId);
  if (!driver) return;

  driver.token = generateDriverToken(driver.name);
  persist();
  showToast("New token created");
  render();
}

function saveExpense(event) {
  event.preventDefault();
  const job = state.jobs.find((item) => item.id === els.expenseJob.value);
  if (!job) {
    showToast("No assigned job selected");
    return;
  }

  state.expenses.push({
    id: crypto.randomUUID(),
    date: els.workDate.value || todayISO(),
    jobId: job.id,
    driverId: job.driverId,
    truckId: job.truckId,
    type: els.expenseType.value,
    amount: Number(els.expenseAmount.value),
    note: els.expenseNote.value.trim()
  });

  els.expenseForm.reset();
  persist();
  showToast("Expense saved");
  render();
}

function saveTime(event) {
  event.preventDefault();
  const job = state.jobs.find((item) => item.id === els.timeJob.value);
  if (!job) {
    showToast("No assigned job selected");
    return;
  }

  state.timeEntries.push({
    id: crypto.randomUUID(),
    date: els.workDate.value || todayISO(),
    jobId: job.id,
    driverId: job.driverId,
    start: els.timeStart.value,
    end: els.timeEnd.value
  });

  els.timeForm.reset();
  persist();
  showToast("Time saved");
  render();
}

function jobsForDate(date) {
  return state.jobs.filter((job) => job.date === date);
}

function expensesForDate(date) {
  return state.expenses.filter((expense) => expense.date === date);
}

function metric(label, value, className) {
  return `<article class="metric ${className}"><span>${label}</span><strong>${value}</strong></article>`;
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function fillSelect(select, items, labelKey) {
  if (!select) return;
  select.innerHTML = items.map((item) => `<option value="${item.id}">${escapeHTML(item[labelKey])}</option>`).join("");
}

function fillJobSelect(select, jobs) {
  if (!select) return;
  select.innerHTML = jobs.length
    ? jobs.map((job) => `<option value="${job.id}">${escapeHTML(job.name)}</option>`).join("")
    : `<option value="">No assigned jobs</option>`;
}

function clearViews() {
  els.summaryGrid.innerHTML = "";
  els.jobList.innerHTML = "";
  els.expenseList.innerHTML = "";
  els.breakdownList.innerHTML = "";
  els.driverList.innerHTML = "";
  els.driverSummary.innerHTML = "";
  els.assignedJobs.innerHTML = "";
  els.expenseJob.innerHTML = "";
  els.timeJob.innerHTML = "";
}

function driverName(id) {
  return state.drivers.find((driver) => driver.id === id)?.name || "Unknown driver";
}

function findDriverByToken(token) {
  const normalized = token.trim().toUpperCase();
  return state.drivers.find((driver) => driver.token.toUpperCase() === normalized);
}

function truckName(id) {
  return state.trucks.find((truck) => truck.id === id)?.name || "Unknown truck";
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function generateDriverToken(name) {
  const letters = name.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X");
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${letters}-${digits}`;
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!saved) {
    const freshState = normalizeState(structuredClone(seedData));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState));
    return freshState;
  }

  try {
    const loadedState = normalizeState(JSON.parse(saved));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedState));
    return loadedState;
  } catch {
    const freshState = normalizeState(structuredClone(seedData));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState));
    return freshState;
  }
}

function normalizeState(data) {
  data.drivers = (data.drivers || []).map((driver) => ({
    ...driver,
    token: driver.token || generateDriverToken(driver.name || "Driver")
  }));
  data.trucks ||= [];
  data.jobs ||= [];
  data.expenses ||= [];
  data.timeEntries ||= [];
  return data;
}

function loadSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved) return { mode: "", driverId: "" };

  try {
    const parsed = JSON.parse(saved);
    if (parsed.mode === "owner" || parsed.mode === "driver") return parsed;
  } catch {
    return { mode: "", driverId: "" };
  }

  return { mode: "", driverId: "" };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 1900);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}
