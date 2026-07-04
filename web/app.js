const API = "api/index.php";
const DEFAULT_PROFIT_PER_LOAD = 250;
const expenseTypes = ["Fuel", "DEF", "Tolls", "Repairs", "Washout", "Other"];

let session = { role: "", driver: null };
let ownerData = { drivers: [], trucks: [], jobs: [], expenses: [], timeEntries: [] };
let driverData = { driver: null, jobs: [], expenses: [], timeEntries: [] };

const els = {
  body: document.body,
  pageTitle: document.querySelector("#pageTitle"),
  interfaceGate: document.querySelector("#interfaceGate"),
  ownerSetupForm: document.querySelector("#ownerSetupForm"),
  ownerSetupPin: document.querySelector("#ownerSetupPin"),
  ownerSetupPinConfirm: document.querySelector("#ownerSetupPinConfirm"),
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
  truckForm: document.querySelector("#truckForm"),
  truckNameInput: document.querySelector("#truckNameInput"),
  truckList: document.querySelector("#truckList"),
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
  toast: document.querySelector("#toast")
};

boot();

async function boot() {
  els.workDate.value = todayISO();
  fillSelect(els.expenseType, expenseTypes.map((type) => ({ id: type, name: type })), "name");
  bindEvents();
  setMode("");
  await refreshSetupState();
  registerServiceWorker();
}

function bindEvents() {
  els.ownerSetupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (els.ownerSetupPin.value !== els.ownerSetupPinConfirm.value) {
      showToast("PINs do not match");
      return;
    }

    try {
      await post("owner_setup", {
        pin: els.ownerSetupPin.value,
        pin_confirm: els.ownerSetupPinConfirm.value
      });
      els.ownerSetupForm.reset();
      session = { role: "owner", driver: null };
      showToast("Owner PIN created");
      await loadOwner();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.ownerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await post("owner_login", { pin: els.ownerPin.value });
      els.ownerPin.value = "";
      session = { role: "owner", driver: null };
      await loadOwner();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.driverLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await post("driver_login", { token: els.driverToken.value });
      session = { role: "driver", driver: result.driver };
      els.driverToken.value = "";
      await loadDriver();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.switchInterfaceButton.addEventListener("click", async () => {
    await post("logout", {});
    session = { role: "", driver: null };
    setMode("");
  });

  els.workDate.addEventListener("change", async () => {
    if (session.role === "owner") await loadOwner();
    if (session.role === "driver") await loadDriver();
  });

  els.addJobButton.addEventListener("click", () => openJobDialog());
  els.jobForm.addEventListener("submit", saveJob);
  els.driverForm.addEventListener("submit", saveDriver);
  els.truckForm.addEventListener("submit", saveTruck);
  els.expenseForm.addEventListener("submit", saveExpense);
  els.timeForm.addEventListener("submit", saveTime);
}

async function refreshSetupState() {
  try {
    const status = await get("setup_status");
    els.ownerSetupForm.hidden = status.owner_pin_set;
    els.ownerLoginForm.hidden = !status.owner_pin_set;
  } catch (error) {
    showToast(error.message);
  }
}

async function loadOwner() {
  const date = els.workDate.value || todayISO();
  ownerData = await get(`owner_day&date=${encodeURIComponent(date)}`);
  setMode("owner");
  renderOwner();
}

async function loadDriver() {
  const date = els.workDate.value || todayISO();
  driverData = await get(`driver_day&date=${encodeURIComponent(date)}`);
  session.driver = driverData.driver;
  setMode("driver");
  renderDriver();
}

function setMode(mode) {
  els.interfaceGate.classList.toggle("active", !mode);
  els.ownerView.classList.toggle("active", mode === "owner");
  els.driverView.classList.toggle("active", mode === "driver");
  els.switchInterfaceButton.hidden = !mode;
  els.body.classList.toggle("gate-mode", !mode);
  els.body.classList.toggle("driver-mode", mode === "driver");
  els.body.classList.toggle("owner-mode", mode === "owner");
  els.pageTitle.textContent = mode === "owner" ? "Daily Net" : mode === "driver" ? session.driver?.name || "Driver" : "Choose App";

  if (!mode) clearViews();
}

function renderOwner() {
  const jobs = ownerData.jobs;
  const expenses = ownerData.expenses;
  const grossProfit = jobs.reduce((sum, job) => sum + Number(job.loads) * Number(job.profit_per_load), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const net = grossProfit - totalExpenses;
  const loads = jobs.reduce((sum, job) => sum + Number(job.loads), 0);

  els.summaryGrid.innerHTML = [
    metric("Gross Profit", money(grossProfit), "green"),
    metric("Expenses", money(totalExpenses), "amber"),
    metric("Net", money(net), "net"),
    metric("Loads", loads.toString(), "blue")
  ].join("");

  fillSelect(els.jobDriver, ownerData.drivers, "name");
  fillSelect(els.jobTruck, ownerData.trucks, "name");
  els.jobList.innerHTML = jobs.length ? jobs.map(jobCard).join("") : empty("No jobs for this date.");
  els.expenseList.innerHTML = expenses.length ? expenses.map(expenseCard).join("") : empty("No expenses entered.");
  els.breakdownList.innerHTML = renderBreakdown(jobs, expenses);
  els.driverList.innerHTML = ownerData.drivers.length ? ownerData.drivers.map(driverCard).join("") : empty("No drivers yet.");
  els.truckList.innerHTML = ownerData.trucks.length ? ownerData.trucks.map(truckCard).join("") : empty("No trucks yet.");

  els.jobList.querySelectorAll("[data-edit-job]").forEach((button) => {
    button.addEventListener("click", () => openJobDialog(button.dataset.editJob));
  });
  els.driverList.querySelectorAll("[data-copy-token]").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.copyToken));
  });
  els.driverList.querySelectorAll("[data-regenerate-token]").forEach((button) => {
    button.addEventListener("click", async () => regenerateDriverToken(button.dataset.regenerateToken));
  });
}

function renderDriver() {
  const jobs = driverData.jobs;
  const expenses = driverData.expenses;
  const times = driverData.timeEntries;
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const hours = times.reduce((sum, entry) => sum + hoursBetween(entry.start_time, entry.end_time), 0);

  els.driverSummary.innerHTML = `
    <div class="card-top">
      <div>
        <h2>${escapeHTML(driverData.driver.name)}</h2>
        <p class="meta">${jobs.length} assigned job${jobs.length === 1 ? "" : "s"} today</p>
      </div>
      <span class="pill amber">${money(totalExpenses)}</span>
    </div>
    <div class="pill-row">
      <span class="pill blue">${hours.toFixed(1)} hr</span>
      <span class="pill">${expenses.length} expense${expenses.length === 1 ? "" : "s"}</span>
    </div>
  `;

  els.assignedJobs.innerHTML = jobs.length ? jobs.map(driverJobCard).join("") : empty("No assigned jobs for today.");
  fillJobSelect(els.expenseJob, jobs);
  fillJobSelect(els.timeJob, jobs);
}

function renderBreakdown(jobs, expenses) {
  if (!jobs.length) return empty("No net breakdown yet.");

  return jobs.map((job) => {
    const jobExpenses = expenses.filter((expense) => Number(expense.job_id) === Number(job.id));
    const cost = jobExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const gross = Number(job.loads) * Number(job.profit_per_load);
    const net = gross - cost;

    return `
      <article class="breakdown-card">
        <div class="card-top">
          <div>
            <h3>${escapeHTML(job.name)}</h3>
            <p class="meta">${escapeHTML(job.driver_name)} · ${escapeHTML(job.truck_name)}</p>
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
  const jobExpenses = ownerData.expenses.filter((expense) => Number(expense.job_id) === Number(job.id));
  const cost = jobExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const gross = Number(job.loads) * Number(job.profit_per_load);

  return `
    <article class="job-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(job.name)}</h3>
          <p class="meta">${escapeHTML(job.route || "No route")} · ${escapeHTML(job.driver_name)} · ${escapeHTML(job.truck_name)}</p>
        </div>
        <strong>${money(gross - cost)}</strong>
      </div>
      <div class="pill-row">
        <span class="pill blue">${job.loads} loads</span>
        <span class="pill green">${money(job.profit_per_load)}/load</span>
        <span class="pill amber">${money(cost)} costs</span>
      </div>
      <div class="card-actions">
        <button class="secondary-button" type="button" data-edit-job="${job.id}">Edit</button>
      </div>
    </article>
  `;
}

function driverJobCard(job) {
  const times = driverData.timeEntries.filter((entry) => Number(entry.job_id) === Number(job.id));
  const hours = times.reduce((sum, entry) => sum + hoursBetween(entry.start_time, entry.end_time), 0);

  return `
    <article class="job-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(job.name)}</h3>
          <p class="meta">${escapeHTML(job.route || "No route")} · ${escapeHTML(job.truck_name)}</p>
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
  return `
    <article class="expense-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(expense.type)}</h3>
          <p class="meta">${escapeHTML(expense.job_name)} · ${escapeHTML(expense.driver_name)} · ${escapeHTML(expense.truck_name)}</p>
          ${expense.note ? `<p class="tiny">${escapeHTML(expense.note)}</p>` : ""}
        </div>
        <strong>${money(expense.amount)}</strong>
      </div>
    </article>
  `;
}

function driverCard(driver) {
  return `
    <article class="driver-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(driver.name)}</h3>
          <p class="meta">Driver access token</p>
        </div>
        <code class="token-code">${escapeHTML(driver.access_token)}</code>
      </div>
      <div class="card-actions">
        <button class="secondary-button" type="button" data-copy-token="${escapeHTML(driver.access_token)}">Copy Token</button>
        <button class="danger-button" type="button" data-regenerate-token="${driver.id}">New Token</button>
      </div>
    </article>
  `;
}

function truckCard(truck) {
  return `
    <article class="truck-card">
      <div class="card-top">
        <div>
          <h3>${escapeHTML(truck.name)}</h3>
          <p class="meta">Available for assignment</p>
        </div>
      </div>
    </article>
  `;
}

function openJobDialog(jobId = "") {
  const job = ownerData.jobs.find((item) => Number(item.id) === Number(jobId));
  els.jobDialogTitle.textContent = job ? "Edit Job" : "Add Job";
  els.jobId.value = job?.id || "";
  els.jobName.value = job?.name || "";
  els.jobRoute.value = job?.route || "";
  els.jobDriver.value = job?.driver_id || ownerData.drivers[0]?.id || "";
  els.jobTruck.value = job?.truck_id || ownerData.trucks[0]?.id || "";
  els.jobLoads.value = job?.loads || 1;
  els.jobProfitPerLoad.value = job?.profit_per_load || DEFAULT_PROFIT_PER_LOAD;
  els.jobDialog.showModal();
}

async function saveJob(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();

  try {
    await post("owner_save_job", {
      id: els.jobId.value,
      work_date: els.workDate.value || todayISO(),
      name: els.jobName.value.trim(),
      route: els.jobRoute.value.trim(),
      driver_id: els.jobDriver.value,
      truck_id: els.jobTruck.value,
      loads: els.jobLoads.value,
      profit_per_load: els.jobProfitPerLoad.value
    });
    els.jobDialog.close();
    showToast(els.jobId.value ? "Job updated" : "Job added");
    await loadOwner();
  } catch (error) {
    showToast(error.message);
  }
}

async function saveDriver(event) {
  event.preventDefault();
  try {
    const result = await post("owner_add_driver", { name: els.driverNameInput.value.trim() });
    els.driverForm.reset();
    showToast(`Driver token: ${result.driver.access_token}`);
    await loadOwner();
  } catch (error) {
    showToast(error.message);
  }
}

async function saveTruck(event) {
  event.preventDefault();
  try {
    await post("owner_add_truck", { name: els.truckNameInput.value.trim() });
    els.truckForm.reset();
    showToast("Truck added");
    await loadOwner();
  } catch (error) {
    showToast(error.message);
  }
}

async function regenerateDriverToken(driverId) {
  try {
    const result = await post("owner_regenerate_driver_token", { driver_id: driverId });
    showToast(`New token: ${result.driver.access_token}`);
    await loadOwner();
  } catch (error) {
    showToast(error.message);
  }
}

async function saveExpense(event) {
  event.preventDefault();
  try {
    await post("driver_add_expense", {
      job_id: els.expenseJob.value,
      type: els.expenseType.value,
      amount: els.expenseAmount.value,
      note: els.expenseNote.value.trim()
    });
    els.expenseForm.reset();
    showToast("Expense saved");
    await loadDriver();
  } catch (error) {
    showToast(error.message);
  }
}

async function saveTime(event) {
  event.preventDefault();
  try {
    await post("driver_add_time", {
      job_id: els.timeJob.value,
      start_time: els.timeStart.value,
      end_time: els.timeEnd.value
    });
    els.timeForm.reset();
    showToast("Time saved");
    await loadDriver();
  } catch (error) {
    showToast(error.message);
  }
}

async function get(action) {
  const response = await fetch(`${API}?action=${action}`, { credentials: "same-origin" });
  return parseResponse(response);
}

async function post(action, payload) {
  const response = await fetch(`${API}?action=${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "Something went wrong");
  return data.data ?? data;
}

function metric(label, value, className) {
  return `<article class="metric ${className}"><span>${label}</span><strong>${value}</strong></article>`;
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function fillSelect(select, items, labelKey) {
  select.innerHTML = items.length
    ? items.map((item) => `<option value="${item.id}">${escapeHTML(item[labelKey])}</option>`).join("")
    : `<option value="">None yet</option>`;
}

function fillJobSelect(select, jobs) {
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
  els.truckList.innerHTML = "";
  els.driverSummary.innerHTML = "";
  els.assignedJobs.innerHTML = "";
  els.expenseJob.innerHTML = "";
  els.timeJob.innerHTML = "";
}

function copyText(value) {
  navigator.clipboard?.writeText(value)
    .then(() => showToast("Token copied"))
    .catch(() => showToast(value));
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}
