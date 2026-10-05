import { getStore } from "@netlify/blobs";

const STORE_NAME = "kargiligundem";
const ITEM_STORE_KEY = "news-items";
const CATEGORY_STORE_KEY = "news-categories";

export default async (request) => {
  const store = getStore(STORE_NAME);

  if (request.method === "GET") {
    return jsonResponse(await readState(store));
  }

  if (!isAuthorized(request)) {
    return jsonResponse({ message: "Yetkisiz istek." }, 401);
  }

  const payload = await safeJson(request);

  if (request.method === "POST" && payload?.resource === "check") {
    return jsonResponse({ ok: true });
  }

  if (request.method === "POST") {
    if (payload?.resource === "category") {
      return handleCreateCategory(store, payload);
    }
    if (payload?.resource === "followup") {
      return handleCreateFollowup(store, payload);
    }

    return handleCreateItem(store, payload);
  }

  if (request.method === "PUT") {
    if (payload?.resource === "category") {
      return handleUpdateCategory(store, payload);
    }
    if (payload?.resource === "followup") {
      return handleUpdateFollowup(store, payload);
    }

    return handleUpdateItem(store, payload);
  }

  if (request.method === "DELETE") {
    if (payload?.resource === "category") {
      return handleDeleteCategory(store, payload);
    }
    if (payload?.resource === "followup") {
      return handleDeleteFollowup(store, payload);
    }

    return handleDeleteItem(store, payload);
  }

  return jsonResponse({ message: "Method desteklenmiyor." }, 405);
};

async function handleCreateCategory(store, payload) {
  const name = payload?.name?.trim();

  if (!name) {
    return jsonResponse({ message: "Kategori adi gerekli." }, 400);
  }

  const state = await readState(store);
  state.categories.unshift({
    id: crypto.randomUUID(),
    name,
  });

  await writeState(store, state);
  return jsonResponse(state, 201);
}

async function handleUpdateCategory(store, payload) {
  const categoryId = payload?.id?.trim();
  const name = payload?.name?.trim();

  if (!categoryId || !name) {
    return jsonResponse({ message: "Kategori guncelleme icin gecerli veri gerekli." }, 400);
  }

  const state = await readState(store);
  const category = state.categories.find((entry) => entry.id === categoryId);

  if (!category) {
    return jsonResponse({ message: "Kategori bulunamadi." }, 404);
  }

  category.name = name;

  await writeState(store, state);
  return jsonResponse(state);
}

async function handleDeleteCategory(store, payload) {
  const categoryId = payload?.id?.trim();

  if (!categoryId) {
    return jsonResponse({ message: "Silinecek kategori eksik." }, 400);
  }

  const state = await readState(store);
  const exists = state.categories.some((entry) => entry.id === categoryId);

  if (!exists) {
    return jsonResponse({ message: "Kategori bulunamadi." }, 404);
  }

  state.categories = state.categories.filter((entry) => entry.id !== categoryId);
  state.items = state.items.map((item) =>
    item.categoryId === categoryId ? { ...item, categoryId: "" } : item
  );

  await writeState(store, state);
  return jsonResponse(state);
}

async function handleCreateItem(store, payload) {
  const categoryId = payload?.categoryId?.trim();
  const link = normalizeUrl(payload?.link?.trim() ?? "");

  if (!categoryId || !isValidNewsUrl(link)) {
    return jsonResponse({ message: "Gecerli kategori ve haber baglantisi gerekli." }, 400);
  }

  const state = await readState(store);

  if (!state.categories.some((category) => category.id === categoryId)) {
    return jsonResponse({ message: "Kategori bulunamadi." }, 404);
  }

  state.items.unshift({
    id: crypto.randomUUID(),
    categoryId,
    title: payload?.title?.trim() ?? "",
    link,
    followups: [],
    createdAt: new Date().toISOString(),
  });

  await writeState(store, state);
  return jsonResponse(state, 201);
}

async function handleUpdateItem(store, payload) {
  const itemId = payload?.id?.trim();
  const categoryId = payload?.categoryId?.trim();
  const link = normalizeUrl(payload?.link?.trim() ?? "");

  if (!itemId || !categoryId || !isValidNewsUrl(link)) {
    return jsonResponse({ message: "Guncelleme icin gecerli veri gerekli." }, 400);
  }

  const state = await readState(store);
  const itemIndex = state.items.findIndex((item) => item.id === itemId);

  if (itemIndex === -1) {
    return jsonResponse({ message: "Kayit bulunamadi." }, 404);
  }

  if (!state.categories.some((category) => category.id === categoryId)) {
    return jsonResponse({ message: "Kategori bulunamadi." }, 404);
  }

  state.items[itemIndex] = {
    ...state.items[itemIndex],
    categoryId,
    title: payload?.title?.trim() ?? "",
    link,
    followups: Array.isArray(state.items[itemIndex].followups) ? state.items[itemIndex].followups : [],
    updatedAt: new Date().toISOString(),
  };

  await writeState(store, state);
  return jsonResponse(state);
}

async function handleCreateFollowup(store, payload) {
  const itemId = payload?.itemId?.trim();
  const link = normalizeUrl(payload?.link?.trim() ?? "");
  if (!itemId || !isValidNewsUrl(link)) {
    return jsonResponse({ message: "Gecerli haber baglantisi gerekli." }, 400);
  }
  const state = await readState(store);
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return jsonResponse({ message: "Ana haber bulunamadi." }, 404);
  item.followups = Array.isArray(item.followups) ? item.followups : [];
  item.followups.unshift({ id: crypto.randomUUID(), title: payload?.title?.trim() ?? "", link, createdAt: new Date().toISOString() });
  await writeState(store, state);
  return jsonResponse(state, 201);
}

async function handleUpdateFollowup(store, payload) {
  const itemId = payload?.itemId?.trim();
  const followupId = payload?.followupId?.trim();
  const link = normalizeUrl(payload?.link?.trim() ?? "");
  if (!itemId || !followupId || !isValidNewsUrl(link)) {
    return jsonResponse({ message: "Guncelleme icin gecerli haber bilgileri gerekli." }, 400);
  }
  const state = await readState(store);
  const item = state.items.find((entry) => entry.id === itemId);
  const followup = item?.followups?.find((entry) => entry.id === followupId);
  if (!followup) return jsonResponse({ message: "Devam haberi bulunamadi." }, 404);
  Object.assign(followup, { title: payload?.title?.trim() ?? "", link, updatedAt: new Date().toISOString() });
  await writeState(store, state);
  return jsonResponse(state);
}

async function handleDeleteFollowup(store, payload) {
  const itemId = payload?.itemId?.trim();
  const followupId = payload?.followupId?.trim();
  if (!itemId || !followupId) return jsonResponse({ message: "Silinecek haber bilgisi eksik." }, 400);
  const state = await readState(store);
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || !Array.isArray(item.followups)) return jsonResponse({ message: "Devam haberi bulunamadi." }, 404);
  const before = item.followups.length;
  item.followups = item.followups.filter((entry) => entry.id !== followupId);
  if (before === item.followups.length) return jsonResponse({ message: "Devam haberi bulunamadi." }, 404);
  await writeState(store, state);
  return jsonResponse(state);
}

async function handleDeleteItem(store, payload) {
  const itemId = payload?.id?.trim();

  if (!itemId) {
    return jsonResponse({ message: "Silinecek kayit bilgisi eksik." }, 400);
  }

  const state = await readState(store);
  const filteredItems = state.items.filter((item) => item.id !== itemId);

  if (filteredItems.length === state.items.length) {
    return jsonResponse({ message: "Kayit bulunamadi." }, 404);
  }

  state.items = filteredItems;

  await writeState(store, state);
  return jsonResponse(state);
}

async function readState(store) {
  const items = await store.get(ITEM_STORE_KEY, { type: "json" });
  const categories = await store.get(CATEGORY_STORE_KEY, { type: "json" });

  const savedCategories = Array.isArray(categories) ? categories : [];
  return {
    items: Array.isArray(items) ? items : [],
    categories: savedCategories.length ? savedCategories : [
      { id: "hariciye", name: "Hariciye" },
      { id: "dahiliye", name: "Dahiliye" },
    ],
  };
}

async function writeState(store, state) {
  await store.setJSON(ITEM_STORE_KEY, state.items);
  await store.setJSON(CATEGORY_STORE_KEY, state.categories);
}

function isAuthorized(request) {
  const adminKey = Netlify.env.get("NEWS_ADMIN_KEY");

  if (!adminKey) {
    return false;
  }

  return request.headers.get("x-admin-key") === adminKey;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
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

function isValidNewsUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}
