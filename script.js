const API_URL = "/.netlify/functions/news";
const ADMIN_KEY_STORAGE = "kargiligundem-admin-key";

const adminForm = document.getElementById("admin-form");
const adminKeyInput = document.getElementById("admin-key");
const adminSubmitButton = document.getElementById("admin-submit-btn");
const logoutButton = document.getElementById("logout-btn");
const adminStatus = document.getElementById("admin-status");
const addCategoryButton = document.getElementById("add-category-btn");
const categoryAdminList = document.getElementById("category-admin-list");
const categoryManager = document.getElementById("category-manager");
const categoryFilters = document.getElementById("category-filters");
const form = document.getElementById("news-form");
const categorySelect = document.getElementById("news-category");
const titleInput = document.getElementById("news-title");
const linkInput = document.getElementById("news-link");
const editingIdInput = document.getElementById("editing-id");
const submitButton = document.getElementById("submit-btn");
const cancelEditButton = document.getElementById("cancel-edit-btn");
const newsList = document.getElementById("news-list");
const emptyStateTemplate = document.getElementById("empty-state-template");

let items = [];
let categories = [];
let activeCategoryId = "all";
let adminKey = localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
let previewObserver = null;

applyAdminState();
loadData();

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adminKey = adminKeyInput.value.trim();

  if (!adminKey) {
    setStatus("Yonetici anahtari gerekli.");
    return;
  }

  localStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
  applyAdminState();
  setStatus("");
});

logoutButton.addEventListener("click", () => {
  adminKey = "";
  localStorage.removeItem(ADMIN_KEY_STORAGE);
  applyAdminState();
  resetForm();
  setStatus("");
});

addCategoryButton.addEventListener("click", async () => {
  if (!adminKey) {
    return;
  }

  const name = window.prompt("Yeni kategori adi");

  if (!name?.trim()) {
    return;
  }

  await saveCategory(name.trim());
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveItem();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
});

async function loadData() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Veriler yuklenemedi.");
    }

    items = Array.isArray(data.items) ? data.items : [];
    categories = Array.isArray(data.categories) ? data.categories : [];
    ensureActiveCategory();
    renderAll();
  } catch (error) {
    newsList.innerHTML = '<div class="empty-state"><p>Veriler yuklenemedi.</p></div>';
  }
}

function renderAll() {
  renderCategoryFilters();
  renderCategoryAdminList();
  renderCategoryOptions();
  renderItems();
}

function renderCategoryFilters() {
  categoryFilters.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `chip-btn${activeCategoryId === "all" ? " active" : ""}`;
  allButton.textContent = "Hepsi";
  allButton.addEventListener("click", () => {
    activeCategoryId = "all";
    renderAll();
  });
  categoryFilters.appendChild(allButton);

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip-btn${activeCategoryId === category.id ? " active" : ""}`;
    button.textContent = category.name;
    button.addEventListener("click", () => {
      activeCategoryId = category.id;
      renderAll();
    });
    categoryFilters.appendChild(button);
  });
}

function renderCategoryAdminList() {
  categoryAdminList.innerHTML = "";

  if (!adminKey || !categories.length) {
    return;
  }

  categories.forEach((category) => {
    const row = document.createElement("div");
    row.className = "category-admin-item";

    const name = document.createElement("div");
    name.className = "category-admin-name";
    name.textContent = category.name;

    const actions = document.createElement("div");
    actions.className = "tiny-actions";

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "tiny-btn";
    renameButton.textContent = "Duzenle";
    renameButton.addEventListener("click", async () => {
      const nextName = window.prompt("Kategori adini degistir", category.name);

      if (!nextName?.trim()) {
        return;
      }

      await renameCategory(category.id, nextName.trim());
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "tiny-btn danger-btn";
    deleteButton.textContent = "Sil";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(`${category.name} kategorisini silmek istiyor musun?`);

      if (!confirmed) {
        return;
      }

      await deleteCategory(category.id);
    });

    actions.append(renameButton, deleteButton);
    row.append(name, actions);
    categoryAdminList.appendChild(row);
  });
}

function renderCategoryOptions() {
  categorySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = categories.length ? "Kategori sec" : "Once kategori ekle";
  categorySelect.appendChild(placeholder);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });
}

function renderItems() {
  newsList.innerHTML = "";

  const filteredItems = getFilteredItems();

  if (!filteredItems.length) {
    newsList.appendChild(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  filteredItems.forEach((item) => {
    newsList.appendChild(createCard(item));
  });

  observeVisiblePreviews();
}

function getFilteredItems() {
  if (activeCategoryId === "all") {
    return items;
  }

  return items.filter((item) => item.categoryId === activeCategoryId);
}

function createCard(item) {
  const article = document.createElement("article");
  article.className = "news-card";

  const header = document.createElement("div");
  header.className = "news-card-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "news-card-title-wrap";

  const category = categories.find((entry) => entry.id === item.categoryId);

  if (category) {
    const badge = document.createElement("div");
    badge.className = "category-badge";
    badge.textContent = category.name;
    titleWrap.appendChild(badge);
  }

  const title = document.createElement("h3");
  title.textContent = item.title;

  const link = document.createElement("a");
  link.className = "news-link";
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.link;

  titleWrap.append(title, link);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (!adminKey) {
    actions.classList.add("hidden");
  }

  const editButton = document.createElement("button");
  editButton.className = "card-btn edit-btn";
  editButton.type = "button";
  editButton.textContent = "Duzenle";
  editButton.addEventListener("click", () => startEdit(item.id));

  const deleteButton = document.createElement("button");
  deleteButton.className = "card-btn delete-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "Sil";
  deleteButton.addEventListener("click", () => deleteItem(item.id));

  actions.append(editButton, deleteButton);
  header.append(titleWrap, actions);

  const previewShell = document.createElement("div");
  previewShell.className = "preview-shell";

  const tweetId = extractTweetId(item.link);

  if (tweetId) {
    previewShell.dataset.tweetId = tweetId;
    previewShell.innerHTML = '<div class="preview-placeholder">Onizleme gorunurken yavaslamamasi icin ihtiyac oldugunda yuklenecek.</div>';
  } else {
    previewShell.innerHTML = '<p class="preview-fallback">Bu baglanti X onizlemesi olarak gosterilemiyor.</p>';
  }

  article.append(header, previewShell);
  return article;
}

function observeVisiblePreviews() {
  if (previewObserver) {
    previewObserver.disconnect();
  }

  if (!("IntersectionObserver" in window)) {
    loadAllVisiblePreviews();
    return;
  }

  previewObserver = new IntersectionObserver(handlePreviewIntersection, {
    rootMargin: "260px 0px",
  });

  newsList.querySelectorAll(".preview-shell[data-tweet-id]").forEach((shell) => {
    previewObserver.observe(shell);
  });
}

function handlePreviewIntersection(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) {
      return;
    }

    const shell = entry.target;
    previewObserver.unobserve(shell);
    loadPreview(shell);
  });
}

function loadAllVisiblePreviews() {
  newsList.querySelectorAll(".preview-shell[data-tweet-id]").forEach((shell) => {
    loadPreview(shell);
  });
}

function loadPreview(shell) {
  if (!window.twttr?.widgets?.createTweet) {
    shell.innerHTML = '<div class="preview-loading">Onizleme hazirlaniyor...</div>';
    return;
  }

  if (shell.dataset.embedded === "true") {
    return;
  }

  shell.dataset.embedded = "true";
  shell.innerHTML = '<div class="preview-loading">X gonderisi yukleniyor...</div>';

  window.twttr.widgets
    .createTweet(shell.dataset.tweetId, shell, {
      theme: "dark",
      dnt: true,
    })
    .catch(() => {
      shell.dataset.embedded = "false";
      shell.innerHTML = '<p class="preview-fallback">Onizleme yuklenemedi. Linke tiklayarak gonderiyi acabilirsin.</p>';
    });
}

function startEdit(itemId) {
  if (!adminKey) {
    return;
  }

  const item = items.find((entry) => entry.id === itemId);

  if (!item) {
    return;
  }

  categorySelect.value = item.categoryId ?? "";
  titleInput.value = item.title;
  linkInput.value = item.link;
  editingIdInput.value = item.id;
  submitButton.textContent = "Degisikligi Kaydet";
  cancelEditButton.classList.remove("hidden");
  titleInput.focus();
}

async function deleteItem(itemId) {
  if (!adminKey) {
    return;
  }

  const confirmed = window.confirm("Bu haberi silmek istiyor musun?");

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "DELETE",
      headers: buildHeaders(),
      body: JSON.stringify({ resource: "item", id: itemId }),
    });

    await syncStateFromResponse(response, "Haber silindi.");

    if (editingIdInput.value === itemId) {
      resetForm();
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function saveItem() {
  const categoryId = categorySelect.value;
  const title = titleInput.value.trim();
  const link = normalizeUrl(linkInput.value.trim());

  if (!categories.length) {
    setStatus("Once kategori ekle.");
    return;
  }

  if (!categoryId || !title || !link || !isValidXUrl(link)) {
    setStatus("Kategori, baslik ve gecerli bir X linki gerekli.");
    return;
  }

  const editingId = editingIdInput.value;
  const method = editingId ? "PUT" : "POST";
  const payload = editingId
    ? { resource: "item", id: editingId, categoryId, title, link }
    : { resource: "item", categoryId, title, link };

  try {
    const response = await fetch(API_URL, {
      method,
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    await syncStateFromResponse(response, editingId ? "Haber guncellendi." : "Haber eklendi.");
    resetForm();
  } catch (error) {
    setStatus(error.message);
  }
}

async function saveCategory(name) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ resource: "category", name }),
    });

    await syncStateFromResponse(response, "");
  } catch (error) {
    setStatus(error.message);
  }
}

async function renameCategory(id, name) {
  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify({ resource: "category", id, name }),
    });

    await syncStateFromResponse(response, "");
  } catch (error) {
    setStatus(error.message);
  }
}

async function deleteCategory(id) {
  try {
    const response = await fetch(API_URL, {
      method: "DELETE",
      headers: buildHeaders(),
      body: JSON.stringify({ resource: "category", id }),
    });

    await syncStateFromResponse(response, "");

    if (activeCategoryId === id) {
      activeCategoryId = "all";
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function syncStateFromResponse(response, successMessage) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Islem basarisiz.");
  }

  items = Array.isArray(data.items) ? data.items : [];
  categories = Array.isArray(data.categories) ? data.categories : [];
  ensureActiveCategory();
  renderAll();
  setStatus(successMessage);
}

function ensureActiveCategory() {
  if (activeCategoryId === "all") {
    return;
  }

  if (!categories.some((category) => category.id === activeCategoryId)) {
    activeCategoryId = "all";
  }
}

function resetForm() {
  form.reset();
  editingIdInput.value = "";
  submitButton.textContent = "Haberi Ekle";
  cancelEditButton.classList.add("hidden");
}

function buildHeaders() {
  return {
    "content-type": "application/json",
    "x-admin-key": adminKey,
  };
}

function applyAdminState() {
  const isAdmin = Boolean(adminKey);
  adminKeyInput.value = adminKey;
  categoryManager.classList.toggle("hidden", !isAdmin);
  form.classList.toggle("hidden", !isAdmin);
  logoutButton.classList.toggle("hidden", !isAdmin);
  adminSubmitButton.textContent = isAdmin ? "Anahtari Guncelle" : "Giris Yap";
  renderAll();
}

function setStatus(message) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("hidden", !message);
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function isValidXUrl(value) {
  try {
    const url = new URL(value);
    const allowedHosts = ["x.com", "www.x.com", "twitter.com", "www.twitter.com"];
    return allowedHosts.includes(url.hostname) && /\/status\/\d+/.test(url.pathname);
  } catch (error) {
    return false;
  }
}

function extractTweetId(value) {
  if (!isValidXUrl(value)) {
    return "";
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(/status\/(\d+)/);
    return match?.[1] ?? "";
  } catch (error) {
    return "";
  }
}

window.addEventListener("load", () => {
  if (window.twttr?.ready) {
    window.twttr.ready(() => {
      observeVisiblePreviews();
    });
  }
});
