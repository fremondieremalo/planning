/* =====================================================================
   Planning : configuration (à renseigner une seule fois)
   ===================================================================== */
const CONFIG = {
  owner: "fremondieremalo", // ton identifiant GitHub
  repo: "planning", // le dépôt qui contient ce site
  branch: "main",
  file: "data.json",
};

const CATEGORIES = {
  muscu: "Muscu",
  course: "Course",
  etirements: "Étirements",
  ecole: "École",
  autres: "Autres tâches",
};
const CAT_ORDER = Object.keys(CATEGORIES);
const IMPORTANCE = { faible: "faible", moyenne: "moyenne", extreme: "extrême" };

/* Séances de muscu préenregistrées (proposées quand la catégorie est « Muscu ») */
const SEANCES_MUSCU = [
  {
    id: "upper",
    title: "Séance Upper",
    description:
      "Développé couché\nBi-set : rowing + tirage bûcheron\nBi-set : développé militaire + élévations latérales\nBi-set : curl pupitre + curl brachial\nBi-set : dips + lever altéré",
  },
  {
    id: "lower",
    title: "Séance Lower",
    description: "Squat\nRDL\nFentes bulgares\nRenfo mollets (pour la course)",
  },
];
const DAYS_AHEAD = 4; // aujourd'hui + 4 jours
const TOKEN_KEY = "planning.token";
const CACHE_KEY = "planning.cache";

/* ---------- Dates (heure locale, clés « AAAA-MM-JJ ») ---------- */
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const shiftKey = (k, n) => dateKey(addDays(parseKey(k), n));
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const today = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const $ = (sel) => document.querySelector(sel);
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ---------- État ---------- */
const state = {
  data: null,
  sha: null, // version actuelle du fichier sur GitHub
  dirty: false, // modifications pas encore envoyées
  saving: false,
  savePending: false,
  saveTimer: null,
  editingId: null,
  lastKey: dateKey(today()),
};

const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
const isConfigured = () => !CONFIG.owner.startsWith("TON_") && !CONFIG.repo.startsWith("TON_");
const canSync = () => isConfigured() && Boolean(getToken());
const findItem = (id) => state.data.items.find((it) => it.id === id);

function normalize(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    version: 1,
    items: Array.isArray(d.items) ? d.items : [],
    skipped: Array.isArray(d.skipped) ? d.skipped : [],
    daily: Array.isArray(d.daily) ? d.daily : [],
    byWeekday: d.byWeekday && typeof d.byWeekday === "object" ? d.byWeekday : {},
  };
}

function setSync(stateName, text) {
  const el = $("#sync");
  el.dataset.state = stateName;
  el.textContent = text;
}

/* ---------- Base64 (UTF-8 compatible) ---------- */
const b64encode = (str) => {
  let bin = "";
  new TextEncoder().encode(str).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};
const b64decode = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

/* ---------- API GitHub ---------- */
async function github(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}${path}`, {
    method,
    body,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${getToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchLocalFile() {
  const res = await fetch(CONFIG.file, { cache: "no-store" });
  if (!res.ok) throw new Error("data.json introuvable");
  return res.json();
}

/* Charge les données : GitHub si configuré, sinon copie locale, sinon data.json */
async function loadData() {
  try {
    if (canSync()) {
      const file = await github(`/contents/${CONFIG.file}?ref=${CONFIG.branch}`);
      state.sha = file.sha;
      state.data = normalize(JSON.parse(b64decode(file.content)));
      setSync("ok", "Synchronisé");
    } else {
      const cached = localStorage.getItem(CACHE_KEY);
      state.data = normalize(cached ? JSON.parse(cached) : await fetchLocalFile());
      setSync("local", "Mode local");
    }
    state.dirty = false;
  } catch (err) {
    console.error(err);
    const cached = localStorage.getItem(CACHE_KEY);
    state.data = normalize(cached ? JSON.parse(cached) : null);
    setSync(
      "error",
      err.status === 401 || err.status === 404 ? "Token ou dépôt invalide" : "Hors ligne : copie locale"
    );
  }
}

/* ---------- Sauvegarde ---------- */
function cleanup() {
  // On retire les vignettes du planning type plus vieilles que 3 jours : elles ne s'affichent plus.
  const cutoff = dateKey(addDays(today(), -3));
  state.data.items = state.data.items.filter((it) => !(it.planKey && it.date < cutoff));
  state.data.skipped = state.data.skipped.filter((k) => k.slice(0, 10) >= cutoff);
}

function persist() {
  cleanup();
  state.dirty = true;
  localStorage.setItem(CACHE_KEY, JSON.stringify(state.data));
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(pushRemote, 800);
}

async function pushRemote() {
  if (!canSync()) return;
  if (state.saving) {
    state.savePending = true;
    return;
  }
  state.saving = true;
  setSync("saving", "Enregistrement…");
  try {
    const res = await github(`/contents/${CONFIG.file}`, {
      method: "PUT",
      body: JSON.stringify({
        message: "Mise à jour du planning",
        content: b64encode(JSON.stringify(state.data, null, 2) + "\n"),
        sha: state.sha,
        branch: CONFIG.branch,
      }),
    });
    state.sha = res.content.sha;
    state.dirty = state.savePending;
    setSync("ok", "Synchronisé");
  } catch (err) {
    if (err.status === 409) {
      state.savePending = false;
      alert(
        "Le planning a été modifié depuis un autre appareil. Ta dernière modification n'a pas été enregistrée : la version la plus récente est affichée."
      );
      await loadData();
      refresh();
    } else {
      setSync("error", "Erreur d'envoi, nouvel essai dans 15 s");
      setTimeout(pushRemote, 15000);
    }
  } finally {
    state.saving = false;
    if (state.savePending) {
      state.savePending = false;
      pushRemote();
    }
  }
}

/* ---------- Planning type : génère les vignettes des 5 jours affichés ---------- */
function ensurePlanItems() {
  const { byWeekday, daily } = state.data;

  // Retire les vignettes automatiques dont l'activité n'est plus dans le planning type
  const planIds = new Set([...daily, ...Object.values(byWeekday).flat()].map((e) => e.id));
  state.data.items = state.data.items.filter((it) => !it.planKey || planIds.has(it.planKey.split("|")[1]));

  const { items, skipped } = state.data;
  const known = new Set(items.map((it) => it.planKey).filter(Boolean));
  const skip = new Set(skipped);

  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const day = addDays(today(), i);
    const key = dateKey(day);
    const plan = [...(byWeekday[day.getDay()] || []), ...daily];

    for (const entry of plan) {
      const planKey = `${key}|${entry.id}`;
      if (known.has(planKey) || skip.has(planKey)) continue;
      known.add(planKey);
      items.push({
        id: planKey,
        planKey,
        title: entry.title,
        category: entry.category,
        description: entry.description || "",
        date: key,
        importance: null,
        done: false,
        createdAt: key,
      });
    }
  }
}

/* ---------- Règles d'affichage ---------- */
function showOnDay(it, key) {
  if (it.category === "ecole" && (it.importance === "moyenne" || it.importance === "extreme")) {
    return key >= shiftKey(it.date, -2) && key <= it.date; // J-2, J-1, J
  }
  return it.date === key; // faible, ou autre catégorie : le jour J seulement
}

const isReminder = (it) => it.category === "ecole" && it.importance === "extreme";

const compareItems = (a, b) =>
  a.done - b.done ||
  CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) ||
  String(a.createdAt).localeCompare(String(b.createdAt));

/* ---------- Affichage ---------- */
function renderCard(it) {
  const label = CATEGORIES[it.category] || CATEGORIES.autres;
  const tag =
    it.category === "ecole" ? `${label} (${IMPORTANCE[it.importance] || IMPORTANCE.faible})` : label;
  return `
    <article class="card${it.done ? " is-done" : ""}" data-cat="${esc(it.category)}">
      <button type="button" class="card-body" data-open="${esc(it.id)}">
        <span class="card-cat">${esc(tag)}</span>
        <h3 class="card-title">${esc(it.title)}</h3>
        ${it.description ? `<p class="card-desc">${esc(it.description)}</p>` : ""}
      </button>
      <div class="card-foot">
        <button type="button" class="check" data-toggle="${esc(it.id)}" aria-pressed="${it.done}">
          <span class="box" aria-hidden="true"></span>Fait
        </button>
      </div>
    </article>`;
}

function renderReminder(it, key) {
  const n = daysBetween(key, it.date);
  return `
    <button type="button" class="reminder${it.done ? " is-done" : ""}" data-open="${esc(it.id)}">
      <span class="reminder-title">${esc(it.title)}</span>
      <span class="reminder-when">${n === 0 ? "Jour J" : `J-${n}`}</span>
    </button>`;
}

function renderDay(date, isToday, todayKey) {
  const key = dateKey(date);
  const items = state.data.items.filter((it) => showOnDay(it, key)).sort(compareItems);
  const reminders = state.data.items.filter((it) => isReminder(it) && key >= todayKey && key <= it.date);
  const name = cap(date.toLocaleDateString("fr-FR", { weekday: "long" }));
  const short = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return `
    <section class="day${isToday ? " is-today" : ""}">
      <header class="day-head">
        <h2 class="day-name">${name}</h2>
        <p class="day-date">${short}</p>
      </header>
      <div class="day-items">
        ${items.map(renderCard).join("") || `<p class="empty">Rien de prévu.</p>`}
      </div>
      ${
        reminders.length
          ? `<div class="reminders">${reminders.map((it) => renderReminder(it, key)).join("")}</div>`
          : ""
      }
    </section>`;
}

function render() {
  const now = today();
  const todayKey = dateKey(now);
  $("#today-label").textContent = cap(
    now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  );
  $("#board").innerHTML = Array.from({ length: DAYS_AHEAD + 1 }, (_, i) =>
    renderDay(addDays(now, i), i === 0, todayKey)
  ).join("");
}

function refresh() {
  ensurePlanItems();
  render();
  state.lastKey = dateKey(today());
}

/* ---------- Actions sur les vignettes ---------- */
function toggleDone(id) {
  const it = findItem(id);
  if (!it) return;
  it.done = !it.done;
  persist();
  render();
}

$("#board").addEventListener("click", (e) => {
  const check = e.target.closest("[data-toggle]");
  if (check) return toggleDone(check.dataset.toggle);
  const open = e.target.closest("[data-open]");
  if (open) openEditor(open.dataset.open);
});

/* ---------- Fenêtre ajouter / détails ---------- */
/* Affiche les champs propres à la catégorie choisie */
function syncFormFields() {
  const cat = $("#f-category").value;
  const isMuscu = cat === "muscu";
  $("#f-importance-wrap").hidden = cat !== "ecole";
  $("#f-seance-wrap").hidden = !isMuscu;
  $("#f-seance").required = isMuscu; // obligatoire seulement quand le champ est visible
}

/* Séance préenregistrée : remplit le nom et la description (modifiables ensuite) */
function applySeance() {
  const seance = SEANCES_MUSCU.find((s) => s.id === $("#f-seance").value);
  if (!seance) return;
  $("#f-title").value = seance.title;
  $("#f-description").value = seance.description;
}

function openEditor(id = null) {
  const it = id ? findItem(id) : null;
  state.editingId = it ? it.id : null;
  $("#item-title").textContent = it ? "Détails" : "Nouvelle vignette";
  $("#f-submit").textContent = it ? "Enregistrer" : "Ajouter";
  $("#f-title").value = it?.title ?? "";
  $("#f-category").value = it?.category ?? "course";
  $("#f-importance").value = it?.importance ?? "faible";
  $("#f-description").value = it?.description ?? "";
  $("#f-date").value = it?.date ?? dateKey(today());
  $("#f-delete").hidden = !it;

  // Séance muscu : on retrouve la séance préenregistrée, sinon on garde une option « Personnalisée »
  const seance = it?.category === "muscu" ? SEANCES_MUSCU.find((s) => s.title === it.title) : null;
  $("#f-seance").querySelector("[data-custom]")?.remove();
  if (it?.category === "muscu" && !seance) {
    $("#f-seance").insertAdjacentHTML("beforeend", '<option value="custom" data-custom>Personnalisée</option>');
  }
  $("#f-seance").value = seance?.id ?? (it?.category === "muscu" ? "custom" : "");

  syncFormFields();
  $("#item-dialog").showModal();
}

$("#add-btn").addEventListener("click", () => openEditor());
$("#f-category").addEventListener("change", syncFormFields);
$("#f-seance").addEventListener("change", applySeance);

// Remplit la liste des séances de muscu à partir de SEANCES_MUSCU
$("#f-seance").insertAdjacentHTML(
  "beforeend",
  SEANCES_MUSCU.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join("")
);

$("#item-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const category = $("#f-category").value;
  const values = {
    title: $("#f-title").value.trim(),
    category,
    importance: category === "ecole" ? $("#f-importance").value : null,
    description: $("#f-description").value.trim(),
    date: $("#f-date").value,
  };

  const existing = state.editingId ? findItem(state.editingId) : null;
  if (existing) {
    Object.assign(existing, values);
  } else {
    state.data.items.push({ id: uid(), ...values, done: false, createdAt: new Date().toISOString() });
  }

  $("#item-dialog").close();
  persist();
  refresh();
});

$("#f-delete").addEventListener("click", () => {
  const it = findItem(state.editingId);
  if (!it || !confirm(`Supprimer « ${it.title} » ?`)) return;
  // Une vignette du planning type supprimée ne doit pas réapparaître à sa date.
  if (it.planKey) state.data.skipped.push(it.planKey);
  state.data.items = state.data.items.filter((x) => x !== it);
  $("#item-dialog").close();
  persist();
  refresh();
});

/* ---------- Réglages ---------- */
function openSettings() {
  $("#s-token").value = "";
  $("#s-token").placeholder = getToken() ? "Token enregistré (laisse vide pour le garder)" : "github_pat_…";
  $("#s-repo").textContent = isConfigured()
    ? `Dépôt : ${CONFIG.owner}/${CONFIG.repo} (branche ${CONFIG.branch})`
    : "Renseigne owner et repo en haut de app.js.";
  $("#settings-dialog").showModal();
}

$("#settings-btn").addEventListener("click", openSettings);

$("#settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = $("#s-token").value.trim();
  $("#settings-dialog").close();
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    state.sha = null;
    await loadData();
  }
  refresh();
});

$("#s-forget").addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  state.sha = null;
  $("#settings-dialog").close();
  setSync("local", "Mode local");
});

$("#s-export").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" })
  );
  Object.assign(document.createElement("a"), { href: url, download: CONFIG.file }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("#s-sync").addEventListener("click", async () => {
  if (state.dirty && !confirm("Des modifications ne sont pas encore envoyées. Recharger quand même ?")) return;
  $("#settings-dialog").close();
  await loadData();
  refresh();
});

document.querySelectorAll("[data-close]").forEach((btn) =>
  btn.addEventListener("click", () => btn.closest("dialog").close())
);

/* ---------- Démarrage ---------- */
async function onVisible() {
  if (document.hidden) return;
  // Retour sur l'appli (ex. depuis le téléphone) : on reprend la version à jour de GitHub.
  if (canSync() && !state.dirty && !state.saving) await loadData();
  refresh();
}

async function init() {
  await loadData();
  refresh();
  document.addEventListener("visibilitychange", onVisible);
  // Passage de minuit : on décale les 5 jours affichés.
  setInterval(() => {
    if (dateKey(today()) !== state.lastKey) refresh();
  }, 60000);
}

init();
