(function () {
  "use strict";

  const DB_NAME = "agendaDentalPWA";
  const DB_VERSION = 1;
  const STORES = ["patients", "treatments", "sessions", "materials", "jobs", "appointments"];
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let db;
  let pacientesCache = [];
  let tratamientosCache = [];
  let sesionesCache = [];
  let trabajosCache = [];
  let filtroMaterial = "todos";

  document.addEventListener("DOMContentLoaded", async () => {
    await initDB();
    registerServiceWorker();
    bindNotificationButton();
    startReminderLoop();

    const page = document.body.dataset.page;
    if (page === "dashboard") initDashboard();
    if (page === "pacientes") initPacientes();
    if (page === "tratamientos") initTratamientos();
    if (page === "tratamiento-detalle") initTratamientoDetalle();
    if (page === "materiales") initMateriales();
    if (page === "trabajos") initTrabajos();
  });

  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains("patients")) {
          database.createObjectStore("patients", { keyPath: "id", autoIncrement: true });
        }
        if (!database.objectStoreNames.contains("treatments")) {
          database.createObjectStore("treatments", { keyPath: "id", autoIncrement: true });
        }
        if (!database.objectStoreNames.contains("sessions")) {
          database.createObjectStore("sessions", { keyPath: "id", autoIncrement: true });
        }
        if (!database.objectStoreNames.contains("materials")) {
          database.createObjectStore("materials", { keyPath: "id", autoIncrement: true });
        }
        if (!database.objectStoreNames.contains("jobs")) {
          database.createObjectStore("jobs", { keyPath: "id", autoIncrement: true });
        }
        if (!database.objectStoreNames.contains("appointments")) {
          database.createObjectStore("appointments", { keyPath: "id", autoIncrement: true });
        }
      };

      request.onsuccess = () => {
        db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function store(name, mode = "readonly") {
    return db.transaction(name, mode).objectStore(name);
  }

  function add(name, value) {
    return requestToPromise(store(name, "readwrite").add(withTimestamps(value)));
  }

  function put(name, value) {
    return requestToPromise(store(name, "readwrite").put(withTimestamps(value, true)));
  }

  function remove(name, id) {
    return requestToPromise(store(name, "readwrite").delete(Number(id)));
  }

  function get(name, id) {
    return requestToPromise(store(name).get(Number(id)));
  }

  function all(name) {
    return requestToPromise(store(name).getAll());
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function withTimestamps(value, existing) {
    const now = new Date().toISOString();
    return {
      ...value,
      updatedAt: now,
      createdAt: existing && value.createdAt ? value.createdAt : now
    };
  }

  function money(value) {
    return Number(value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  }

  function todayLocalDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(value) {
    if (!value) return "Sin fecha";
    const date = new Date(value.length === 10 ? value + "T00:00:00" : value);
    return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined });
  }

  function daysUntil(dateValue) {
    const today = new Date(todayLocalDate() + "T00:00:00");
    const target = new Date(dateValue + "T00:00:00");
    return Math.ceil((target - today) / 86400000);
  }

  function patientName(id) {
    const paciente = pacientesCache.find((item) => Number(item.id) === Number(id));
    return paciente ? paciente.name : "Paciente eliminado";
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function setEmpty(container, text) {
    container.innerHTML = `<div class="empty">${text}</div>`;
  }

  function openPanel(panel) {
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closePanel(panel) {
    panel.classList.add("hidden");
  }

  function fillPatientSelect(select, selectedId) {
    if (!pacientesCache.length) {
      select.innerHTML = `<option value="">Primero crea un paciente</option>`;
      return;
    }
    select.innerHTML = pacientesCache
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => `<option value="${p.id}" ${Number(selectedId) === Number(p.id) ? "selected" : ""}>${escapeHTML(p.name)}</option>`)
      .join("");
  }

  async function initDashboard() {
    $("#fechaActual").textContent = new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    $("#btnActualizarDashboard").addEventListener("click", renderDashboard);
    await renderDashboard();
  }

  async function renderDashboard() {
    const [patients, treatments, sessions, materials, jobs, appointments] = await Promise.all(STORES.map(all));
    pacientesCache = patients;
    sesionesCache = sessions;

    const today = todayLocalDate();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const citas = appointments
      .filter((item) => item.dateTime && [today, tomorrow].includes(item.dateTime.slice(0, 10)))
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
    renderList($("#resumenCitas"), citas, (cita) => `
      <div class="card">
        <h4>${escapeHTML(patientName(cita.patientId))}</h4>
        <p>${formatDate(cita.dateTime)}</p>
        <p>${escapeHTML(cita.notes || "Sin notas")}</p>
      </div>`, "No hay citas para hoy ni mañana.");

    const vencen = jobs
      .filter((job) => job.status !== "Entregado al paciente" && daysUntil(job.promisedDate) <= 2)
      .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
    renderList($("#resumenTrabajos"), vencen, (job) => `
      <div class="card">
        <h4>${escapeHTML(job.type)} - ${escapeHTML(patientName(job.patientId))}</h4>
        <p>Prometido: ${formatDate(job.promisedDate)}</p>
        <span class="badge">${escapeHTML(job.status)}</span>
      </div>`, "No hay trabajos por vencer.");

    const pendientes = materials.filter((item) => !item.purchased);
    renderList($("#resumenMateriales"), pendientes, (item) => `
      <div class="card">
        <h4>${escapeHTML(item.name)}</h4>
        <p>${escapeHTML(item.quantity)} ${item.category ? "· " + escapeHTML(item.category) : ""}</p>
      </div>`, "No hay materiales pendientes.");

    const saldos = treatments
      .map((tratamiento) => treatmentStats(tratamiento, sessions))
      .filter((item) => item.balance > 0);
    renderList($("#resumenTratamientos"), saldos, (item) => `
      <div class="card">
        <h4>${escapeHTML(item.treatment.name)}</h4>
        <p>${escapeHTML(patientName(item.treatment.patientId))}</p>
        <p>Saldo: <strong>${money(item.balance)}</strong></p>
      </div>`, "No hay saldos pendientes.");
  }

  function renderList(container, items, template, emptyText) {
    if (!items.length) return setEmpty(container, emptyText);
    container.innerHTML = items.map(template).join("");
  }

  async function initPacientes() {
    $("#btnNuevoPaciente").addEventListener("click", () => showPatientForm());
    $("#btnCancelarPaciente").addEventListener("click", () => closePanel($("#panelPaciente")));
    $("#btnCancelarCita").addEventListener("click", () => closePanel($("#panelCita")));
    $("#buscarPaciente").addEventListener("input", renderPacientes);
    $("#formPaciente").addEventListener("submit", savePatient);
    $("#formCita").addEventListener("submit", saveAppointment);
    await loadPacientes();
  }

  async function loadPacientes() {
    pacientesCache = await all("patients");
    renderPacientes();
  }

  async function renderPacientes() {
    const query = ($("#buscarPaciente")?.value || "").toLowerCase();
    const appointments = await all("appointments");
    const list = pacientesCache
      .filter((p) => [p.name, p.phone, p.email].join(" ").toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
    const container = $("#listaPacientes");
    if (!list.length) return setEmpty(container, "No hay pacientes registrados.");
    container.innerHTML = list.map((p) => {
      const citas = appointments.filter((c) => Number(c.patientId) === Number(p.id)).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
      return `
        <article class="card">
          <div class="card-header">
            <div>
              <h3>${escapeHTML(p.name)}</h3>
              <p>Tel: ${escapeHTML(p.phone)}</p>
              <p>${escapeHTML(p.email || "Sin email")}</p>
            </div>
            <span class="badge">${citas.length} cita(s)</span>
          </div>
          ${citas.slice(0, 3).map((c) => `<p>📅 ${formatDate(c.dateTime)} - ${escapeHTML(c.notes || "Sin notas")} <button class="danger small" data-delete-appointment="${c.id}">🗑️</button></p>`).join("")}
          <div class="card-actions">
            <button class="secondary" data-edit-patient="${p.id}">✏️ Editar</button>
            <button class="primary" data-new-appointment="${p.id}">➕ Cita</button>
            <button class="danger" data-delete-patient="${p.id}">🗑️ Eliminar</button>
          </div>
        </article>`;
    }).join("");
    bindPatientActions();
    // Bind para eliminar citas
    $$("[data-delete-appointment]").forEach((btn) => btn.addEventListener("click", () => eliminarCita(btn.dataset.deleteAppointment)));
  }

  function showPatientForm(patient) {
    $("#tituloPaciente").textContent = patient ? "Editar paciente" : "Nuevo paciente";
    $("#pacienteId").value = patient?.id || "";
    $("#pacienteNombre").value = patient?.name || "";
    $("#pacienteTelefono").value = patient?.phone || "";
    $("#pacienteEmail").value = patient?.email || "";
    openPanel($("#panelPaciente"));
  }

  async function savePatient(event) {
    event.preventDefault();
    const id = $("#pacienteId").value;
    const payload = {
      id: id ? Number(id) : undefined,
      name: $("#pacienteNombre").value.trim(),
      phone: $("#pacienteTelefono").value.trim(),
      email: $("#pacienteEmail").value.trim()
    };
    id ? await put("patients", payload) : await add("patients", payload);
    event.target.reset();
    closePanel($("#panelPaciente"));
    await loadPacientes();
  }

  function bindPatientActions() {
    $$("[data-edit-patient]").forEach((btn) => btn.addEventListener("click", () => {
      showPatientForm(pacientesCache.find((p) => Number(p.id) === Number(btn.dataset.editPatient)));
    }));
    $$("[data-new-appointment]").forEach((btn) => btn.addEventListener("click", () => showAppointmentForm(btn.dataset.newAppointment)));
    $$("[data-delete-patient]").forEach((btn) => btn.addEventListener("click", () => deletePatient(btn.dataset.deletePatient)));
  }

  function showAppointmentForm(patientId) {
    $("#tituloCita").textContent = `Programar cita para ${patientName(patientId)}`;
    $("#citaId").value = "";
    $("#citaPacienteId").value = patientId;
    $("#citaFecha").value = "";
    $("#citaNotas").value = "";
    openPanel($("#panelCita"));
  }

  async function saveAppointment(event) {
    event.preventDefault();
    const payload = {
      patientId: Number($("#citaPacienteId").value),
      dateTime: $("#citaFecha").value,
      notes: $("#citaNotas").value.trim(),
      notified: false
    };
    await add("appointments", payload);
    event.target.reset();
    closePanel($("#panelCita"));
    await loadPacientes();
  }

  async function deletePatient(id) {
    if (!confirm("¿Eliminar este paciente?")) return;
    const cascade = confirm("¿Eliminar también sus tratamientos y trabajos externos?");
    await remove("patients", id);
    const appointments = await all("appointments");
    await Promise.all(appointments.filter((item) => Number(item.patientId) === Number(id)).map((item) => remove("appointments", item.id)));
    if (cascade) {
      const [treatments, sessions, jobs] = await Promise.all([all("treatments"), all("sessions"), all("jobs")]);
      const treatmentIds = treatments.filter((t) => Number(t.patientId) === Number(id)).map((t) => t.id);
      await Promise.all(treatments.filter((t) => treatmentIds.includes(t.id)).map((t) => remove("treatments", t.id)));
      await Promise.all(sessions.filter((s) => treatmentIds.includes(s.treatmentId)).map((s) => remove("sessions", s.id)));
      await Promise.all(jobs.filter((j) => Number(j.patientId) === Number(id)).map((j) => remove("jobs", j.id)));
    }
    await loadPacientes();
  }

  async function initTratamientos() {
    pacientesCache = await all("patients");
    $("#btnNuevoTratamiento").addEventListener("click", () => showTreatmentForm());
    $("#btnCancelarTratamiento").addEventListener("click", () => closePanel($("#panelTratamiento")));
    $("#buscarTratamiento").addEventListener("input", renderTratamientos);
    $("#formTratamiento").addEventListener("submit", saveTreatment);
    await loadTratamientos();
  }

  async function loadTratamientos() {
    [tratamientosCache, sesionesCache] = await Promise.all([all("treatments"), all("sessions")]);
    renderTratamientos();
  }

  function showTreatmentForm(treatment) {
    fillPatientSelect($("#tratamientoPaciente"), treatment?.patientId);
    $("#tituloTratamiento").textContent = treatment ? "Editar tratamiento" : "Nuevo tratamiento";
    $("#tratamientoId").value = treatment?.id || "";
    $("#tratamientoNombre").value = treatment?.name || "";
    $("#tratamientoCosto").value = treatment?.totalCost || "";
    $("#tratamientoSesionesTotal").value = treatment?.totalSessions || "";
    openPanel($("#panelTratamiento"));
  }

  async function saveTreatment(event) {
    event.preventDefault();
    const id = $("#tratamientoId").value;
    const payload = {
      id: id ? Number(id) : undefined,
      patientId: Number($("#tratamientoPaciente").value),
      name: $("#tratamientoNombre").value.trim(),
      totalCost: Number($("#tratamientoCosto").value || 0),
      totalSessions: Number($("#tratamientoSesionesTotal").value || 1)
    };
    id ? await put("treatments", payload) : await add("treatments", payload);
    event.target.reset();
    closePanel($("#panelTratamiento"));
    await loadTratamientos();
  }

  function renderTratamientos() {
    const query = ($("#buscarTratamiento")?.value || "").toLowerCase();
    const list = tratamientosCache
      .filter((t) => [t.name, patientName(t.patientId)].join(" ").toLowerCase().includes(query))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const container = $("#listaTratamientos");
    if (!list.length) return setEmpty(container, "No hay tratamientos registrados.");
    container.innerHTML = list.map((t) => treatmentCard(t)).join("");
    $$("[data-edit-treatment]").forEach((btn) => btn.addEventListener("click", () => {
      showTreatmentForm(tratamientosCache.find((t) => Number(t.id) === Number(btn.dataset.editTreatment)));
    }));
    $$("[data-delete-treatment]").forEach((btn) => btn.addEventListener("click", () => deleteTreatment(btn.dataset.deleteTreatment)));
  }

  function treatmentStats(treatment, sessions) {
    const related = sessions.filter((s) => Number(s.treatmentId) === Number(treatment.id));
    const paid = related.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const done = related.length;
    const total = Number(treatment.totalSessions || 0);
    return {
      treatment,
      done,
      pending: Math.max(total - done, 0),
      paid,
      balance: Math.max(Number(treatment.totalCost || 0) - paid, 0),
      percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0
    };
  }

  function treatmentCard(t) {
    const stats = treatmentStats(t, sesionesCache);
    return `
      <article class="card">
        <div class="card-header">
          <div>
            <h3>${escapeHTML(t.name)}</h3>
            <p>${escapeHTML(patientName(t.patientId))}</p>
          </div>
          <span class="badge">${stats.percent}%</span>
        </div>
        <div class="progress"><span style="width:${stats.percent}%"></span></div>
        <div class="stats">
          <div class="stat"><strong>${stats.done}</strong><span>Realizadas</span></div>
          <div class="stat"><strong>${stats.pending}</strong><span>Pendientes</span></div>
          <div class="stat"><strong>${money(stats.paid)}</strong><span>Pagado</span></div>
          <div class="stat"><strong>${money(stats.balance)}</strong><span>Saldo</span></div>
        </div>
        <div class="card-actions">
          <a class="primary link-button" href="tratamiento-detalle.html?id=${t.id}">➕ Registrar nueva sesión</a>
          <button class="secondary" data-edit-treatment="${t.id}">✏️ Editar</button>
          <button class="danger" data-delete-treatment="${t.id}">🗑️ Eliminar</button>
        </div>
      </article>`;
  }

  async function deleteTreatment(id) {
    if (!confirm("¿Eliminar este tratamiento y sus sesiones?")) return;
    const sessions = await all("sessions");
    await Promise.all(sessions.filter((s) => Number(s.treatmentId) === Number(id)).map((s) => remove("sessions", s.id)));
    await remove("treatments", id);
    await loadTratamientos();
  }

  async function initTratamientoDetalle() {
    const treatmentId = Number(new URLSearchParams(location.search).get("id"));
    if (!treatmentId) {
      $("#resumenDetalle").innerHTML = `<div class="empty">No se encontró el tratamiento.</div>`;
      return;
    }
    $("#btnNuevaSesion").addEventListener("click", () => showSessionForm());
    $("#btnCancelarSesion").addEventListener("click", () => closePanel($("#panelSesion")));
    $("#formSesion").addEventListener("submit", (event) => saveSession(event, treatmentId));
    await loadDetalle(treatmentId);
  }

  async function loadDetalle(treatmentId) {
    const [patients, treatment, sessions] = await Promise.all([all("patients"), get("treatments", treatmentId), all("sessions")]);
    pacientesCache = patients;
    if (!treatment) {
      $("#resumenDetalle").innerHTML = `<div class="empty">Este tratamiento ya no existe.</div>`;
      return;
    }
    tratamientosCache = [treatment];
    sesionesCache = sessions.filter((s) => Number(s.treatmentId) === Number(treatmentId)).sort((a, b) => b.date.localeCompare(a.date));
    $("#detalleTitulo").textContent = treatment.name;
    const stats = treatmentStats(treatment, sessions);
    $("#resumenDetalle").innerHTML = treatmentCard(treatment);
    renderSesiones(treatmentId);
  }

  function showSessionForm(session) {
    $("#tituloSesion").textContent = session ? "Editar sesión" : "Registrar nueva sesión";
    $("#sesionId").value = session?.id || "";
    $("#sesionFecha").value = session?.date || todayLocalDate();
    $("#sesionMonto").value = session?.amount || "";
    $("#sesionNotas").value = session?.notes || "";
    openPanel($("#panelSesion"));
  }

  async function saveSession(event, treatmentId) {
    event.preventDefault();
    const id = $("#sesionId").value;
    const payload = {
      id: id ? Number(id) : undefined,
      treatmentId,
      date: $("#sesionFecha").value,
      amount: Number($("#sesionMonto").value || 0),
      notes: $("#sesionNotas").value.trim()
    };
    id ? await put("sessions", payload) : await add("sessions", payload);
    event.target.reset();
    closePanel($("#panelSesion"));
    await loadDetalle(treatmentId);
  }

  function renderSesiones(treatmentId) {
    const container = $("#listaSesiones");
    if (!sesionesCache.length) return setEmpty(container, "Aún no hay sesiones registradas.");
    container.innerHTML = sesionesCache.map((s) => `
      <article class="card">
        <div class="card-header">
          <div>
            <h3>${formatDate(s.date)}</h3>
            <p>Pagó ${money(s.amount)}</p>
            <p>${escapeHTML(s.notes || "Sin notas")}</p>
          </div>
        </div>
        <div class="card-actions">
          <button class="secondary" data-edit-session="${s.id}">✏️ Editar</button>
          <button class="danger" data-delete-session="${s.id}">🗑️ Eliminar</button>
        </div>
      </article>`).join("");
    $$("[data-edit-session]").forEach((btn) => btn.addEventListener("click", () => {
      showSessionForm(sesionesCache.find((s) => Number(s.id) === Number(btn.dataset.editSession)));
    }));
    $$("[data-delete-session]").forEach((btn) => btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta sesión?")) return;
      await remove("sessions", btn.dataset.deleteSession);
      await loadDetalle(treatmentId);
    }));
  }

  async function initMateriales() {
    $("#btnNuevoMaterial").addEventListener("click", () => showMaterialForm());
    $("#btnCancelarMaterial").addEventListener("click", () => closePanel($("#panelMaterial")));
    $("#formMaterial").addEventListener("submit", saveMaterial);
    $$("[data-filtro-material]").forEach((btn) => btn.addEventListener("click", () => {
      filtroMaterial = btn.dataset.filtroMaterial;
      $$("[data-filtro-material]").forEach((item) => item.classList.toggle("active", item === btn));
      loadMateriales();
    }));
    await loadMateriales();
  }

  async function loadMateriales() {
    const materials = await all("materials");
    const list = materials
      .filter((item) => filtroMaterial === "todos" || (filtroMaterial === "pendientes" ? !item.purchased : item.purchased))
      .sort((a, b) => Number(a.purchased) - Number(b.purchased) || b.updatedAt.localeCompare(a.updatedAt));
    const container = $("#listaMateriales");
    if (!list.length) return setEmpty(container, "No hay materiales en este filtro.");
    container.innerHTML = list.map((item) => `
      <article class="card ${item.purchased ? "material-done" : ""}">
        <div class="card-header">
          <label class="check-row">
            <input type="checkbox" data-toggle-material="${item.id}" ${item.purchased ? "checked" : ""}>
            <span>
              <h3>${escapeHTML(item.name)}</h3>
              <p>${escapeHTML(item.quantity)} ${item.category ? "· " + escapeHTML(item.category) : ""}</p>
            </span>
          </label>
          <span class="badge">${item.purchased ? "Comprado" : "Pendiente"}</span>
        </div>
        <div class="card-actions">
          <button class="secondary" data-edit-material="${item.id}">✏️ Editar</button>
          <button class="danger" data-delete-material="${item.id}">🗑️ Eliminar</button>
        </div>
      </article>`).join("");
    $$("[data-toggle-material]").forEach((checkbox) => checkbox.addEventListener("change", () => toggleMaterial(checkbox.dataset.toggleMaterial, checkbox.checked)));
    $$("[data-edit-material]").forEach((btn) => btn.addEventListener("click", async () => showMaterialForm(await get("materials", btn.dataset.editMaterial))));
    $$("[data-delete-material]").forEach((btn) => btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este material?")) return;
      await remove("materials", btn.dataset.deleteMaterial);
      await loadMateriales();
    }));
  }

  function showMaterialForm(item) {
    $("#tituloMaterial").textContent = item ? "Editar material" : "Nuevo material";
    $("#materialId").value = item?.id || "";
    $("#materialNombre").value = item?.name || "";
    $("#materialCantidad").value = item?.quantity || "";
    $("#materialCategoria").value = item?.category || "";
    openPanel($("#panelMaterial"));
  }

  async function saveMaterial(event) {
    event.preventDefault();
    const id = $("#materialId").value;
    const previous = id ? await get("materials", id) : {};
    const payload = {
      id: id ? Number(id) : undefined,
      name: $("#materialNombre").value.trim(),
      quantity: $("#materialCantidad").value.trim(),
      category: $("#materialCategoria").value.trim(),
      purchased: Boolean(previous.purchased)
    };
    id ? await put("materials", payload) : await add("materials", payload);
    event.target.reset();
    closePanel($("#panelMaterial"));
    await loadMateriales();
  }

  async function toggleMaterial(id, purchased) {
    const item = await get("materials", id);
    await put("materials", { ...item, purchased });
    await loadMateriales();
  }

  async function initTrabajos() {
    pacientesCache = await all("patients");
    $("#btnNuevoTrabajo").addEventListener("click", () => showJobForm());
    $("#btnCancelarTrabajo").addEventListener("click", () => closePanel($("#panelTrabajo")));
    $("#formTrabajo").addEventListener("submit", saveJob);
    $("#buscarTrabajo").addEventListener("input", renderTrabajos);
    await loadTrabajos();
  }

  async function loadTrabajos() {
    trabajosCache = await all("jobs");
    renderTrabajos();
  }

  function showJobForm(job) {
    fillPatientSelect($("#trabajoPaciente"), job?.patientId);
    $("#tituloTrabajo").textContent = job ? "Editar trabajo externo" : "Nuevo trabajo externo";
    $("#trabajoId").value = job?.id || "";
    $("#trabajoTipo").value = job?.type || "Placa";
    $("#trabajoPedido").value = job?.orderDate || todayLocalDate();
    $("#trabajoPrometida").value = job?.promisedDate || "";
    $("#trabajoCosto").value = job?.cost || "";
    $("#trabajoEstado").value = job?.status || "Pendiente";
    openPanel($("#panelTrabajo"));
  }

  async function saveJob(event) {
    event.preventDefault();
    const id = $("#trabajoId").value;
    const payload = {
      id: id ? Number(id) : undefined,
      patientId: Number($("#trabajoPaciente").value),
      type: $("#trabajoTipo").value,
      orderDate: $("#trabajoPedido").value,
      promisedDate: $("#trabajoPrometida").value,
      cost: Number($("#trabajoCosto").value || 0),
      status: $("#trabajoEstado").value,
      notifiedTwoDays: false
    };
    id ? await put("jobs", payload) : await add("jobs", payload);
    event.target.reset();
    closePanel($("#panelTrabajo"));
    await loadTrabajos();
  }

  function renderTrabajos() {
    const query = ($("#buscarTrabajo")?.value || "").toLowerCase();
    const list = trabajosCache
      .filter((job) => [job.type, job.status, patientName(job.patientId)].join(" ").toLowerCase().includes(query))
      .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
    const container = $("#listaTrabajos");
    if (!list.length) return setEmpty(container, "No hay trabajos externos registrados.");
    container.innerHTML = list.map((job) => `
      <article class="card">
        <div class="card-header">
          <div>
            <h3>${escapeHTML(job.type)} - ${escapeHTML(patientName(job.patientId))}</h3>
            <p>Pedido: ${formatDate(job.orderDate)}</p>
            <p>Prometido: ${formatDate(job.promisedDate)}</p>
            <p>Costo: ${money(job.cost)}</p>
          </div>
          <span class="badge">${escapeHTML(job.status)}</span>
        </div>
        <div class="card-actions">
          <select data-status-job="${job.id}" title="Cambiar estado">
            <option ${job.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
            <option ${job.status === "Recibido" ? "selected" : ""}>Recibido</option>
            <option ${job.status === "Entregado al paciente" ? "selected" : ""}>Entregado al paciente</option>
          </select>
          <button class="secondary" data-edit-job="${job.id}">✏️ Editar</button>
          <button class="danger" data-delete-job="${job.id}">🗑️ Eliminar</button>
        </div>
      </article>`).join("");
    $$("[data-status-job]").forEach((select) => select.addEventListener("change", async () => {
      const job = await get("jobs", select.dataset.statusJob);
      await put("jobs", { ...job, status: select.value });
      await loadTrabajos();
    }));
    $$("[data-edit-job]").forEach((btn) => btn.addEventListener("click", async () => showJobForm(await get("jobs", btn.dataset.editJob))));
    $$("[data-delete-job]").forEach((btn) => btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este trabajo externo?")) return;
      await remove("jobs", btn.dataset.deleteJob);
      await loadTrabajos();
    }));
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(console.warn);
    }
  }

  function bindNotificationButton() {
    const btn = $("#btnNotificaciones");
    if (!btn) return;
    btn.addEventListener("click", requestNotificationPermission);
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones.");
      return false;
    }
    const result = await Notification.requestPermission();
    alert(result === "granted" ? "Notificaciones activadas." : "No se activaron las notificaciones.");
    return result === "granted";
  }

  function startReminderLoop() {
    checkReminders();
    setInterval(checkReminders, 60000);
  }

  async function checkReminders() {
    if (!db || !("Notification" in window) || Notification.permission !== "granted") return;
    const [patients, appointments, jobs] = await Promise.all([all("patients"), all("appointments"), all("jobs")]);
    pacientesCache = patients;
    const now = Date.now();

    for (const cita of appointments) {
      const time = new Date(cita.dateTime).getTime();
      if (!cita.notified && time <= now && time >= now - 3600000) {
        await enviarNotificacionOneSignal("Cita dental", `${patientName(cita.patientId)} - ${formatDate(cita.dateTime)}`);
        await put("appointments", { ...cita, notified: true });
      }
    }

    for (const job of jobs) {
      if (job.status === "Entregado al paciente") continue;
      if (!job.notifiedTwoDays && daysUntil(job.promisedDate) <= 2 && daysUntil(job.promisedDate) >= 0) {
        await enviarNotificacionOneSignal("Trabajo externo por vencer", `${job.type} de ${patientName(job.patientId)} vence el ${formatDate(job.promisedDate)}`);
        await put("jobs", { ...job, notifiedTwoDays: true });
      }
    }
  }

  async function enviarNotificacionOneSignal(titulo, mensaje) {
    // Notificación local
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(titulo, { body: mensaje, icon: "icons/icon.svg", badge: "icons/icon.svg" });
    } else if (Notification.permission === "granted") {
      new Notification(titulo, { body: mensaje });
    }
    
    // Notificación OneSignal (si está disponible)
    if (window.OneSignal && window.OneSignal.User) {
      try {
        await window.OneSignal.User.addTag({ tipo: "recordatorio" });
      } catch(e) {
        console.log("Error OneSignal:", e);
      }
    }
  }

  // ========== FUNCIONES GLOBALES PARA EXPORTAR ==========
  
  async function exportarDatos() {
    const [patients, treatments, sessions, materials, jobs, appointments] = await Promise.all(STORES.map(all));
    const data = { patients, treatments, sessions, materials, jobs, appointments, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda_dental_backup_${todayLocalDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("📦 Backup exportado correctamente");
  }

  async function importarDatos(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.patients && data.treatments && data.sessions && data.materials && data.jobs && data.appointments) {
          for (const store of STORES) {
            const allItems = await all(store);
            for (const item of allItems) {
              await remove(store, item.id);
            }
          }
          for (const patient of data.patients) await add("patients", patient);
          for (const treatment of data.treatments) await add("treatments", treatment);
          for (const session of data.sessions) await add("sessions", session);
          for (const material of data.materials) await add("materials", material);
          for (const job of data.jobs) await add("jobs", job);
          for (const appointment of data.appointments) await add("appointments", appointment);
          alert("✅ Datos importados correctamente. Recarga la página.");
          location.reload();
        } else throw new Error("Estructura inválida");
      } catch (error) {
        alert("❌ Error al importar: archivo inválido");
      }
    };
    reader.readAsText(file);
  }

  async function marcarTodosMaterialesComprados() {
    if (!confirm("¿Marcar TODOS los materiales como comprados?")) return;
    const materials = await all("materials");
    for (const material of materials) {
      await put("materials", { ...material, purchased: true });
    }
    if (typeof loadMateriales === 'function') await loadMateriales();
    alert("✅ Todos los materiales marcados como comprados");
  }

  async function eliminarCita(id) {
    if (!confirm("¿Eliminar esta cita?")) return;
    await remove("appointments", id);
    if (typeof loadPacientes === 'function') await loadPacientes();
  }

  // ========== EXPORTAR FUNCIONES GLOBALES ==========
  window.exportarDatos = exportarDatos;
  window.importarDatos = importarDatos;
  window.marcarTodosMaterialesComprados = marcarTodosMaterialesComprados;
  window.eliminarCita = eliminarCita;
  window.todayLocalDate = todayLocalDate;
  window.money = money;
  window.formatDate = formatDate;
  window.patientName = patientName;

})();