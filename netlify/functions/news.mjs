import { getStore } from "@netlify/blobs";

const STORE_NAME = "kargiligundem";
const STORE_KEY = "news-items";

export default async (request) => {
  const store = getStore(STORE_NAME);

  if (request.method === "GET") {
    const items = await readItems(store);
    return jsonResponse({ items });
  }

  if (!isAuthorized(request)) {
    return jsonResponse({ message: "Yetkisiz istek." }, 401);
  }

  if (request.method === "POST") {
    const payload = await safeJson(request);
    const title = payload?.title?.trim();
    const link = normalizeUrl(payload?.link?.trim() ?? "");

    if (!title || !isValidXUrl(link)) {
      return jsonResponse({ message: "Gecerli bir baslik ve X linki gerekli." }, 400);
    }

    const items = await readItems(store);
    items.unshift({
      id: crypto.randomUUID(),
      title,
      link,
      createdAt: new Date().toISOString(),
    });

    await store.setJSON(STORE_KEY, items);
    return jsonResponse({ items }, 201);
  }

  if (request.method === "PUT") {
    const payload = await safeJson(request);
    const itemId = payload?.id?.trim();
    const title = payload?.title?.trim();
    const link = normalizeUrl(payload?.link?.trim() ?? "");

    if (!itemId || !title || !isValidXUrl(link)) {
      return jsonResponse({ message: "Guncelleme icin gecerli veri gerekli." }, 400);
    }

    const items = await readItems(store);
    const index = items.findIndex((item) => item.id === itemId);

    if (index === -1) {
      return jsonResponse({ message: "Kayit bulunamadi." }, 404);
    }

    items[index] = {
      ...items[index],
      title,
      link,
      updatedAt: new Date().toISOString(),
    };

    await store.setJSON(STORE_KEY, items);
    return jsonResponse({ items });
  }

  if (request.method === "DELETE") {
    const payload = await safeJson(request);
    const itemId = payload?.id?.trim();

    if (!itemId) {
      return jsonResponse({ message: "Silinecek kayit bilgisi eksik." }, 400);
    }

    const items = await readItems(store);
    const filteredItems = items.filter((item) => item.id !== itemId);

    if (filteredItems.length === items.length) {
      return jsonResponse({ message: "Kayit bulunamadi." }, 404);
    }

    await store.setJSON(STORE_KEY, filteredItems);
    return jsonResponse({ items: filteredItems });
  }

  return jsonResponse({ message: "Method desteklenmiyor." }, 405);
};

async function readItems(store) {
  const items = await store.get(STORE_KEY, { type: "json" });
  return Array.isArray(items) ? items : [];
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

function isValidXUrl(value) {
  try {
    const url = new URL(value);
    const allowedHosts = ["x.com", "www.x.com", "twitter.com", "www.twitter.com"];
    return allowedHosts.includes(url.hostname) && /\/status\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}
