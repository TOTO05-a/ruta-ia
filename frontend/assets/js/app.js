(() => {
  "use strict";

  const API = "/api/v1";
  const state = { student: null, csrf: "", page: "home", catalogPage: 1, catalogLayout: "grid", query: null, toastTimer: null };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && state.csrf) headers.set("X-CSRF-Token", state.csrf);
    let response;
    try {
      response = await fetch(`${API}${path}`, { ...options, method, headers, credentials: "include" });
    } catch {
      throw new Error("No se pudo conectar con RutaIA. Comprueba que la API esté disponible.");
    }
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || "No se pudo completar la solicitud.");
      error.code = payload?.error?.code;
      error.status = response.status;
      throw error;
    }
    return payload.data ?? payload;
  }

  function setMessage(element, message, kind = "") {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", kind === "error");
    element.classList.toggle("success", kind === "success");
  }

  function toast(message, isError = false) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.toggle("error", isError);
    element.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
  }

  function setLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
      button.dataset.label = button.textContent;
      button.disabled = true;
      button.textContent = text;
    } else {
      button.disabled = false;
      if (button.dataset.label) button.textContent = button.dataset.label;
      delete button.dataset.label;
    }
  }

  function setCatalogConnection(connected) {
    const label = $(".catalog-status strong");
    const detail = $(".catalog-status small");
    const top = $(".connection-label");
    if (label) label.textContent = connected ? "Catálogo disponible" : "Catálogo no disponible";
    if (detail) detail.textContent = connected ? "Cursos activos" : "API sin conexión";
    if (top) top.innerHTML = `<span class="live-dot"></span>${connected ? "Catálogo institucional" : "Conexión pendiente"}`;
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("rutaia-theme", theme);
  }

  function setAuthMode(mode) {
    const login = mode === "login";
    $("#login-form").classList.toggle("hidden", !login);
    $("#register-form").classList.toggle("hidden", login);
    $("#login-tab").classList.toggle("active", login);
    $("#register-tab").classList.toggle("active", !login);
    $("#login-tab").setAttribute("aria-selected", String(login));
    $("#register-tab").setAttribute("aria-selected", String(!login));
    $("#auth-title").innerHTML = login ? 'Encuentra tu<br><span class="text-gradient">siguiente ruta.</span>' : 'Construye tu<br><span class="text-gradient">siguiente ruta.</span>';
    setMessage($("#auth-message"), "");
  }

  function showApp(student) {
    state.student = student;
    $("#auth-view").classList.add("hidden");
    $("#app-view").classList.remove("hidden");
    $("#welcome-name").textContent = (student.fullName || "estudiante").split(" ")[0];
    $("#sidebar-user-name").textContent = student.fullName;
    $("#sidebar-user-area").textContent = student.interestArea || "Mi perfil";
    $("#user-avatar").textContent = (student.fullName || "R").trim().charAt(0).toUpperCase();
    $("#admin-nav").classList.toggle("hidden", student.role !== "admin");
    const profile = $("#profile-form");
    profile.elements.fullName.value = student.fullName || "";
    profile.elements.email.value = student.email || "";
    profile.elements.experienceLevel.value = student.experienceLevel || "Principiante";
    profile.elements.interestArea.value = student.interestArea || "";
    showPage("home");
  }

  async function refreshSession() {
    try {
      const data = await api("/auth/me");
      const token = await api("/auth/csrf");
      state.csrf = token.csrfToken;
      showApp(data.student);
    } catch (error) {
      $("#auth-view").classList.remove("hidden");
      $("#app-view").classList.add("hidden");
      if (error.status !== 401) setMessage($("#auth-message"), error.message, "error");
    }
  }

  async function submitAuth(form, endpoint) {
    const button = $("button[type=submit]", form);
    setMessage($("#auth-message"), "");
    setLoading(button, true, endpoint === "/auth/login" ? "Entrando…" : "Creando cuenta…");
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const result = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      state.csrf = result.csrfToken;
      showApp(result.student);
    } catch (error) {
      setMessage($("#auth-message"), error.message, "error");
    } finally {
      setLoading(button, false);
    }
  }

  function showPage(page) {
    if (page.startsWith("admin-") && state.student?.role !== "admin") page = "home";
    state.page = page;
    $$(".page-view").forEach((view) => view.classList.toggle("active", view.dataset.view === page));
    $$(".nav-item[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
    const names = { home: "INICIO", catalog: "EXPLORAR CURSOS", history: "MI HISTORIAL", profile: "MI PERFIL", "admin-courses": "CURSOS", "admin-students": "ESTUDIANTES", "admin-stats": "ESTADÍSTICAS" };
    $("#page-breadcrumb").textContent = names[page] || "INICIO";
    closeSidebar();
    if (page === "home") loadHome();
    if (page === "catalog") loadCatalog();
    if (page === "history") loadHistory();
    if (page === "admin-courses") loadAdminCourses();
    if (page === "admin-students") loadAdminStudents();
    if (page === "admin-stats") loadStatistics();
  }

  async function loadCourses(path, container, { compact = false, admin = false } = {}) {
    container.replaceChildren(node("div", "loading-card", "Cargando cursos institucionales…"));
    try {
      const result = await api(path);
      setCatalogConnection(true);
      const items = result.items || [];
      container.replaceChildren();
      if (!items.length) {
        container.append(node("div", "empty-state", "No hay cursos disponibles con estos filtros."));
        return result;
      }
      items.forEach((course) => container.append(admin ? adminCourseCard(course) : courseCard(course, compact)));
      return result;
    } catch (error) {
      setCatalogConnection(false);
      container.replaceChildren(node("div", "empty-state", error.message));
      return null;
    }
  }

  function courseCard(course) {
    const card = node("article", "course-card");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Ver ${course.name}`);
    const top = node("div", "course-card-top");
    top.append(node("span", "course-category", course.category), node("span", "course-level", course.level));
    card.append(top, node("h3", "", course.name), node("p", "", course.description));
    const footer = node("div", "course-card-footer");
    footer.append(node("span", "", `${course.durationHours} horas`), node("span", "course-open", "Ver detalle ↗"));
    card.append(footer);
    card.addEventListener("click", () => showCourseDetail(course));
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showCourseDetail(course); } });
    return card;
  }

  function showCourseDetail(course) {
    const content = $("#detail-content");
    content.replaceChildren();
    content.append(node("div", "eyebrow", course.category), node("h2", "", course.name), node("p", "", course.description));
    const meta = node("div", "source-meta");
    meta.append(node("span", "", `Nivel: ${course.level}`), node("span", "", `Duración: ${course.durationHours} horas`));
    content.append(meta);
    $("#detail-dialog").showModal();
  }

  async function loadHome() {
    await loadCourses("/courses?limit=3", $("#home-courses"), { compact: true });
  }

  async function loadCatalog(page = 1) {
    state.catalogPage = page;
    const form = $("#catalog-filters");
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    const values = Object.fromEntries(new FormData(form).entries());
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    const result = await loadCourses(`/courses?${params}`, $("#catalog-courses"));
    const grid = $("#catalog-courses");
    grid.classList.toggle("list-layout", state.catalogLayout === "list");
    const summary = $("#catalog-summary");
    const pagination = $("#catalog-pagination");
    pagination.replaceChildren();
    if (!result) { summary.textContent = ""; return; }
    const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
    summary.textContent = `${result.total} curso${result.total === 1 ? "" : "s"} activo${result.total === 1 ? "" : "s"}`;
    const previous = node("button", "", "←");
    previous.disabled = page <= 1;
    previous.setAttribute("aria-label", "Página anterior");
    previous.addEventListener("click", () => loadCatalog(page - 1));
    const current = node("span", "list-summary", `Página ${page} de ${totalPages}`);
    const next = node("button", "", "→");
    next.disabled = page >= totalPages;
    next.setAttribute("aria-label", "Página siguiente");
    next.addEventListener("click", () => loadCatalog(page + 1));
    pagination.append(previous, current, next);
    populateCategories(result.items);
  }

  function populateCategories(items) {
    const select = $("#catalog-filters").elements.category;
    const selected = select.value;
    const categories = [...new Set(items.map((course) => course.category))].sort((a, b) => a.localeCompare(b, "es"));
    select.replaceChildren(new Option("Todas las categorías", ""));
    categories.forEach((category) => select.add(new Option(category, category)));
    select.value = selected;
  }

  async function loadHistory() {
    const status = $("#history-filters").elements.status.value;
    const params = new URLSearchParams({ limit: "50" });
    if (status) params.set("status", status);
    const list = $("#history-list");
    list.replaceChildren(node("div", "loading-card", "Cargando historial…"));
    try {
      const result = await api(`/queries?${params}`);
      list.replaceChildren();
      if (!result.items.length) return list.append(node("div", "empty-state", "Todavía no tienes consultas guardadas."));
      result.items.forEach((item) => list.append(historyCard(item)));
    } catch (error) {
      list.replaceChildren(node("div", "empty-state", error.message));
    }
  }

  function statusPill(status) {
    const className = status === "Respondida" ? "respondida" : status === "Pendiente" ? "pendiente" : status === "Error" ? "error" : "sin-resultados";
    return node("span", `status-pill ${className}`, status);
  }

  function formatDate(date) {
    try { return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)); }
    catch { return ""; }
  }

  function historyCard(query) {
    const card = node("article", "history-card");
    const copy = node("div");
    copy.append(node("span", "course-category", formatDate(query.createdAt)), node("h3", "", query.question));
    const summary = query.summary || (query.status === "Error" ? "No se pudo completar esta consulta." : query.status === "Sin resultados" ? "No se encontraron cursos relevantes." : "Los resultados aparecerán aquí al finalizar.");
    copy.append(node("p", "", summary));
    const meta = node("div", "history-card-meta");
    meta.append(statusPill(query.status), node("span", "", `${(query.sources || []).length} fuentes`));
    card.append(copy, meta);
    card.addEventListener("click", () => openSavedQuery(query.id));
    return card;
  }

  async function openSavedQuery(id) {
    try {
      const query = await api(`/queries/${encodeURIComponent(id)}`);
      renderResult(query, $("#detail-content"));
      $("#detail-dialog").showModal();
    } catch (error) { toast(error.message, true); }
  }

  async function submitQuery(event) {
    event.preventDefault();
    const input = $("#question-input");
    const button = $("#ask-button");
    setMessage($("#query-message"), "");
    setLoading(button, true, "Buscando en el catálogo…");
    try {
      const created = await api("/queries", { method: "POST", body: JSON.stringify({ question: input.value }) });
      state.query = created;
      await displayQuery(created.id);
      if (created.status === "Pendiente") {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await sleep(1200);
          const current = await api(`/queries/${encodeURIComponent(created.id)}`);
          if (current.status !== "Pendiente") { renderResult(current, $("#latest-result")); break; }
        }
        const current = await api(`/queries/${encodeURIComponent(created.id)}`);
        if (current.status === "Pendiente") {
          renderResult(current, $("#latest-result"));
          setMessage($("#query-message"), "La consulta sigue procesándose. Puedes ver su estado en tu historial.");
        }
      }
      input.value = "";
      $("#latest-result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setMessage($("#query-message"), error.message, "error");
    } finally {
      setLoading(button, false);
    }
  }

  async function displayQuery(id) {
    const query = await api(`/queries/${encodeURIComponent(id)}`);
    renderResult(query, $("#latest-result"));
  }

  function renderResult(query, target) {
    target.replaceChildren();
    target.classList.remove("hidden");
    const top = node("div", "result-top");
    const heading = node("div");
    heading.append(node("div", "eyebrow", `CONSULTA · ${formatDate(query.createdAt)}`), node("h2", "", query.status === "Respondida" ? "Tu ruta recomendada" : query.status));
    top.append(heading, statusPill(query.status));
    target.append(top, node("p", "muted", query.question));
    if (query.status === "Pendiente") {
      target.append(node("p", "result-answer", "Tu pregunta se está procesando con el catálogo institucional."));
      return;
    }
    if (query.status === "Error") {
      target.append(node("p", "result-answer", "No fue posible completar la recomendación en este momento. Puedes volver a intentarlo más tarde."));
      return;
    }
    if (query.status === "Sin resultados") {
      target.append(node("p", "result-answer", "No encontramos cursos del catálogo que respondan suficientemente a esta consulta. Prueba con un tema relacionado con programación, datos, inteligencia artificial o automatización."));
      return;
    }
    target.append(node("p", "result-answer", query.answer || ""));
    if (query.explanation) target.append(node("div", "result-explanation", query.explanation));
    const sources = node("div", "source-list");
    (query.sources || []).forEach((source) => sources.append(sourceCard(source)));
    target.append(sources);
    if (query.recommendationId) target.append(ratingControl(query.recommendationId));
  }

  function sourceCard(source) {
    const card = node("article", "source-card");
    card.append(node("h3", "", source.name), node("p", "", source.description || ""));
    const meta = node("div", "source-meta");
    meta.append(node("span", "", source.category || ""), node("span", "", source.level || ""), node("span", "", `${source.durationHours} h`));
    const similarity = Number(source.similarity);
    if (Number.isFinite(similarity)) meta.append(node("strong", "", `Puntaje vectorial ${similarity.toFixed(3)}`));
    card.append(meta);
    return card;
  }

  function ratingControl(recommendationId) {
    const row = node("div", "rating-row");
    row.append(node("span", "", "¿Te fue útil?"));
    const comment = document.createElement("input");
    comment.className = "rating-comment";
    comment.placeholder = "Comentario opcional";
    comment.maxLength = 2000;
    comment.setAttribute("aria-label", "Comentario opcional sobre la recomendación");
    comment.style.maxWidth = "250px";
    for (let score = 1; score <= 5; score += 1) {
      const button = node("button", "star-button", "★");
      button.type = "button";
      button.setAttribute("aria-label", `Calificar con ${score} de 5 estrellas`);
      button.addEventListener("click", async () => {
        try {
          await api(`/recommendations/${encodeURIComponent(recommendationId)}/rating`, {
            method: "POST", body: JSON.stringify({ score, ...(comment.value.trim() ? { comment: comment.value.trim() } : {}) })
          });
          $$(".star-button", row).forEach((star, index) => star.classList.toggle("selected", index < score));
          comment.disabled = true;
          toast("Gracias por calificar esta recomendación.");
        } catch (error) { toast(error.message, true); }
      });
      row.append(button);
    }
    row.append(comment);
    return row;
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      fullName: form.elements.fullName.value.trim(),
      experienceLevel: form.elements.experienceLevel.value,
      interestArea: form.elements.interestArea.value.trim()
    };
    try {
      const result = await api("/students/me", { method: "PATCH", body: JSON.stringify(body) });
      state.student = result;
      showApp(result);
      setMessage($("#profile-message"), "Perfil actualizado.", "success");
    } catch (error) { setMessage($("#profile-message"), error.message, "error"); }
  }

  function adminCourseCard(course) {
    const row = node("article", "admin-course-card");
    const title = node("div", "admin-course-title");
    title.append(node("strong", "", course.name), node("small", "", `${course.category} · ${course.level} · ${course.durationHours} h`));
    row.append(title, node("div", "admin-course-description", course.description), node("span", "course-level", course.isActive ? "Activo" : "Inactivo"));
    const actions = node("div", "admin-course-actions");
    const edit = node("button", "small-action", "Editar");
    edit.type = "button"; edit.addEventListener("click", () => openCourseForm(course));
    const toggle = node("button", `small-action ${course.isActive ? "danger" : ""}`, course.isActive ? "Desactivar" : "Activar");
    toggle.type = "button";
    toggle.addEventListener("click", () => changeCourseStatus(course));
    actions.append(edit, toggle);
    row.append(actions);
    return row;
  }

  async function loadAdminCourses() {
    await loadCourses("/admin/courses?limit=100", $("#admin-courses"), { admin: true });
  }

  function openCourseForm(course) {
    const form = $("#course-form");
    form.reset();
    setMessage($("#course-form-message"), "");
    form.elements.id.value = course?.id || "";
    if (course) {
      form.elements.name.value = course.name;
      form.elements.description.value = course.description;
      form.elements.category.value = course.category;
      form.elements.level.value = course.level;
      form.elements.durationHours.value = course.durationHours;
    }
    $("#course-dialog-title").textContent = course ? "Editar curso" : "Nuevo curso";
    $("#course-save-button").textContent = course ? "Guardar cambios ↗" : "Guardar curso ↗";
    $("#course-dialog").showModal();
  }

  async function saveCourse(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.id.value;
    const body = {
      name: form.elements.name.value.trim(),
      description: form.elements.description.value.trim(),
      category: form.elements.category.value.trim(),
      level: form.elements.level.value,
      durationHours: Number(form.elements.durationHours.value)
    };
    const button = $("#course-save-button");
    setLoading(button, true, "Guardando…");
    try {
      await api(id ? `/admin/courses/${encodeURIComponent(id)}` : "/admin/courses", {
        method: id ? "PATCH" : "POST", body: JSON.stringify(body)
      });
      $("#course-dialog").close();
      await loadAdminCourses();
      toast("Curso guardado en el catálogo relacional.");
    } catch (error) { setMessage($("#course-form-message"), error.message, "error"); }
    finally { setLoading(button, false); }
  }

  async function changeCourseStatus(course) {
    const action = course.isActive ? "desactivar" : "activar";
    if (!window.confirm(`¿Quieres ${action} “${course.name}”?`)) return;
    try {
      await api(`/admin/courses/${encodeURIComponent(course.id)}/status`, { method: "PATCH", body: JSON.stringify({ isActive: !course.isActive }) });
      await loadAdminCourses();
      toast(`Curso ${course.isActive ? "desactivado" : "activado"}.`);
    } catch (error) { toast(error.message, true); }
  }

  async function loadAdminStudents() {
    const container = $("#admin-students-list");
    container.replaceChildren(node("div", "loading-card", "Cargando estudiantes…"));
    try {
      const result = await api("/students?limit=100");
      container.replaceChildren();
      if (!result.items.length) return container.append(node("div", "empty-state", "No hay estudiantes registrados."));
      result.items.forEach((student) => {
        const row = node("article", "admin-course-card");
        const title = node("div", "admin-course-title");
        title.append(node("strong", "", student.fullName), node("small", "", student.email));
        row.append(title, node("div", "admin-course-description", `${student.interestArea} · ${student.experienceLevel}`), node("span", "course-level", student.role === "admin" ? "Administrador" : "Estudiante"));
        container.append(row);
      });
    } catch (error) { container.replaceChildren(node("div", "empty-state", error.message)); }
  }

  async function loadStatistics() {
    const container = $("#stats-grid");
    container.replaceChildren(node("div", "loading-card", "Cargando estadísticas…"));
    try {
      const stats = await api("/admin/statistics");
      const items = [
        ["Total de consultas", stats.totalQueries, "Histórico completo"],
        ["Respondidas", stats.answeredQueries, "Con fuentes guardadas"],
        ["Sin resultados", stats.noResultQueries, "Sin cursos relevantes"],
        ["Promedio de calificación", stats.averageRating ?? "—", "Escala de 1 a 5"],
        ["Curso más recomendado", stats.mostRecommendedCourse?.name || "—", stats.mostRecommendedCourse ? `${stats.mostRecommendedCourse.recommendation_count} recomendaciones` : "Sin recomendaciones"]
      ];
      container.replaceChildren();
      items.forEach(([label, value, detail]) => {
        const card = node("article", "stat-card");
        card.append(node("span", "", label), node("strong", "", String(value)), node("small", "", detail));
        container.append(card);
      });
    } catch (error) { container.replaceChildren(node("div", "empty-state", error.message)); }
  }

  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#sidebar-scrim").classList.remove("show");
  }

  function bindEvents() {
    $("#login-tab").addEventListener("click", () => setAuthMode("login"));
    $("#register-tab").addEventListener("click", () => setAuthMode("register"));
    $("#login-form").addEventListener("submit", (event) => { event.preventDefault(); submitAuth(event.currentTarget, "/auth/login"); });
    $("#register-form").addEventListener("submit", (event) => { event.preventDefault(); submitAuth(event.currentTarget, "/auth/register"); });
    $("#query-form").addEventListener("submit", submitQuery);
    $$(".suggestion").forEach((button) => button.addEventListener("click", () => { $("#question-input").value = button.dataset.question; $("#question-input").focus(); }));
    $$(".nav-item[data-page]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
    $$("[data-go]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.go)));
    $("#catalog-filters").addEventListener("submit", (event) => { event.preventDefault(); loadCatalog(1); });
    $("#history-filters").addEventListener("submit", (event) => { event.preventDefault(); loadHistory(); });
    $("#profile-form").addEventListener("submit", saveProfile);
    $("#new-course-button").addEventListener("click", () => openCourseForm(null));
    $("#course-form").addEventListener("submit", saveCourse);
    $("#menu-toggle").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#sidebar-scrim").classList.add("show"); });
    $("#sidebar-scrim").addEventListener("click", closeSidebar);
    $$("#theme-toggle, #top-theme-toggle").forEach((button) => button.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light")));
    $$("[data-layout]").forEach((button) => button.addEventListener("click", () => {
      state.catalogLayout = button.dataset.layout;
      $$("[data-layout]").forEach((item) => item.classList.toggle("active", item === button));
      $("#catalog-courses").classList.toggle("list-layout", state.catalogLayout === "list");
    }));
    $("#logout-button").addEventListener("click", async () => {
      try { await api("/auth/logout", { method: "POST" }); } catch (error) { toast(error.message, true); }
      state.csrf = ""; state.student = null;
      $("#app-view").classList.add("hidden"); $("#auth-view").classList.remove("hidden"); setAuthMode("login");
    });
  }

  function init() {
    const theme = localStorage.getItem("rutaia-theme");
    if (theme === "light" || theme === "dark") setTheme(theme);
    bindEvents();
    refreshSession();
  }

  init();
})();
