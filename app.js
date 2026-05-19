(function () {
  "use strict";

  // ========== CONFIGURACIÓN ==========
  const STORES = ["patients", "treatments", "sessions", "materials", "jobs", "appointments"];
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  let pacientesCache = [];
  let tratamientosCache = [];
  let sesionesCache = [];
  let trabajosCache = [];
  let filtroMaterial = "todos";

  // ========== FUNCIONES BASE DE localStorage ==========
  function getStore(storeName) {
    const data = localStorage.getItem(storeName);
    return data ? JSON.parse(data) : [];
  }

  function setStore(storeName, data) {
    localStorage.setItem(storeName, JSON.stringify(data));
  }

  function add(storeName, item) {
    const store = getStore(storeName);
    const newId = Date.now();
    const newItem = { ...item, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    store.push(newItem);
    setStore(storeName, store);
    return newItem;
  }

  function put(storeName, item) {
    const store = getStore(storeName);
    const index = store.findIndex(i => i.id == item.id);
    if (index !== -1) {
      store[index] = { ...item, updatedAt: new Date().toISOString() };
      setStore(storeName, store);
    }
    return item;
  }

  function remove(storeName, id) {
    let store = getStore(storeName);
    store = store.filter(i => i.id != id);
    setStore(storeName, store);
  }

  function get(storeName, id) {
    const store = getStore(storeName);
    return store.find(i => i.id == id);
  }

  function all(storeName) {
    return getStore(storeName);
  }

  // ========== FUNCIONES AUXILIARES ==========
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
    if (container) container.innerHTML = `<div class="empty">${text}</div>`;
  }

  function openPanel(panel) {
    if (panel) {
      panel.classList.remove("hidden");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function closePanel(panel) {
    if (panel) panel.classList.add("hidden");
  }

  // ========== FUNCIÓN CORREGIDA PARA LLENAR SELECTS ==========
  function fillPatientSelect(selectElement, selectedId) {
    if (!selectElement) {
      console.error("fillPatientSelect: selectElement es null");
      return;
    }
    
    let pacientes = [];
    try {
      const data = localStorage.getItem("patients");
      pacientes = data ? JSON.parse(data) : [];
    } catch(e) {
      console.error("Error al leer pacientes:", e);
    }
    
    console.log("fillPatientSelect - Pacientes encontrados:", pacientes.length);
    
    if (!pacientes.length) {
      selectElement.innerHTML = '<option value="">⚠️ Primero crea un paciente</option>';
      return;
    }
    
    let html = '<option value="">📋 Seleccionar paciente...</option>';
    pacientes.sort((a, b) => a.name.localeCompare(b.name));
    for (const p of pacientes) {
      const selected = (Number(selectedId) === Number(p.id)) ? 'selected' : '';
      html += `<option value="${p.id}" ${selected}>${escapeHTML(p.name)}</option>`;
    }
    selectElement.innerHTML = html;
  }

  // ========== INICIALIZACIÓN ==========
  document.addEventListener("DOMContentLoaded", async () => {
    pacientesCache = await all("patients");
    tratamientosCache = await all("treatments");
    sesionesCache = await all("sessions");
    trabajosCache = await all("jobs");

    const page = document.body.dataset.page;
    if (page === "dashboard") initDashboard();
    if (page === "pacientes") initPacientes();
    if (page === "tratamientos") initTratamientos();
    if (page === "tratamiento-detalle") initTratamientoDetalle();
    if (page === "materiales") initMateriales();
    if (page === "trabajos") initTrabajos();
  });

  // ========== DASHBOARD CORREGIDO ==========
  async function initDashboard() {
    const fechaElem = $("#fechaActual");
    if (fechaElem) {
      fechaElem.textContent = new Date().toLocaleDateString("es-MX", { 
        weekday: "long", 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });
    }
    
    const btnActualizar = $("#btnActualizarDashboard");
    if (btnActualizar) {
      btnActualizar.addEventListener("click", () => {
        console.log("Actualizando dashboard...");
        renderDashboard();
      });
    }
    
    await renderDashboard();
  }

  async function renderDashboard() {
    console.log("renderDashboard ejecutándose");
    
    const patients = getStore("patients");
    const treatments = getStore("treatments");
    const sessions = getStore("sessions");
    const materials = getStore("materials");
    const jobs = getStore("jobs");
    const appointments = getStore("appointments");
    
    pacientesCache = patients;
    sesionesCache = sessions;
    
    console.log("Dashboard - Pacientes:", patients.length);
    console.log("Dashboard - Citas:", appointments.length);
    console.log("Dashboard - Tratamientos:", treatments.length);
    
    const today = todayLocalDate();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    
    // Citas de hoy y mañana
    const citas = appointments
      .filter((item) => item.dateTime && [today, tomorrow].includes(item.dateTime.slice(0, 10)))
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
    
    const citasContainer = $("#resumenCitas");
    if (citasContainer) {
      if (!citas.length) {
        citasContainer.innerHTML = '<div class="empty">📅 No hay citas para hoy ni mañana</div>';
      } else {
        citasContainer.innerHTML = citas.map((cita) => `
          <div class="card">
            <h4>${escapeHTML(patientName(cita.patientId))}</h4>
            <p>${formatDate(cita.dateTime)}</p>
            <p>${escapeHTML(cita.notes || "Sin notas")}</p>
          </div>
        `).join("");
      }
    }
    
    // Trabajos por vencer
    const vencen = jobs
      .filter((job) => job.status !== "Entregado al paciente" && daysUntil(job.promisedDate) <= 2)
      .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
    
    const trabajosContainer = $("#resumenTrabajos");
    if (trabajosContainer) {
      if (!vencen.length) {
        trabajosContainer.innerHTML = '<div class="empty">🔧 No hay trabajos por vencer</div>';
      } else {
        trabajosContainer.innerHTML = vencen.map((job) => `
          <div class="card">
            <h4>${escapeHTML(job.type)} - ${escapeHTML(patientName(job.patientId))}</h4>
            <p>Prometido: ${formatDate(job.promisedDate)}</p>
            <span class="badge">${escapeHTML(job.status)}</span>
          </div>
        `).join("");
      }
    }
    
    // Materiales pendientes
    const pendientes = materials.filter((item) => !item.purchased);
    const materialesContainer = $("#resumenMateriales");
    if (materialesContainer) {
      if (!pendientes.length) {
        materialesContainer.innerHTML = '<div class="empty">📝 No hay materiales pendientes</div>';
      } else {
        materialesContainer.innerHTML = pendientes.map((item) => `
          <div class="card">
            <h4>${escapeHTML(item.name)}</h4>
            <p>${escapeHTML(item.quantity)} ${item.category ? "· " + escapeHTML(item.category) : ""}</p>
          </div>
        `).join("");
      }
    }
    
    // Saldos pendientes
    const saldos = treatments
      .map((tratamiento) => treatmentStats(tratamiento, sessions))
      .filter((item) => item.balance > 0);
    
    const saldosContainer = $("#resumenTratamientos");
    if (saldosContainer) {
      if (!saldos.length) {
        saldosContainer.innerHTML = '<div class="empty">💰 No hay saldos pendientes</div>';
      } else {
        saldosContainer.innerHTML = saldos.map((item) => `
          <div class="card">
            <h4>${escapeHTML(item.treatment.name)}</h4>
            <p>${escapeHTML(patientName(item.treatment.patientId))}</p>
            <p>Saldo: <strong>${money(item.balance)}</strong></p>
          </div>
        `).join("");
      }
    }
  }

  // ========== PACIENTES ==========
  async function initPacientes() {
    const btnNuevo = $("#btnNuevoPaciente");
    if (btnNuevo) btnNuevo.addEventListener("click", () => showPatientForm());
    const btnCancelar = $("#btnCancelarPaciente");
    if (btnCancelar) btnCancelar.addEventListener("click", () => closePanel($("#panelPaciente")));
    const btnCancelarCita = $("#btnCancelarCita");
    if (btnCancelarCita) btnCancelarCita.addEventListener("click", () => closePanel($("#panelCita")));
    const buscar = $("#buscarPaciente");
    if (buscar) buscar.addEventListener("input", renderPacientes);
    const formPaciente = $("#formPaciente");
    if (formPaciente) formPaciente.addEventListener("submit", savePatient);
    const formCita = $("#formCita");
    if (formCita) formCita.addEventListener("submit", saveAppointment);
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
    if (!container) return;
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
          ${citas.slice(0, 3).map((c) => `<p>📅 ${formatDate(c.dateTime)} - ${escapeHTML(c.notes || "Sin notas")}</p>`).join("")}
          <div class="card-actions">
            <button class="secondary" data-edit-patient="${p.id}">✏️ Editar</button>
            <button class="primary" data-new-appointment="${p.id}">➕ Cita</button>
            <button class="danger" data-delete-patient="${p.id}">🗑️ Eliminar</button>
          </div>
        </article>`;
    }).join("");
    bindPatientActions();
  }

  function showPatientForm(patient) {
    const titulo = $("#tituloPaciente");
    if (titulo) titulo.textContent = patient ? "Editar paciente" : "Nuevo paciente";
    const idInput = $("#pacienteId");
    if (idInput) idInput.value = patient?.id || "";
    const nombreInput = $("#pacienteNombre");
    if (nombreInput) nombreInput.value = patient?.name || "";
    const telefonoInput = $("#pacienteTelefono");
    if (telefonoInput) telefonoInput.value = patient?.phone || "";
    const emailInput = $("#pacienteEmail");
    if (emailInput) emailInput.value = patient?.email || "";
    openPanel($("#panelPaciente"));
  }

  async function savePatient(event) {
    event.preventDefault();
    const id = $("#pacienteId")?.value;
    const payload = {
      id: id ? Number(id) : undefined,
      name: $("#pacienteNombre")?.value.trim() || "",
      phone: $("#pacienteTelefono")?.value.trim() || "",
      email: $("#pacienteEmail")?.value.trim() || ""
    };
    if (id) {
      await put("patients", payload);
    } else {
      await add("patients", payload);
    }
    event.target.reset();
    closePanel($("#panelPaciente"));
    await loadPacientes();
    renderDashboard();
  }

  function bindPatientActions() {
    $$("[data-edit-patient]").forEach((btn) => btn.addEventListener("click", () => {
      showPatientForm(pacientesCache.find((p) => Number(p.id) === Number(btn.dataset.editPatient)));
    }));
    $$("[data-new-appointment]").forEach((btn) => btn.addEventListener("click", () => showAppointmentForm(btn.dataset.newAppointment)));
    $$("[data-delete-patient]").forEach((btn) => btn.addEventListener("click", () => deletePatient(btn.dataset.deletePatient)));
  }

  function showAppointmentForm(patientId) {
    const titulo = $("#tituloCita");
    if (titulo) titulo.textContent = `Programar cita para ${patientName(patientId)}`;
    const idInput = $("#citaId");
    if (idInput) idInput.value = "";
    const patientIdInput = $("#citaPacienteId");
    if (patientIdInput) patientIdInput.value = patientId;
    const fechaInput = $("#citaFecha");
    if (fechaInput) fechaInput.value = "";
    const notasInput = $("#citaNotas");
    if (notasInput) notasInput.value = "";
    openPanel($("#panelCita"));
  }

  async function saveAppointment(event) {
    event.preventDefault();
    const payload = {
      patientId: Number($("#citaPacienteId")?.value),
      dateTime: $("#citaFecha")?.value,
      notes: $("#citaNotas")?.value.trim() || "",
      notified: false
    };
    await add("appointments", payload);
    event.target.reset();
    closePanel($("#panelCita"));
    await loadPacientes();
    renderDashboard();
  }

  async function deletePatient(id) {
    if (!confirm("¿Eliminar este paciente?")) return;
    const cascade = confirm("¿Eliminar también sus tratamientos y trabajos externos?");
    await remove("patients", id);
    const appointments = await all("appointments");
    for (const item of appointments) {
      if (Number(item.patientId) === Number(id)) {
        await remove("appointments", item.id);
      }
    }
    if (cascade) {
      const treatments = await all("treatments");
      const sessions = await all("sessions");
      const jobs = await all("jobs");
      const treatmentIds = treatments.filter((t) => Number(t.patientId) === Number(id)).map((t) => t.id);
      for (const t of treatments) {
        if (treatmentIds.includes(t.id)) await remove("treatments", t.id);
      }
      for (const s of sessions) {
        if (treatmentIds.includes(s.treatmentId)) await remove("sessions", s.id);
      }
      for (const j of jobs) {
        if (Number(j.patientId) === Number(id)) await remove("jobs", j.id);
      }
    }
    await loadPacientes();
    renderDashboard();
  }

  // ========== TRATAMIENTOS CORREGIDO ==========
  async function initTratamientos() {
    pacientesCache = await all("patients");
    
    const btnNuevo = $("#btnNuevoTratamiento");
    if (btnNuevo) btnNuevo.addEventListener("click", () => {
      showTreatmentForm();
    });
    
    const btnCancelar = $("#btnCancelarTratamiento");
    if (btnCancelar) btnCancelar.addEventListener("click", () => closePanel($("#panelTratamiento")));
    
    const buscar = $("#buscarTratamiento");
    if (buscar) buscar.addEventListener("input", renderTratamientos);
    
    const form = $("#formTratamiento");
    if (form) form.addEventListener("submit", saveTreatment);
    
    await loadTratamientos();
  }

  async function loadTratamientos() {
    tratamientosCache = await all("treatments");
    sesionesCache = await all("sessions");
    renderTratamientos();
  }

  function showTreatmentForm(treatment) {
    console.log("showTreatmentForm - Abriendo formulario");
    
    const pacienteSelect = $("#tratamientoPaciente");
    if (!pacienteSelect) {
      console.error("No se encontró el select #tratamientoPaciente");
      return;
    }
    
    fillPatientSelect(pacienteSelect, treatment?.patientId);
    
    const titulo = $("#tituloTratamiento");
    if (titulo) titulo.textContent = treatment ? "✏️ Editar tratamiento" : "➕ Nuevo tratamiento";
    
    const idInput = $("#tratamientoId");
    if (idInput) idInput.value = treatment?.id || "";
    
    const nombreInput = $("#tratamientoNombre");
    if (nombreInput) nombreInput.value = treatment?.name || "";
    
    const costoInput = $("#tratamientoCosto");
    if (costoInput) costoInput.value = treatment?.totalCost || "";
    
    const sesionesInput = $("#tratamientoSesionesTotal");
    if (sesionesInput) sesionesInput.value = treatment?.totalSessions || "";
    
    openPanel($("#panelTratamiento"));
  }

  async function saveTreatment(event) {
    event.preventDefault();
    const id = $("#tratamientoId")?.value;
    const patientId = $("#tratamientoPaciente")?.value;
    
    if (!patientId) {
      alert("❌ Selecciona un paciente");
      return;
    }
    
    const payload = {
      id: id ? Number(id) : undefined,
      patientId: Number(patientId),
      name: $("#tratamientoNombre")?.value.trim() || "",
      totalCost: Number($("#tratamientoCosto")?.value || 0),
      totalSessions: Number($("#tratamientoSesionesTotal")?.value || 1)
    };
    
    if (id) {
      await put("treatments", payload);
    } else {
      await add("treatments", payload);
    }
    event.target.reset();
    closePanel($("#panelTratamiento"));
    await loadTratamientos();
    renderDashboard();
  }

  function renderTratamientos() {
    const query = ($("#buscarTratamiento")?.value || "").toLowerCase();
    const list = tratamientosCache
      .filter((t) => [t.name, patientName(t.patientId)].join(" ").toLowerCase().includes(query))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const container = $("#listaTratamientos");
    if (!container) return;
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
    for (const s of sessions) {
      if (Number(s.treatmentId) === Number(id)) {
        await remove("sessions", s.id);
      }
    }
    await remove("treatments", id);
    await loadTratamientos();
    renderDashboard();
  }

  // ========== DETALLE TRATAMIENTO ==========
  async function initTratamientoDetalle() {
    const params = new URLSearchParams(location.search);
    const treatmentId = Number(params.get("id"));
    if (!treatmentId) {
      const resumen = $("#resumenDetalle");
      if (resumen) resumen.innerHTML = `<div class="empty">No se encontró el tratamiento.</div>`;
      return;
    }
    const btnNueva = $("#btnNuevaSesion");
    if (btnNueva) btnNueva.addEventListener("click", () => showSessionForm());
    const btnCancelar = $("#btnCancelarSesion");
    if (btnCancelar) btnCancelar.addEventListener("click", () => closePanel($("#panelSesion")));
    const form = $("#formSesion");
    if (form) form.addEventListener("submit", (event) => saveSession(event, treatmentId));
    await loadDetalle(treatmentId);
  }

  async function loadDetalle(treatmentId) {
    const patients = await all("patients");
    const treatment = await get("treatments", treatmentId);
    const sessions = await all("sessions");
    pacientesCache = patients;
    if (!treatment) {
      const resumen = $("#resumenDetalle");
      if (resumen) resumen.innerHTML = `<div class="empty">Este tratamiento ya no existe.</div>`;
      return;
    }
    tratamientosCache = [treatment];
    sesionesCache = sessions.filter((s) => Number(s.treatmentId) === Number(treatmentId)).sort((a, b) => b.date.localeCompare(a.date));
    const titulo = $("#detalleTitulo");
    if (titulo) titulo.textContent = treatment.name;
    const resumen = $("#resumenDetalle");
    if (resumen) resumen.innerHTML = treatmentCard(treatment);
    renderSesiones(treatmentId);
  }

  function showSessionForm(session) {
    const titulo = $("#tituloSesion");
    if (titulo) titulo.textContent = session ? "Editar sesión" : "Registrar nueva sesión";
    const idInput = $("#sesionId");
    if (idInput) idInput.value = session?.id || "";
    const fechaInput = $("#sesionFecha");
    if (fechaInput) fechaInput.value = session?.date || todayLocalDate();
    const montoInput = $("#sesionMonto");
    if (montoInput) montoInput.value = session?.amount || "";
    const notasInput = $("#sesionNotas");
    if (notasInput) notasInput.value = session?.notes || "";
    openPanel($("#panelSesion"));
  }

  async function saveSession(event, treatmentId) {
    event.preventDefault();
    const id = $("#sesionId")?.value;
    const payload = {
      id: id ? Number(id) : undefined,
      treatmentId,
      date: $("#sesionFecha")?.value,
      amount: Number($("#sesionMonto")?.value || 0),
      notes: $("#sesionNotas")?.value.trim() || ""
    };
    if (id) {
      await put("sessions", payload);
    } else {
      await add("sessions", payload);
    }
    event.target.reset();
    closePanel($("#panelSesion"));
    await loadDetalle(treatmentId);
    renderDashboard();
  }

  function renderSesiones(treatmentId) {
    const container = $("#listaSesiones");
    if (!container) return;
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
      renderDashboard();
    }));
  }

  // ========== MATERIALES ==========
  async function initMateriales() {
    const btnNuevo = $("#btnNuevoMaterial");
    if (btnNuevo) btnNuevo.addEventListener("click", () => showMaterialForm());
    const btnCancelar = $("#btnCancelarMaterial");
    if (btnCancelar) btnCancelar.addEventListener("click", () => closePanel($("#panelMaterial")));
    const form = $("#formMaterial");
    if (form) form.addEventListener("submit", saveMaterial);
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
    if (!container) return;
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
    const titulo = $("#tituloMaterial");
    if (titulo) titulo.textContent = item ? "Editar material" : "Nuevo material";
    const idInput = $("#materialId");
    if (idInput) idInput.value = item?.id || "";
    const nombreInput = $("#materialNombre");
    if (nombreInput) nombreInput.value = item?.name || "";
    const cantidadInput = $("#materialCantidad");
    if (cantidadInput) cantidadInput.value = item?.quantity || "";
    const categoriaInput = $("#materialCategoria");
    if (categoriaInput) categoriaInput.value = item?.category || "";
    openPanel($("#panelMaterial"));
  }

  async function saveMaterial(event) {
    event.preventDefault();
    const id = $("#materialId")?.value;
    const previous = id ? await get("materials", id) : {};
    const payload = {
      id: id ? Number(id) : undefined,
      name: $("#materialNombre")?.value.trim() || "",
      quantity: $("#materialCantidad")?.value.trim() || "",
      category: $("#materialCategoria")?.value.trim() || "",
      purchased: previous ? Boolean(previous.purchased) : false
    };
    if (id) {
      await put("materials", payload);
    } else {
      await add("materials", payload);
    }
    event.target.reset();
    closePanel($("#panelMaterial"));
    await loadMateriales();
    renderDashboard();
  }

  async function toggleMaterial(id, purchased) {
    const item = await get("materials", id);
    await put("materials", { ...item, purchased });
    await loadMateriales();
    renderDashboard();
  }

  // ========== TRABAJOS EXTERNOS CORREGIDO ==========
  async function initTrabajos() {
    pacientesCache = await all("patients");
    
    const btnNuevo = $("#btnNuevoTrabajo");
    if (btnNuevo) btnNuevo.addEventListener("click", () => {
      showJobForm();
    });
    
    const btnCancelar = $("#btnCancelarTrabajo");
    if (btnCancelar) btnCancelar.addEventListener("click", () => closePanel($("#panelTrabajo")));
    
    const form = $("#formTrabajo");
    if (form) form.addEventListener("submit", saveJob);
    
    const buscar = $("#buscarTrabajo");
    if (buscar) buscar.addEventListener("input", renderTrabajos);
    
    await loadTrabajos();
  }

  async function loadTrabajos() {
    trabajosCache = await all("jobs");
    renderTrabajos();
  }

  function showJobForm(job) {
    console.log("showJobForm - Abriendo formulario");
    
    const pacienteSelect = $("#trabajoPaciente");
    if (!pacienteSelect) {
      console.error("No se encontró el select #trabajoPaciente");
      return;
    }
    
    fillPatientSelect(pacienteSelect, job?.patientId);
    
    const titulo = $("#tituloTrabajo");
    if (titulo) titulo.textContent = job ? "✏️ Editar trabajo externo" : "➕ Nuevo trabajo externo";
    
    const idInput = $("#trabajoId");
    if (idInput) idInput.value = job?.id || "";
    
    const tipoInput = $("#trabajoTipo");
    if (tipoInput) tipoInput.value = job?.type || "Placa";
    
    const pedidoInput = $("#trabajoPedido");
    if (pedidoInput) pedidoInput.value = job?.orderDate || todayLocalDate();
    
    const prometidaInput = $("#trabajoPrometida");
    if (prometidaInput) prometidaInput.value = job?.promisedDate || "";
    
    const costoInput = $("#trabajoCosto");
    if (costoInput) costoInput.value = job?.cost || "";
    
    const estadoInput = $("#trabajoEstado");
    if (estadoInput) estadoInput.value = job?.status || "Pendiente";
    
    openPanel($("#panelTrabajo"));
  }

  async function saveJob(event) {
    event.preventDefault();
    const id = $("#trabajoId")?.value;
    const patientId = $("#trabajoPaciente")?.value;
    
    if (!patientId) {
      alert("❌ Selecciona un paciente");
      return;
    }
    
    const payload = {
      id: id ? Number(id) : undefined,
      patientId: Number(patientId),
      type: $("#trabajoTipo")?.value || "Placa",
      orderDate: $("#trabajoPedido")?.value,
      promisedDate: $("#trabajoPrometida")?.value,
      cost: Number($("#trabajoCosto")?.value || 0),
      status: $("#trabajoEstado")?.value || "Pendiente",
      notifiedTwoDays: false
    };
    
    if (id) {
      await put("jobs", payload);
    } else {
      await add("jobs", payload);
    }
    event.target.reset();
    closePanel($("#panelTrabajo"));
    await loadTrabajos();
    renderDashboard();
  }

  function renderTrabajos() {
    const query = ($("#buscarTrabajo")?.value || "").toLowerCase();
    const list = trabajosCache
      .filter((job) => [job.type, job.status, patientName(job.patientId)].join(" ").toLowerCase().includes(query))
      .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
    const container = $("#listaTrabajos");
    if (!container) return;
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
      renderDashboard();
    }));
    $$("[data-edit-job]").forEach((btn) => btn.addEventListener("click", async () => showJobForm(await get("jobs", btn.dataset.editJob))));
    $$("[data-delete-job]").forEach((btn) => btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este trabajo externo?")) return;
      await remove("jobs", btn.dataset.deleteJob);
      await loadTrabajos();
      renderDashboard();
    }));
  }

  // ========== NOTIFICACIONES ==========
  function requestNotificationPermission() {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones.");
      return false;
    }
    Notification.requestPermission().then((result) => {
      alert(result === "granted" ? "✅ Notificaciones activadas" : "❌ No se activaron");
    });
  }

  function bindNotificationButton() {
    const btn = $("#btnNotificaciones");
    if (btn) btn.addEventListener("click", requestNotificationPermission);
  }

  // ========== EXPORTAR FUNCIONES GLOBALES ==========
  window.exportarDatos = async function() {
    const data = {};
    for (const store of STORES) {
      data[store] = await all(store);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dentaremind_backup_${todayLocalDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("✅ Backup exportado correctamente");
  };

  window.importarDatos = function(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        for (const store of STORES) {
          if (data[store]) {
            setStore(store, data[store]);
          }
        }
        alert("✅ Datos importados correctamente. Recarga la página.");
        location.reload();
      } catch (error) {
        alert("❌ Error al importar: archivo inválido");
      }
    };
    reader.readAsText(file);
  };

  window.marcarTodosMaterialesComprados = async function() {
    if (!confirm("¿Marcar TODOS los materiales como comprados?")) return;
    const materials = await all("materials");
    for (const material of materials) {
      await put("materials", { ...material, purchased: true });
    }
    await loadMateriales();
    renderDashboard();
    alert("✅ Todos los materiales marcados como comprados");
  };

  // Inicializar botón de notificaciones
  bindNotificationButton();

})();