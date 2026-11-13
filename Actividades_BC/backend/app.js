
// ==========================================
// CONFIGURACIÓN DEL SERVIDOR
// ==========================================

const API_URL = "https://bctareascontables.onrender.com/api";

console.log("Conectando con API:", API_URL);

// ==========================================
// VARIABLES GLOBALES
// ==========================================

const $ = id => document.getElementById(id);

let token = sessionStorage.getItem("gestor_token") || "";
let employee = sessionStorage.getItem("gestor_employee") || "";

let refreshTimer = null;
let refreshing = false;

// ==========================================
// AUTENTICACIÓN
// ==========================================

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

function logout() {
  clearInterval(refreshTimer);

  token = "";
  employee = "";

  sessionStorage.removeItem("gestor_token");
  sessionStorage.removeItem("gestor_employee");

  $("app").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");

  $("loginMessage").textContent = "";
  $("formMessage").textContent = "";
}

// ==========================================
// FUNCIÓN GENERAL PARA CONSUMIR LA API
// ==========================================

async function api(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    console.error("Error de conexión con la API:", error);

    throw new Error(
      "No se pudo conectar con el servidor. Verifica tu conexión a internet e inténtalo nuevamente."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    logout();
    throw new Error(
      data.message || "Tu sesión venció. Inicia sesión nuevamente."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message || "Ocurrió un error al procesar la solicitud."
    );
  }

  return data;
}

// ==========================================
// INICIAR SESIÓN
// ==========================================

$("loginBtn").addEventListener("click", async () => {
  $("loginMessage").textContent = "";

  const employeeName = $("employee").value.trim();
  const password = $("password").value;

  if (!employeeName || !password) {
    $("loginMessage").textContent =
      "Escribe tu nombre y la contraseña compartida.";

    return;
  }

  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Ingresando...";

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        employee: employeeName,
        password: password
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "No se pudo iniciar sesión."
      );
    }

    token = data.token;
    employee = data.employee;

    sessionStorage.setItem("gestor_token", token);
    sessionStorage.setItem("gestor_employee", employee);

    $("password").value = "";

    showApp();

  } catch (error) {
    console.error("Error al iniciar sesión:", error);

    $("loginMessage").textContent =
      error.message || "No se pudo conectar con el servidor.";

  } finally {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Iniciar sesión";
  }
});

// Permitir iniciar sesión presionando Enter
$("password").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    $("loginBtn").click();
  }
});

// ==========================================
// MOSTRAR APLICACIÓN
// ==========================================

function showApp() {
  $("loginPanel").classList.add("hidden");
  $("app").classList.remove("hidden");

  $("currentEmployee").textContent = employee;

  clearInterval(refreshTimer);

  refreshAll();

  refreshTimer = setInterval(() => {
    refreshAll();
  }, 3000);
}

// ==========================================
// CERRAR SESIÓN
// ==========================================

$("logoutBtn").addEventListener("click", logout);

// ==========================================
// GUARDAR NUEVA ACTIVIDAD
// ==========================================

$("taskForm").addEventListener("submit", async event => {
  event.preventDefault();

  $("formMessage").textContent = "";

  const title = $("title").value.trim();

  if (!title) {
    $("formMessage").textContent =
      "El título de la actividad es obligatorio.";

    return;
  }

  const saveButton = $("taskForm").querySelector(
    'button[type="submit"]'
  );

  saveButton.disabled = true;
  saveButton.textContent = "Guardando...";

  try {
    await api("/tasks", {
      method: "POST",

      body: JSON.stringify({
        title: title,
        description: $("description").value.trim(),
        dueDate: $("dueDate").value,
        responsible: $("responsible").value.trim()
      })
    });

    $("taskForm").reset();

    $("formMessage").textContent =
      "Actividad guardada correctamente.";

    $("formMessage").className = "success";

    await refreshAll();

  } catch (error) {
    console.error("Error al guardar actividad:", error);

    $("formMessage").textContent = error.message;
    $("formMessage").className = "error";

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Guardar actividad";
  }
});

// ==========================================
// ACTUALIZAR ACTIVIDADES E HISTORIAL
// ==========================================

async function refreshAll() {
  if (!token || refreshing) {
    return;
  }

  refreshing = true;

  try {
    const [tasks, history] = await Promise.all([
      api("/tasks"),
      api("/history")
    ]);

    renderTasks(tasks);
    renderHistory(history);

  } catch (error) {
    console.error("Error al actualizar información:", error);

  } finally {
    refreshing = false;
  }
}

// ==========================================
// PROTEGER TEXTO MOSTRADO EN HTML
// ==========================================

function safe(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

// ==========================================
// MOSTRAR ACTIVIDADES
// ==========================================

function renderTasks(tasks) {
  $("taskCount").textContent =
    `${tasks.length} actividad(es)`;

  if (!tasks.length) {
    $("tasks").innerHTML = `
      <p class="muted">
        Todavía no hay actividades registradas.
      </p>
    `;

    return;
  }

  $("tasks").innerHTML = tasks.map(task => `
    <article class="task ${task.completed ? "done" : ""}">

      <div>
        <div class="task-title">
          ${safe(task.title)}
        </div>

        <div>
          ${safe(task.description)}
        </div>

        <div class="tag">
          Fecha límite:
          ${safe(task.dueDate || "No definida")}
          · Responsable:
          ${safe(task.responsible || "Sin asignar")}
        </div>

        <div class="tag">
          Creada por:
          ${safe(task.createdBy)}
          ${
            task.completed
              ? ` · Completada por: ${safe(task.completedBy)}`
              : ""
          }
        </div>
      </div>

      <div class="actions">

        <button
          data-toggle="${safe(task._id)}"
          class="${task.completed ? "secondary" : ""}"
          type="button"
        >
          ${task.completed ? "Reabrir" : "Completar"}
        </button>

        <button
          class="danger"
          data-delete="${safe(task._id)}"
          type="button"
        >
          Eliminar
        </button>

      </div>

    </article>
  `).join("");

  // Botones para completar o reabrir
  $("tasks")
    .querySelectorAll("[data-toggle]")
    .forEach(button => {

      button.addEventListener("click", async () => {
        button.disabled = true;

        try {
          await api(
            `/tasks/${encodeURIComponent(button.dataset.toggle)}/toggle`,
            {
              method: "PATCH"
            }
          );

          await refreshAll();

        } catch (error) {
          alert(error.message);

        } finally {
          button.disabled = false;
        }
      });

    });

  // Botones para eliminar actividades
  $("tasks")
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener("click", async () => {

        const confirmed = confirm(
          "¿Eliminar esta actividad? Su historial se conservará."
        );

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await api(
            `/tasks/${encodeURIComponent(button.dataset.delete)}`,
            {
              method: "DELETE"
            }
          );

          await refreshAll();

        } catch (error) {
          alert(error.message);

        } finally {
          button.disabled = false;
        }
      });

    });
}

// ==========================================
// MOSTRAR HISTORIAL
// ==========================================

function renderHistory(items) {
  if (!items.length) {
    $("history").innerHTML = `
      <p class="muted">
        No hay movimientos registrados.
      </p>
    `;

    return;
  }

  $("history").innerHTML = items.map(item => `
    <div class="history-item">

      <strong>
        ${safe(item.action)}
      </strong>

      — ${safe(item.taskTitle)}

      <br>

      <span class="muted">
        ${safe(item.performedBy)}
        ·
        ${new Date(item.createdAt).toLocaleString("es-SV")}
      </span>

    </div>
  `).join("");
}


if (token && employee) {
  showApp();
}
