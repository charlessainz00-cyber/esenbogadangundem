const API_URL = "/.netlify/functions/news";
const ADMIN_KEY_STORAGE = "kargiligundem-admin-key";

const adminForm = document.getElementById("admin-form");
const adminKeyInput = document.getElementById("admin-key");
const adminSubmitButton = document.getElementById("admin-submit-btn");
const logoutButton = document.getElementById("logout-btn");
const adminStatus = document.getElementById("admin-status");
const form = document.getElementById("news-form");
const titleInput = document.getElementById("news-title");
const linkInput = document.getElementById("news-link");
const editingIdInput = document.getElementById("editing-id");
const submitButton = document.getElementById("submit-btn");
const cancelEditButton = document.getElementById("cancel-edit-btn");
const newsList = document.getElementById("news-list");
const emptyStateTemplate = document.getElementById("empty-state-template");

let items = [];
let adminKey = localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";

applyAdminState();
loadItems();

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adminKey = adminKeyInput.value.trim();

  if (!adminKey) {
    adminStatus.textContent = "Yonetici anahtari gerekli.";
    return;
  }

  localStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
  applyAdminState();
  adminStatus.textContent = "Yonetici modu acildi.";
});

logoutButton.addEventListener("click", () => {
  adminKey = "";
  localStorage.removeItem(ADMIN_KEY_STORAGE);
  applyAdminState();
  resetForm();
  adminStatus.textContent = "Yonetici cikisi yapildi.";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveItem();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
});

async function loadItems() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Haberler yuklenemedi.");
    }

    items = Array.isArray(data.items) ? data.items : [];
    renderItems();
  } catch (error) {
    newsList.innerHTML = '<div class="empty-state"><p>Haberler yuklenemedi. Netlify Functions kurulumu gerekli olabilir.</p></div>';
  }
}

function resetForm() {
  form.reset();
  editingIdInput.value = "";
  submitButton.textContent = "Haberi Ekle";
  cancelEditButton.classList.add("hidden");
}

function renderItems() {
  newsList.innerHTML = "";

  if (!items.length) {
    newsList.appendChild(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  items.forEach((item) => {
    newsList.appendChild(createCard(item));
  });

  renderTwitterEmbeds();
}

function createCard(item) {
  const article = document.createElement("article");
  article.className = "news-card";

  const header = document.createElement("div");
  header.className = "news-card-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "news-card-title-wrap";

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
    previewShell.innerHTML = '<div class="preview-loading">X gonderisi yukleniyor...</div>';
  } else {
    const fallback = document.createElement("p");
    fallback.className = "preview-fallback";
    fallback.textContent = "Bu baglanti X onizlemesi olarak gosterilemiyor.";
    previewShell.appendChild(fallback);
  }

  article.append(header, previewShell);
  return article;
}

function startEdit(itemId) {
  if (!adminKey) {
    return;
  }

  const item = items.find((entry) => entry.id === itemId);

  if (!item) {
    return;
  }

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
      body: JSON.stringify({ id: itemId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Silme islemi basarisiz.");
    }

    items = Array.isArray(data.items) ? data.items : [];

    if (editingIdInput.value === itemId) {
      resetForm();
    }

    renderItems();
    adminStatus.textContent = "Haber silindi.";
  } catch (error) {
    adminStatus.textContent = error.message;
  }
}

function renderTwitterEmbeds() {
  if (!window.twttr?.widgets?.createTweet) {
    return;
  }

  const previewShells = newsList.querySelectorAll(".preview-shell[data-tweet-id]");

  previewShells.forEach((shell) => {
    if (shell.dataset.embedded === "true") {
      return;
    }

    shell.dataset.embedded = "true";
    shell.innerHTML = "";

    window.twttr.widgets
      .createTweet(shell.dataset.tweetId, shell, {
        theme: "dark",
        dnt: true,
      })
      .catch(() => {
        shell.dataset.embedded = "false";
        shell.innerHTML = '<p class="preview-fallback">Onizleme yuklenemedi. Linke tiklayarak gonderiyi acabilirsin.</p>';
      });
  });
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

async function saveItem() {
  const title = titleInput.value.trim();
  const link = normalizeUrl(linkInput.value.trim());

  if (!title || !link || !isValidXUrl(link)) {
    adminStatus.textContent = "Lutfen gecerli bir baslik ve X linki gir.";
    return;
  }

  const editingId = editingIdInput.value;
  const method = editingId ? "PUT" : "POST";
  const payload = editingId ? { id: editingId, title, link } : { title, link };

  try {
    const response = await fetch(API_URL, {
      method,
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Kaydetme islemi basarisiz.");
    }

    items = Array.isArray(data.items) ? data.items : [];
    resetForm();
    renderItems();
    adminStatus.textContent = editingId ? "Haber guncellendi." : "Haber eklendi.";
  } catch (error) {
    adminStatus.textContent = error.message;
  }
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
  form.classList.toggle("hidden", !isAdmin);
  logoutButton.classList.toggle("hidden", !isAdmin);
  adminSubmitButton.textContent = isAdmin ? "Anahtari Guncelle" : "Giris Yap";

  if (!isAdmin) {
    adminStatus.textContent = "Ziyaretciler haberleri gorur. Duzenleme sadece yonetici icindir.";
  }

  renderItems();
}

window.addEventListener("load", () => {
  if (window.twttr?.ready) {
    window.twttr.ready(() => {
      renderTwitterEmbeds();
    });
  }
});
