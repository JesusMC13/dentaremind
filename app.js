(function () {
  "use strict";

  // ========== CONFIGURACIÓN ==========
  const STORES = ["patients", "treatments", "sessions", "materials", "jobs", "appointments"];
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
    const date = new Date(value);
    return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  }

  function daysUntil(dateValue) {
    const today = new Date(todayLocalDate());
    const target = new Date(dateValue);
    return Math.ceil((target - today) / 86400000);
  }

  function patientName(id, patients) {
    const paciente = patients.find((item) => Number(item.id) === Number(id));
    return paciente ? paciente.name : "Paciente eliminado";
  }

  function escapeHTML(value) {
    if (!value) return "";
    return String(value).replace(/[&<>"']/g, (char) => ({
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

  // ========== FUNCIÓN PARA CARGAR SELECTS DE PACIENTES ==========
  function cargarSelectPacientes(selectId, selectedId) {
    const select = $(selectId);
    if (!select) return;
    
    const pacientes = getStore("patients");
    
    if (!pacientes.length) {
      select.innerHTML = '<option value="">⚠️ Primero crea un paciente</option>';
      return;
    }
    
    let html = '<option value="">📋 Seleccionar paciente...</option>';
    pacientes.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const p of pacientes) {
      let selected = false;
      if (selectedId !== undefined && selectedId !== null && !isNaN(selectedId)) {
        selected = (Number(selectedId) === Number(p.id));
      }
      html += `<option value="${p.id}" ${selected ? 'selected' : ''}>${escapeHTML(p.name)}</option>`;
    }
    select.innerHTML = html;
  }

  // ========== FUNCIÓN PARA ACTUALIZAR GLOBALMENTE ==========
  function actualizarPacientesGlobal() {
    cargarSelectPacientes("#tratamientoPaciente");
    cargarSelectPacientes("#trabajoPaciente");
    renderDashboard();
    if (document.body.dataset.page === "tratamientos") renderTratamientos();
    if (document.body.dataset.page === "trabajos") renderTrabajos();
  }

  // ========== INICIALIZACIÓN ==========
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    
    if (page === "dashboard") initDashboard();
    if (page === "pacientes") initPacientes();
    if (page === "tratamientos") initTratamientos();
    if (page === "tratamiento-detalle") initTratamientoDetalle();
    if (page === "materiales") initMateriales();
    if (page === "trabajos") initTrabajos();
  });

  // ========== DASHBOARD ==========
  function initDashboard() {
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
      btnActualizar.addEventListener("click", () => renderDashboard());
    }
    
    renderDashboard();
  }

    function renderDashboard() {
    const patients = getStore("patients");
    const treatments = getStore("treatments");
    const sessions = getStore("sessions");
    const materials = getStore("materials");
    const jobs = getStore("jobs");
    const appointments = getStore("appointments");
    
    // Fechas en hora local CORRECTA
    const hoy = new Date();
    const today = hoy.getFullYear() + '-' + 
                  String(hoy.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(hoy.getDate()).padStart(2, '0');
    
    const mananaDate = new Date(hoy);
    mananaDate.setDate(hoy.getDate() + 1);
    const tomorrow = mananaDate.getFullYear() + '-' + 
                     String(mananaDate.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(mananaDate.getDate()).padStart(2, '0');
    
    // Filtrar citas de hoy y mañana
    const citas = appointments
      .filter((item) => {
        if (!item.dateTime) return false;
        const fechaCita = item.dateTime.slice(0, 10);
        return fechaCita === today || fechaCita === tomorrow;
      })
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
    
    const citasContainer = $("#resumenCitas");
    if (citasContainer) {
      if (!citas.length) {
        citasContainer.innerHTML = '<div class="empty">📅 No hay citas para hoy ni mañana</div>';
      } else {
        citasContainer.innerHTML = citas.map((cita) => {
          // Formatear fecha y hora para mostrar bonito
          const fecha = new Date(cita.dateTime);
          const fechaStr = fecha.toLocaleDateString("es-MX", { day: 'numeric', month: 'long' });
          const horaStr = fecha.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="card">
              <h4>${escapeHTML(patientName(cita.patientId, patients))}</h4>
              <p>📅 ${fechaStr} - ${horaStr}</p>
              <p>${escapeHTML(cita.notes || "Sin notas")}</p>
            </div>
          `;
        }).join("");
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
            <h4>${escapeHTML(job.type)} - ${escapeHTML(patientName(job.patientId, patients))}</h4>
            <p>📅 Prometido: ${formatDate(job.promisedDate)}</p>
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
    const saldos = [];
    for (const t of treatments) {
      const related = sessions.filter((s) => Number(s.treatmentId) === Number(t.id));
      const paid = related.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const balance = Math.max(Number(t.totalCost || 0) - paid, 0);
      if (balance > 0) {
        saldos.push({ treatment: t, balance });
      }
    }
    
    const saldosContainer = $("#resumenTratamientos");
    if (saldosContainer) {
      if (!saldos.length) {
        saldosContainer.innerHTML = '<div class="empty">💰 No hay saldos pendientes</div>';
      } else {
        saldosContainer.innerHTML = saldos.map((item) => `
          <div class="card">
            <h4>${escapeHTML(item.treatment.name)}</h4>
            <p>${escapeHTML(patientName(item.treatment.patientId, patients))}</p>
            <p>Saldo: <strong>${money(item.balance)}</strong></p>
          </div>
        `).join("");
      }
    }
  }

  // ========== PACIENTES ==========
  function initPacientes() {
    $("#btnNuevoPaciente")?.addEventListener("click", () => showPatientForm());
    $("#btnCancelarPaciente")?.addEventListener("click", () => closePanel($("#panelPaciente")));
    $("#btnCancelarCita")?.addEventListener("click", () => closePanel($("#panelCita")));
    $("#buscarPaciente")?.addEventListener("input", () => renderPacientes());
    $("#formPaciente")?.addEventListener("submit", savePatient);
    $("#formCita")?.addEventListener("submit", saveAppointment);
    renderPacientes();
  }

  function renderPacientes() {
    const query = ($("#buscarPaciente")?.value || "").toLowerCase();
    const patients = getStore("patients");
    const appointments = getStore("appointments");
    
    const list = patients
      .filter((p) => [p.name, p.phone, p.email].join(" ").toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const container = $("#listaPacientes");
    if (!container) return;
    
    if (!list.length) {
      container.innerHTML = '<div class="empty">No hay pacientes registrados.</div>';
      return;
    }
    
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
            <button class="secondary" onclick="window.editarPaciente(${p.id})">✏️ Editar</button>
            <button class="primary" onclick="window.agendarCita(${p.id})">➕ Cita</button>
            <button class="danger" onclick="window.eliminarPaciente(${p.id})">🗑️ Eliminar</button>
          </div>
        </article>`;
    }).join("");
  }

  window.editarPaciente = (id) => {
    const patients = getStore("patients");
    const patient = patients.find(p => p.id === id);
    if (patient) showPatientForm(patient);
  };

  window.agendarCita = (patientId) => {
    showAppointmentForm(patientId);
  };

  window.eliminarPaciente = async (id) => {
    if (!confirm("¿Eliminar este paciente?")) return;
    const cascade = confirm("¿Eliminar también sus tratamientos y trabajos externos?");
    
    await remove("patients", id);
    
    const appointments = getStore("appointments");
    for (const item of appointments) {
      if (Number(item.patientId) === Number(id)) {
        await remove("appointments", item.id);
      }
    }
    
    if (cascade) {
      const treatments = getStore("treatments");
      const sessions = getStore("sessions");
      const jobs = getStore("jobs");
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
    
    renderPacientes();
    actualizarPacientesGlobal();
  };

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
    
    if (id) {
      await put("patients", payload);
    } else {
      await add("patients", payload);
    }
    
    event.target.reset();
    closePanel($("#panelPaciente"));
    renderPacientes();
    renderDashboard();
    cargarSelectPacientes("#tratamientoPaciente");
    cargarSelectPacientes("#trabajoPaciente");
  }

  function showAppointmentForm(patientId) {
    const patients = getStore("patients");
    const patientName = patients.find(p => p.id === patientId)?.name || "Paciente";
    
    $("#tituloCita").textContent = `Programar cita para ${patientName}`;
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
    renderPacientes();
    renderDashboard();
  }

  // ========== TRATAMIENTOS ==========
  function initTratamientos() {
    $("#btnNuevoTratamiento")?.addEventListener("click", () => showTreatmentForm());
    $("#btnCancelarTratamiento")?.addEventListener("click", () => closePanel($("#panelTratamiento")));
    $("#buscarTratamiento")?.addEventListener("input", () => renderTratamientos());
    $("#formTratamiento")?.addEventListener("submit", saveTreatment);
    renderTratamientos();
    cargarSelectPacientes("#tratamientoPaciente");
  }

  function renderTratamientos() {
    const treatments = getStore("treatments");
    const sessions = getStore("sessions");
    const patients = getStore("patients");
    
    const container = $("#listaTratamientos");
    if (!container) return;
    
    if (!treatments.length) {
      container.innerHTML = '<div class="empty">No hay tratamientos registrados.</div>';
      return;
    }
    
    container.innerHTML = treatments.map((t) => {
      const related = sessions.filter((s) => Number(s.treatmentId) === Number(t.id));
      const paid = related.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const done = related.length;
      const total = Number(t.totalSessions || 0);
      const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
      const balance = Math.max(Number(t.totalCost || 0) - paid, 0);
      
      return `
        <article class="card">
          <div class="card-header">
            <div>
              <h3>${escapeHTML(t.name)}</h3>
              <p>${escapeHTML(patientName(t.patientId, patients))}</p>
            </div>
            <span class="badge">${percent}%</span>
          </div>
          <div class="progress"><span style="width:${percent}%"></span></div>
          <div class="stats">
            <div class="stat"><strong>${done}</strong><span>Realizadas</span></div>
            <div class="stat"><strong>${Math.max(total - done, 0)}</strong><span>Pendientes</span></div>
            <div class="stat"><strong>${money(paid)}</strong><span>Pagado</span></div>
            <div class="stat"><strong>${money(balance)}</strong><span>Saldo</span></div>
          </div>
          <div class="card-actions">
            <a class="primary" href="tratamiento-detalle.html?id=${t.id}">➕ Registrar sesión</a>
            <button class="secondary" onclick="window.editarTratamiento(${t.id})">✏️ Editar</button>
            <button class="danger" onclick="window.eliminarTratamiento(${t.id})">🗑️ Eliminar</button>
          </div>
        </article>`;
    }).join("");
  }

  window.editarTratamiento = (id) => {
    const treatments = getStore("treatments");
    const treatment = treatments.find(t => t.id === id);
    if (treatment) showTreatmentForm(treatment);
  };

  window.eliminarTratamiento = async (id) => {
    if (!confirm("¿Eliminar este tratamiento y sus sesiones?")) return;
    const sessions = getStore("sessions");
    for (const s of sessions) {
      if (Number(s.treatmentId) === Number(id)) {
        await remove("sessions", s.id);
      }
    }
    await remove("treatments", id);
    renderTratamientos();
    renderDashboard();
  };

  function showTreatmentForm(treatment) {
    cargarSelectPacientes("#tratamientoPaciente", treatment?.patientId);
    $("#tituloTratamiento").textContent = treatment ? "✏️ Editar tratamiento" : "➕ Nuevo tratamiento";
    $("#tratamientoId").value = treatment?.id || "";
    $("#tratamientoNombre").value = treatment?.name || "";
    $("#tratamientoCosto").value = treatment?.totalCost || "";
    $("#tratamientoSesionesTotal").value = treatment?.totalSessions || "";
    openPanel($("#panelTratamiento"));
  }

  async function saveTreatment(event) {
    event.preventDefault();
    const id = $("#tratamientoId").value;
    const patientId = $("#tratamientoPaciente").value;
    
    if (!patientId) {
      alert("❌ Selecciona un paciente");
      return;
    }
    
    const payload = {
      id: id ? Number(id) : undefined,
      patientId: Number(patientId),
      name: $("#tratamientoNombre").value.trim(),
      totalCost: Number($("#tratamientoCosto").value || 0),
      totalSessions: Number($("#tratamientoSesionesTotal").value || 1)
    };
    
    if (id) {
      await put("treatments", payload);
    } else {
      await add("treatments", payload);
    }
    
    event.target.reset();
    closePanel($("#panelTratamiento"));
    renderTratamientos();
    renderDashboard();
  }

  // ========== DETALLE TRATAMIENTO ==========
  function initTratamientoDetalle() {
    const params = new URLSearchParams(location.search);
    const treatmentId = Number(params.get("id"));
    
    if (!treatmentId) {
      $("#resumenDetalle").innerHTML = '<div class="empty">No se encontró el tratamiento.</div>';
      return;
    }
    
    $("#btnNuevaSesion")?.addEventListener("click", () => showSessionForm());
    $("#btnCancelarSesion")?.addEventListener("click", () => closePanel($("#panelSesion")));
    $("#formSesion")?.addEventListener("submit", (event) => saveSession(event, treatmentId));
    renderDetalleTratamiento(treatmentId);
  }

  function renderDetalleTratamiento(treatmentId) {
    const treatment = get("treatments", treatmentId);
    const sessions = getStore("sessions").filter(s => s.treatmentId === treatmentId).sort((a, b) => b.date.localeCompare(a.date));
    const patients = getStore("patients");
    
    if (!treatment) {
      $("#resumenDetalle").innerHTML = '<div class="empty">Este tratamiento ya no existe.</div>';
      return;
    }
    
    $("#detalleTitulo").textContent = treatment.name;
    
    const related = getStore("sessions").filter((s) => Number(s.treatmentId) === Number(treatment.id));
    const paid = related.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const done = related.length;
    const total = Number(treatment.totalSessions || 0);
    const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const balance = Math.max(Number(treatment.totalCost || 0) - paid, 0);
    
    $("#resumenDetalle").innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${escapeHTML(treatment.name)}</h3>
            <p>${escapeHTML(patientName(treatment.patientId, patients))}</p>
          </div>
          <span class="badge">${percent}%</span>
        </div>
        <div class="progress"><span style="width:${percent}%"></span></div>
        <div class="stats">
          <div class="stat"><strong>${done}</strong><span>Realizadas</span></div>
          <div class="stat"><strong>${Math.max(total - done, 0)}</strong><span>Pendientes</span></div>
          <div class="stat"><strong>${money(paid)}</strong><span>Pagado</span></div>
          <div class="stat"><strong>${money(balance)}</strong><span>Saldo</span></div>
        </div>
      </div>
    `;
    
    const container = $("#listaSesiones");
    if (!sessions.length) {
      container.innerHTML = '<div class="empty">Aún no hay sesiones registradas.</div>';
      return;
    }
    
    container.innerHTML = sessions.map((s) => `
      <article class="card">
        <div class="card-header">
          <div>
            <h3>${formatDate(s.date)}</h3>
            <p>Pagó ${money(s.amount)}</p>
            <p>${escapeHTML(s.notes || "Sin notas")}</p>
          </div>
        </div>
        <div class="card-actions">
          <button class="secondary" onclick="window.editarSesion(${s.id})">✏️ Editar</button>
          <button class="danger" onclick="window.eliminarSesion(${s.id}, ${treatmentId})">🗑️ Eliminar</button>
        </div>
      </article>
    `).join("");
  }
  
  window.editarSesion = (id) => {
    const session = get("sessions", id);
    if (session) showSessionForm(session);
  };
  
  window.eliminarSesion = async (id, treatmentId) => {
    if (!confirm("¿Eliminar esta sesión?")) return;
    await remove("sessions", id);
    renderDetalleTratamiento(treatmentId);
    renderDashboard();
  };

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
    
    if (id) {
      await put("sessions", payload);
    } else {
      await add("sessions", payload);
    }
    
    event.target.reset();
    closePanel($("#panelSesion"));
    renderDetalleTratamiento(treatmentId);
    renderDashboard();
  }

  // ========== MATERIALES ==========
  function initMateriales() {
    $("#btnNuevoMaterial")?.addEventListener("click", () => showMaterialForm());
    $("#btnCancelarMaterial")?.addEventListener("click", () => closePanel($("#panelMaterial")));
    $("#formMaterial")?.addEventListener("submit", saveMaterial);
    $$("[data-filtro-material]").forEach((btn) => btn.addEventListener("click", () => {
      filtroMaterial = btn.dataset.filtroMaterial;
      $$("[data-filtro-material]").forEach((item) => item.classList.toggle("active", item === btn));
      renderMateriales();
    }));
    renderMateriales();
  }

  function renderMateriales() {
    const materials = getStore("materials");
    const list = materials
      .filter((item) => filtroMaterial === "todos" || (filtroMaterial === "pendientes" ? !item.purchased : item.purchased))
      .sort((a, b) => Number(a.purchased) - Number(b.purchased));
    
    const container = $("#listaMateriales");
    if (!container) return;
    
    if (!list.length) {
      container.innerHTML = '<div class="empty">No hay materiales en este filtro.</div>';
      return;
    }
    
    container.innerHTML = list.map((item) => `
      <article class="card ${item.purchased ? "material-done" : ""}">
        <div class="card-header">
          <label class="check-row">
            <input type="checkbox" onchange="window.toggleMaterial(${item.id}, this.checked)" ${item.purchased ? "checked" : ""}>
            <span>
              <h3>${escapeHTML(item.name)}</h3>
              <p>${escapeHTML(item.quantity)} ${item.category ? "· " + escapeHTML(item.category) : ""}</p>
            </span>
          </label>
          <span class="badge">${item.purchased ? "Comprado" : "Pendiente"}</span>
        </div>
        <div class="card-actions">
          <button class="secondary" onclick="window.editarMaterial(${item.id})">✏️ Editar</button>
          <button class="danger" onclick="window.eliminarMaterial(${item.id})">🗑️ Eliminar</button>
        </div>
      </article>
    `).join("");
  }

  window.toggleMaterial = async (id, purchased) => {
    const item = await get("materials", id);
    await put("materials", { ...item, purchased });
    renderMateriales();
    renderDashboard();
  };

  window.editarMaterial = (id) => {
    const item = get("materials", id);
    if (item) showMaterialForm(item);
  };

  window.eliminarMaterial = async (id) => {
    if (!confirm("¿Eliminar este material?")) return;
    await remove("materials", id);
    renderMateriales();
    renderDashboard();
  };

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
    const payload = {
      id: id ? Number(id) : undefined,
      name: $("#materialNombre").value.trim(),
      quantity: $("#materialCantidad").value.trim(),
      category: $("#materialCategoria").value.trim(),
      purchased: false
    };
    
    if (id) {
      await put("materials", payload);
    } else {
      await add("materials", payload);
    }
    
    event.target.reset();
    closePanel($("#panelMaterial"));
    renderMateriales();
    renderDashboard();
  }

  // ========== TRABAJOS EXTERNOS ==========
  function initTrabajos() {
    $("#btnNuevoTrabajo")?.addEventListener("click", () => showJobForm());
    $("#btnCancelarTrabajo")?.addEventListener("click", () => closePanel($("#panelTrabajo")));
    $("#formTrabajo")?.addEventListener("submit", saveJob);
    $("#buscarTrabajo")?.addEventListener("input", () => renderTrabajos());
    renderTrabajos();
    cargarSelectPacientes("#trabajoPaciente");
  }

  function renderTrabajos() {
    const jobs = getStore("jobs");
    const patients = getStore("patients");
    const query = ($("#buscarTrabajo")?.value || "").toLowerCase();
    
    const list = jobs
      .filter((job) => [job.type, job.status, patientName(job.patientId, patients)].join(" ").toLowerCase().includes(query))
      .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
    
    const container = $("#listaTrabajos");
    if (!container) return;
    
    if (!list.length) {
      container.innerHTML = '<div class="empty">No hay trabajos externos registrados.</div>';
      return;
    }
    
    container.innerHTML = list.map((job) => `
      <article class="card">
        <div class="card-header">
          <div>
            <h3>${escapeHTML(job.type)} - ${escapeHTML(patientName(job.patientId, patients))}</h3>
            <p>Pedido: ${formatDate(job.orderDate)}</p>
            <p>Prometido: ${formatDate(job.promisedDate)}</p>
            <p>Costo: ${money(job.cost)}</p>
          </div>
          <span class="badge">${escapeHTML(job.status)}</span>
        </div>
        <div class="card-actions">
          <select onchange="window.cambiarEstadoTrabajo(${job.id}, this.value)">
            <option ${job.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
            <option ${job.status === "Recibido" ? "selected" : ""}>Recibido</option>
            <option ${job.status === "Entregado al paciente" ? "selected" : ""}>Entregado al paciente</option>
          </select>
          <button class="secondary" onclick="window.editarTrabajo(${job.id})">✏️ Editar</button>
          <button class="danger" onclick="window.eliminarTrabajo(${job.id})">🗑️ Eliminar</button>
        </div>
      </article>
    `).join("");
  }

  window.cambiarEstadoTrabajo = async (id, status) => {
    const job = await get("jobs", id);
    await put("jobs", { ...job, status });
    renderTrabajos();
    renderDashboard();
  };

  window.editarTrabajo = (id) => {
    const job = get("jobs", id);
    if (job) showJobForm(job);
  };

  window.eliminarTrabajo = async (id) => {
    if (!confirm("¿Eliminar este trabajo externo?")) return;
    await remove("jobs", id);
    renderTrabajos();
    renderDashboard();
  };

  function showJobForm(job) {
    cargarSelectPacientes("#trabajoPaciente", job?.patientId);
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
    const patientId = $("#trabajoPaciente").value;
    
    if (!patientId) {
      alert("❌ Selecciona un paciente");
      return;
    }
    
    const payload = {
      id: id ? Number(id) : undefined,
      patientId: Number(patientId),
      type: $("#trabajoTipo").value,
      orderDate: $("#trabajoPedido").value,
      promisedDate: $("#trabajoPrometida").value,
      cost: Number($("#trabajoCosto").value || 0),
      status: $("#trabajoEstado").value,
      notifiedTwoDays: false
    };
    
    if (id) {
      await put("jobs", payload);
    } else {
      await add("jobs", payload);
    }
    
    event.target.reset();
    closePanel($("#panelTrabajo"));
    renderTrabajos();
    renderDashboard();
  }

  // ========== NOTIFICACIONES ==========
  window.activarNotificaciones = () => {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones.");
      return;
    }
    Notification.requestPermission().then((result) => {
      alert(result === "granted" ? "✅ Notificaciones activadas" : "❌ No se activaron");
    });
  };

  $("#btnNotificaciones")?.addEventListener("click", window.activarNotificaciones);

  // ========== EXPORTAR FUNCIONES GLOBALES ==========
  window.exportarDatos = () => {
    const data = {};
    for (const store of STORES) {
      data[store] = getStore(store);
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

  window.importarDatos = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
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

  window.marcarTodosMaterialesComprados = async () => {
    if (!confirm("¿Marcar TODOS los materiales como comprados?")) return;
    const materials = getStore("materials");
    for (const material of materials) {
      await put("materials", { ...material, purchased: true });
    }
    renderMateriales();
    renderDashboard();
    alert("✅ Todos los materiales marcados como comprados");
  };

  // Configurar importar archivo
  document.getElementById("importFile")?.addEventListener("change", (e) => {
    if (e.target.files[0]) window.importarDatos(e.target.files[0]);
    e.target.value = "";
  });

})();