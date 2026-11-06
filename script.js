(function () {
  "use strict";

  const STORAGE_KEY = "attendanceRecords";
  const STATUSES = ["Present", "Absent", "Late"];

  // ---------- Element references ----------
  const el = (id) => document.getElementById(id);

  const todayLabel = el("todayLabel");
  const statTotal = el("statTotal");
  const statPresent = el("statPresent");
  const statAbsent = el("statAbsent");
  const statLate = el("statLate");

  const addForm = el("addForm");
  const addName = el("addName");
  const addDate = el("addDate");
  const addStatus = el("addStatus");
  const addMessage = el("addMessage");

  const searchInput = el("searchInput");
  const filterDate = el("filterDate");
  const filterStatus = el("filterStatus");
  const clearFiltersBtn = el("clearFilters");
  const resultCount = el("resultCount");

  const recordsTable = el("recordsTable");
  const recordsBody = el("recordsBody");
  const emptyState = el("emptyState");
  const emptyTitle = el("emptyTitle");
  const emptyText = el("emptyText");

  const editDialog = el("editDialog");
  const editForm = el("editForm");
  const editName = el("editName");
  const editDate = el("editDate");
  const editStatus = el("editStatus");
  const editMessage = el("editMessage");
  const editCancel = el("editCancel");

  const deleteDialog = el("deleteDialog");
  const deleteText = el("deleteText");
  const deleteCancel = el("deleteCancel");
  const deleteConfirm = el("deleteConfirm");

  // ---------- State ----------
  let records = loadRecords();
  let editingId = null;
  let deletingId = null;
  let messageTimer = null;

  // ---------- Storage ----------
  function loadRecords() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(data)) return [];
      // Keep only well-formed records
      return data.filter(
        (r) =>
          r &&
          typeof r.id === "string" &&
          typeof r.name === "string" &&
          typeof r.date === "string" &&
          STATUSES.includes(r.status)
      );
    } catch (err) {
      return [];
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      alert("Could not save your data. Your browser storage may be full or disabled.");
    }
  }

  // ---------- Helpers ----------
  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  // "2026-11-06" -> "Nov 6, 2026" (parsed as a local date, not UTC)
  function formatDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function cleanName(name) {
    return name.trim().replace(/\s+/g, " ");
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isDuplicate(name, date, ignoreId) {
    const key = name.toLowerCase();
    return records.some(
      (r) => r.id !== ignoreId && r.date === date && r.name.toLowerCase() === key
    );
  }

  // Returns an error message, or "" if the input is valid
  function validate(name, date, status, ignoreId) {
    if (!name) return "Please enter a full name.";
    if (!date) return "Please choose a date.";
    if (!STATUSES.includes(status)) return "Please choose a valid status.";
    if (isDuplicate(name, date, ignoreId)) {
      return `${name} already has a record for ${formatDate(date)}.`;
    }
    return "";
  }

  function showMessage(target, text, type) {
    target.textContent = text;
    target.className = "form-message" + (type ? " " + type : "");
  }

  // ---------- Rendering ----------
  function renderStats() {
    const counts = { Present: 0, Absent: 0, Late: 0 };
    records.forEach((r) => counts[r.status]++);
    statTotal.textContent = records.length;
    statPresent.textContent = counts.Present;
    statAbsent.textContent = counts.Absent;
    statLate.textContent = counts.Late;
  }

  function getFilteredRecords() {
    const query = searchInput.value.trim().toLowerCase();
    const date = filterDate.value;
    const status = filterStatus.value;

    return records
      .filter((r) => {
        if (date && r.date !== date) return false;
        if (status && r.status !== status) return false;
        if (query) {
          const haystack = [r.name, r.date, formatDate(r.date)].join(" ").toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Newest date first, then alphabetically by name
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }

  function makeCell(label, className) {
    const td = document.createElement("td");
    td.dataset.label = label;
    if (className) td.className = className;
    return td;
  }

  function makeButton(text, className, action, id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm " + className;
    btn.textContent = text;
    btn.dataset.action = action;
    btn.dataset.id = id;
    return btn;
  }

  function renderTable() {
    const list = getFilteredRecords();
    const hasFilters = Boolean(searchInput.value.trim() || filterDate.value || filterStatus.value);

    recordsBody.replaceChildren();

    list.forEach((r) => {
      const tr = document.createElement("tr");

      const nameTd = makeCell("Name", "cell-name");
      nameTd.textContent = r.name;

      const dateTd = makeCell("Date");
      dateTd.textContent = formatDate(r.date);

      const statusTd = makeCell("Status");
      const badge = document.createElement("span");
      badge.className = "badge badge-" + r.status.toLowerCase();
      badge.textContent = r.status;
      statusTd.appendChild(badge);

      const actionsTd = makeCell("Actions", "cell-actions");
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.append(
        makeButton("Edit", "btn-edit", "edit", r.id),
        makeButton("Delete", "btn-delete", "delete", r.id)
      );
      actionsTd.appendChild(actions);

      tr.append(nameTd, dateTd, statusTd, actionsTd);
      recordsBody.appendChild(tr);
    });

    // Empty states
    if (records.length === 0) {
      emptyTitle.textContent = "No attendance records yet";
      emptyText.textContent = "Add your first record using the form above to get started.";
    } else if (list.length === 0) {
      emptyTitle.textContent = "No records match your search";
      emptyText.textContent = "Try a different name or date, or clear the filters.";
    }
    const isEmpty = list.length === 0;
    emptyState.hidden = !isEmpty;
    recordsTable.hidden = isEmpty;

    // Result counter
    if (records.length === 0) {
      resultCount.textContent = "";
    } else if (hasFilters) {
      resultCount.textContent = `Showing ${list.length} of ${records.length}`;
    } else {
      resultCount.textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
    }
  }

  function render() {
    renderStats();
    renderTable();
  }

  // ---------- Add ----------
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = cleanName(addName.value);
    const date = addDate.value;
    const status = addStatus.value;

    const error = validate(name, date, status, null);
    addName.classList.toggle("invalid", !name);
    addDate.classList.toggle("invalid", !date);
    if (error) {
      showMessage(addMessage, error, "error");
      return;
    }

    records.push({ id: makeId(), name, date, status, createdAt: Date.now() });
    saveRecords();
    render();

    // Keep date and status so several people can be logged for the same day quickly
    addName.value = "";
    addName.focus();
    showMessage(addMessage, `Added ${name} (${status}) for ${formatDate(date)}.`, "success");
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => showMessage(addMessage, ""), 3000);
  });

  [addName, addDate].forEach((input) =>
    input.addEventListener("input", () => {
      input.classList.remove("invalid");
      if (addMessage.classList.contains("error")) showMessage(addMessage, "");
    })
  );

  // ---------- Edit & Delete (event delegation) ----------
  recordsBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const record = records.find((r) => r.id === btn.dataset.id);
    if (!record) return;

    if (btn.dataset.action === "edit") openEdit(record);
    if (btn.dataset.action === "delete") openDelete(record);
  });

  function openEdit(record) {
    editingId = record.id;
    editName.value = record.name;
    editDate.value = record.date;
    editStatus.value = record.status;
    editName.classList.remove("invalid");
    editDate.classList.remove("invalid");
    showMessage(editMessage, "");
    editDialog.showModal();
    editName.focus();
  }

  editForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = cleanName(editName.value);
    const date = editDate.value;
    const status = editStatus.value;

    const error = validate(name, date, status, editingId);
    editName.classList.toggle("invalid", !name);
    editDate.classList.toggle("invalid", !date);
    if (error) {
      showMessage(editMessage, error, "error");
      return;
    }

    const record = records.find((r) => r.id === editingId);
    if (record) {
      record.name = name;
      record.date = date;
      record.status = status;
      saveRecords();
      render();
    }
    editDialog.close();
  });

  editCancel.addEventListener("click", () => editDialog.close());
  editDialog.addEventListener("close", () => (editingId = null));

  function openDelete(record) {
    deletingId = record.id;
    deleteText.textContent = `Are you sure you want to delete the record for ${record.name} on ${formatDate(
      record.date
    )}? This cannot be undone.`;
    deleteDialog.showModal();
    deleteCancel.focus();
  }

  deleteConfirm.addEventListener("click", () => {
    records = records.filter((r) => r.id !== deletingId);
    saveRecords();
    render();
    deleteDialog.close();
  });

  deleteCancel.addEventListener("click", () => deleteDialog.close());
  deleteDialog.addEventListener("close", () => (deletingId = null));

  // Close dialogs when clicking the dark backdrop
  [editDialog, deleteDialog].forEach((dialog) =>
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    })
  );

  // ---------- Search & filters ----------
  searchInput.addEventListener("input", renderTable);
  filterDate.addEventListener("change", renderTable);
  filterDate.addEventListener("input", renderTable);
  filterStatus.addEventListener("change", renderTable);

  clearFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    filterDate.value = "";
    filterStatus.value = "";
    renderTable();
  });

  // Keep in sync if the app is open in another tab
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      records = loadRecords();
      render();
    }
  });

  // ---------- Init ----------
  addDate.value = todayISO();
  todayLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  render();
})();
