(() => {
  "use strict";

  const cfg = window.APP_CONFIG;
  const SLOTS = cfg.SLOTS;
  const NAME_KEY = "dogduty.name";
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const $ = (id) => document.getElementById(id);

  // ---------- Dates (ISO "YYYY-MM-DD" strings, arithmetic in UTC to dodge DST) ----------

  const toUTC = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const toISO = (date) => date.toISOString().slice(0, 10);
  const addDays = (iso, n) => {
    const d = toUTC(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return toISO(d);
  };
  const monthKey = (iso) => iso.slice(0, 7); // "YYYY-MM"
  const addMonths = (key, n) => {
    const [y, m] = key.split("-").map(Number);
    return toISO(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
  };
  const localToday = () => {
    const now = new Date();
    return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  };
  const inTrip = (iso) => iso >= cfg.TRIP_START && iso <= cfg.TRIP_END;
  const longDate = (iso) => {
    const d = toUTC(iso);
    return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
  };

  const tripDays = [];
  for (let d = cfg.TRIP_START; d <= cfg.TRIP_END; d = addDays(d, 1)) tripDays.push(d);

  // ---------- State ----------

  const state = {
    name: null,
    claims: new Map(), // "day|slot" -> person
    notes: new Map(),  // day -> note
    month: null,       // "YYYY-MM"
    openDay: null,
  };

  const claimKey = (day, slot) => `${day}|${slot}`;
  const sameName = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

  function knownNames() {
    const seen = new Map();
    const add = (n) => {
      if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
    };
    add(state.name);
    for (const p of state.claims.values()) add(p);
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  // Reuse an existing spelling so "sam" and "Sam" don't become two people.
  function canonicalName(raw) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    return knownNames().find((n) => sameName(n, name)) || name;
  }

  // ---------- Name storage (localStorage may be unavailable) ----------

  let memoryName = null;
  function loadName() {
    try {
      return localStorage.getItem(NAME_KEY) || memoryName;
    } catch {
      return memoryName;
    }
  }
  function saveName(name) {
    memoryName = name;
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* private mode: keep for this page session only */
    }
  }

  // ---------- UI helpers ----------

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children) if (c !== null && c !== undefined) node.append(c);
    return node;
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 4000);
  }

  function lockScroll() {
    const anyOpen = ["name-screen", "sheet", "picker"].some((id) => !$(id).hidden);
    document.body.classList.toggle("locked", anyOpen);
  }

  // ---------- Rendering ----------

  function renderHeader() {
    $("who").hidden = !state.name;
    $("who-name").textContent = state.name || "";
    const total = tripDays.length * SLOTS.length;
    let covered = 0;
    for (const d of tripDays) for (const s of SLOTS) if (state.claims.has(claimKey(d, s.key))) covered++;
    const mine = [...state.claims.values()].filter((p) => sameName(p, state.name)).length;
    $("coverage").textContent =
      `${covered} of ${total} slots covered` + (state.name ? ` · you have ${mine}` : "");
  }

  function renderCalendar() {
    const key = state.month;
    const [y, m] = key.split("-").map(Number);
    $("month-title").textContent = `${MONTHS[m - 1]} ${y}`;
    $("prev-month").disabled = key <= monthKey(cfg.TRIP_START);
    $("next-month").disabled = key >= monthKey(cfg.TRIP_END);

    const first = `${key}-01`;
    const lead = toUTC(first).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const today = localToday();
    const grid = $("grid");
    grid.replaceChildren();

    for (let i = 0; i < lead; i++) grid.append(el("div", { class: "cell blank" }));

    for (let n = 1; n <= daysInMonth; n++) {
      const day = `${key}-${String(n).padStart(2, "0")}`;
      if (!inTrip(day)) {
        grid.append(el("div", { class: "cell outside" + (day === today ? " today" : "") },
          el("span", { class: "num" }, String(n))));
        continue;
      }
      let filled = 0;
      const dots = el("span", { class: "dots" });
      for (const s of SLOTS) {
        const person = state.claims.get(claimKey(day, s.key));
        if (person) filled++;
        dots.append(el("i", {
          class: "dot" + (person ? " filled" : "") + (sameName(person, state.name) ? " mine" : ""),
        }));
      }
      const hasNote = (state.notes.get(day) || "").trim() !== "";
      const status = filled === SLOTS.length ? "full" : "open";
      grid.append(el("button", {
        type: "button",
        class: `cell trip ${status}` + (day === today ? " today" : ""),
        "aria-label": `${longDate(day)}: ${filled} of ${SLOTS.length} slots covered` + (hasNote ? ", has note" : ""),
        onclick: () => openSheet(day),
      },
        el("span", { class: "num" }, String(n), hasNote ? el("i", { class: "note-mark" }, "✎") : null),
        dots));
    }
  }

  function renderSheet() {
    const day = state.openDay;
    if (!day) return;
    $("sheet-title").textContent = longDate(day);
    $("prev-day").disabled = day <= cfg.TRIP_START;
    $("next-day").disabled = day >= cfg.TRIP_END;

    const list = $("slots");
    list.replaceChildren();
    for (const s of SLOTS) {
      const person = state.claims.get(claimKey(day, s.key));
      const li = el("li", { class: "slot" + (person ? " taken" : " open") + (sameName(person, state.name) ? " mine" : "") });
      li.append(el("span", { class: "slot-label" }, s.label));
      if (person) {
        li.append(
          el("span", { class: "slot-person" }, sameName(person, state.name) ? `${person} (you)` : person),
          el("span", { class: "slot-actions" },
            el("button", { type: "button", class: "link", onclick: () => openPicker(day, s, person) }, "reassign…"),
            el("button", { type: "button", class: "secondary small", onclick: () => release(day, s.key) }, "Release")));
      } else {
        li.append(
          el("span", { class: "slot-person empty" }, "Open"),
          el("span", { class: "slot-actions" },
            el("button", { type: "button", class: "link", onclick: () => openPicker(day, s, null) }, "assign…"),
            el("button", { type: "button", class: "primary small", onclick: () => claim(day, s.key, state.name) }, "Claim")));
      }
      list.append(li);
    }

    // Don't clobber what the user is typing.
    const ta = $("day-note");
    if (document.activeElement !== ta || ta.dataset.day !== day) {
      ta.value = state.notes.get(day) || "";
      ta.dataset.day = day;
    }
  }

  function renderAll() {
    renderHeader();
    renderCalendar();
    renderSheet();
  }

  // ---------- Name screen ----------

  function openNameScreen() {
    const input = $("name-input");
    input.value = state.name || "";
    const chips = $("name-chips");
    chips.replaceChildren();
    for (const n of knownNames()) {
      chips.append(el("button", {
        type: "button", class: "chip",
        onclick: () => { input.value = n; $("name-form").requestSubmit(); },
      }, n));
    }
    $("name-screen").hidden = false;
    lockScroll();
    input.focus();
  }

  $("name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = $("name-input").value;
    if (!raw.trim()) return;
    state.name = canonicalName(raw);
    saveName(state.name);
    $("name-screen").hidden = true;
    lockScroll();
    renderAll();
  });
  $("change-name").addEventListener("click", openNameScreen);

  // ---------- Day sheet ----------

  function openSheet(day) {
    flushNote();
    state.openDay = day;
    $("note-status").textContent = "";
    $("sheet").hidden = false;
    lockScroll();
    renderSheet();
  }
  function closeSheet() {
    flushNote();
    state.openDay = null;
    $("sheet").hidden = true;
    lockScroll();
  }
  $("close-sheet").addEventListener("click", closeSheet);
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeSheet(); });
  $("prev-day").addEventListener("click", () => openSheet(addDays(state.openDay, -1)));
  $("next-day").addEventListener("click", () => openSheet(addDays(state.openDay, 1)));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("picker").hidden) closePicker();
    else if (!$("sheet").hidden) closeSheet();
  });

  // ---------- Assign picker ----------

  let pickerTarget = null;
  function openPicker(day, slot, current) {
    pickerTarget = { day, slot: slot.key };
    $("picker-title").textContent = `${slot.label}, ${longDate(day)}`;
    const input = $("picker-input");
    input.value = "";
    const chips = $("picker-chips");
    chips.replaceChildren();
    for (const n of knownNames()) {
      if (sameName(n, current)) continue;
      chips.append(el("button", {
        type: "button", class: "chip",
        onclick: () => { input.value = n; $("picker-form").requestSubmit(); },
      }, n));
    }
    $("picker").hidden = false;
    lockScroll();
  }
  function closePicker() {
    pickerTarget = null;
    $("picker").hidden = true;
    lockScroll();
  }
  $("picker-cancel").addEventListener("click", closePicker);
  $("picker").addEventListener("click", (e) => { if (e.target === $("picker")) closePicker(); });
  $("picker-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = $("picker-input").value;
    if (!raw.trim() || !pickerTarget) return;
    const { day, slot } = pickerTarget;
    closePicker();
    claim(day, slot, canonicalName(raw));
  });

  // ---------- Data ----------

  const setupError = (msg) => {
    const box = $("setup-error");
    box.textContent = msg;
    box.hidden = false;
  };

  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
    setupError("Not set up yet: fill in SUPABASE_URL and SUPABASE_ANON_KEY in config.js.");
  }
  const db = window.supabase && !cfg.SUPABASE_URL.includes("YOUR-PROJECT")
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  // Optimistic update: apply locally, revert if the server rejects it.
  async function mutateClaim(day, slot, person) {
    const key = claimKey(day, slot);
    const before = state.claims.get(key);
    if (person) state.claims.set(key, person);
    else state.claims.delete(key);
    renderAll();

    if (!db) return;
    const { error } = person
      ? await db.from("claims").upsert({ day, slot, person })
      : await db.from("claims").delete().match({ day, slot });
    if (error) {
      if (before) state.claims.set(key, before);
      else state.claims.delete(key);
      renderAll();
      toast(`Couldn't save: ${error.message}`);
    }
  }

  function claim(day, slot, person) {
    if (!person) return openNameScreen();
    mutateClaim(day, slot, person);
  }
  function release(day, slot) {
    mutateClaim(day, slot, null);
  }

  // Day note: save after a pause in typing, and on blur / sheet close.
  let noteTimer = null;
  let notePending = null; // { day, note }

  $("day-note").addEventListener("input", (e) => {
    notePending = { day: e.target.dataset.day, note: e.target.value };
    $("note-status").textContent = "Editing…";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(flushNote, 800);
  });
  $("day-note").addEventListener("blur", flushNote);

  async function flushNote() {
    clearTimeout(noteTimer);
    if (!notePending) return;
    const { day, note } = notePending;
    notePending = null;
    const before = state.notes.get(day);
    state.notes.set(day, note);
    renderCalendar();

    if (!db) return;
    $("note-status").textContent = "Saving…";
    const { error } = await db.from("day_notes").upsert({ day, note });
    if (error) {
      if (before === undefined) state.notes.delete(day);
      else state.notes.set(day, before);
      renderCalendar();
      $("note-status").textContent = "";
      toast(`Couldn't save note: ${error.message}`);
    } else if (state.openDay === day && !notePending) {
      $("note-status").textContent = "Saved";
    }
  }

  async function loadAll() {
    if (!db) return;
    const [claims, notes] = await Promise.all([
      db.from("claims").select("day, slot, person").gte("day", cfg.TRIP_START).lte("day", cfg.TRIP_END),
      db.from("day_notes").select("day, note").gte("day", cfg.TRIP_START).lte("day", cfg.TRIP_END),
    ]);
    const error = claims.error || notes.error;
    if (error) {
      toast(`Couldn't load schedule: ${error.message}`);
      return;
    }
    state.claims = new Map(claims.data.map((r) => [claimKey(r.day, r.slot), r.person]));
    state.notes = new Map(notes.data.map((r) => [r.day, r.note]));
    renderAll();
  }

  function subscribe() {
    if (!db) return;
    db.channel("schedule")
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, (p) => {
        if (p.eventType === "DELETE") state.claims.delete(claimKey(p.old.day, p.old.slot));
        else state.claims.set(claimKey(p.new.day, p.new.slot), p.new.person);
        renderAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "day_notes" }, (p) => {
        if (p.eventType === "DELETE") state.notes.delete(p.old.day);
        else state.notes.set(p.new.day, p.new.note);
        renderAll();
      })
      .subscribe();
  }

  // Phones drop websockets while asleep; resync when the page comes back.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadAll();
  });

  // ---------- Boot ----------

  const today = localToday();
  state.month = monthKey(inTrip(today) ? today : cfg.TRIP_START);
  $("prev-month").addEventListener("click", () => { state.month = addMonths(state.month, -1); renderCalendar(); });
  $("next-month").addEventListener("click", () => { state.month = addMonths(state.month, 1); renderCalendar(); });

  state.name = loadName();
  renderAll();
  loadAll().then(() => { if (!state.name) openNameScreen(); });
  subscribe();
})();
