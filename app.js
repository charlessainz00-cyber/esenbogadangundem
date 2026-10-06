const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const DEFAULT_CATEGORIES = [
  { id:'hariciye', name:'Hariciye' },
  { id:'dahiliye', name:'Dahiliye' },
];
let state = { items:[], categories:DEFAULT_CATEGORIES };
let activeCategory = '';
let adminKey = '';

async function request(method = 'GET', payload) {
  const headers = { 'content-type':'application/json' };
  if (method !== 'GET' && adminKey) headers['x-admin-key'] = adminKey;
  const response = await fetch('/.netlify/functions/news', { method, headers, ...(payload ? { body:JSON.stringify(payload) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `İstek tamamlanamadı (${response.status}).`);
  return result;
}

function validUrl(value) {
  try { const url = new URL(value); return ['http:','https:'].includes(url.protocol); } catch { return false; }
}
function isXPost(value) {
  try { const url = new URL(value); return ['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname) && /\/status\/\d+/.test(url.pathname); } catch { return false; }
}
function hostOf(value) { try { return new URL(value).hostname.replace(/^www\./,''); } catch { return 'Kaynak'; } }
function displayTitle(item) { return item.title?.trim() || (isXPost(item.link) ? 'X gönderisi' : `Haber · ${hostOf(item.link)}`); }
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Yeni' : new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
}
function setError(message = '') { const el = $('#errorMessage'); el.textContent = message; el.classList.toggle('hidden', !message); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2300); }
function categories() { return state.categories?.length ? state.categories : DEFAULT_CATEGORIES; }

function renderFilters() {
  const list = categories();
  if (activeCategory && !list.some((category) => category.id === activeCategory)) activeCategory = '';
  $('#filters').innerHTML = `<button class="filter ${!activeCategory?'active':''}" data-filter="">Hepsi</button>${list.map((category) => `<button class="filter ${activeCategory===category.id?'active':''}" data-filter="${esc(category.id)}">${esc(category.name)}</button>`).join('')}`;
  $('#filters').querySelectorAll('[data-filter]').forEach((button) => button.onclick = () => { activeCategory = button.dataset.filter; renderFilters(); renderFeed(); });
  const previousValue = $('#category').value;
  $('#category').innerHTML = list.map((category) => `<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('');
  if (list.some((category) => category.id === previousValue)) $('#category').value = previousValue;
  else if (list.length) $('#category').value = list[0].id;
  if (adminKey) renderCategories();
}

function safeLink(url, label, className = 'story-link') {
  if (!validUrl(url)) return '';
  return `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label || url)} ↗</a>`;
}

function renderFollowups(item, canManage) {
  const list = Array.isArray(item.followups) ? item.followups : [];
  const entries = list.map((entry) => `<div class="follow"><h4>${esc(displayTitle(entry))}</h4>${isXPost(entry.link)?`<div class="post-preview follow-preview"><blockquote class="twitter-tweet" data-theme="dark" data-dnt="true"><a href="${esc(entry.link)}">X gönderisini görüntüle</a></blockquote></div>`:`<div class="follow-preview follow-preview-text">${safeLink(entry.link,hostOf(entry.link),'follow-link')}</div>`}${canManage?`<div class="follow-edit"><button class="mini" data-edit-follow="${esc(item.id)}|${esc(entry.id)}">Düzenle</button><button class="mini danger" data-delete-follow="${esc(item.id)}|${esc(entry.id)}">Sil</button></div>`:''}</div>`).join('');
  return `${list.length?`<div class="followups"><div class="follow-title">HABERİN DEVAMI · ${list.length}</div>${entries}</div>`:''}${canManage?`<div class="follow-admin"><div class="follow-title">BU HABERLE İLGİLİ DEVAM HABERİ EKLE</div><form class="follow-form" data-follow-form="${esc(item.id)}"><input name="title" maxlength="240" placeholder="Başlık (isteğe bağlı)"><input name="link" type="url" placeholder="https://kaynak.com/devam-haberi" required><button>Devam haberi ekle</button></form></div>`:''}`;
}

function renderAdminItems() {
  const items = state.items;
  $('#adminCount').textContent = `${items.length} haber`;
  $('#adminList')?.remove();
  if (!items.length) return;
  const list = document.createElement('div');
  list.id = 'adminList';
  list.innerHTML = items.map((item) => `<div class="admin-story"><div><b>${esc(displayTitle(item))}</b><small>${esc(categories().find((c)=>c.id===item.categoryId)?.name || 'Kategorisiz')} · ${esc(hostOf(item.link))}</small></div><div class="admin-story-actions"><button class="mini" data-edit-item="${esc(item.id)}">Düzenle</button><button class="mini danger" data-delete-item="${esc(item.id)}">Sil</button></div></div>`).join('');
  $('#editor').append(list);
  list.querySelectorAll('[data-edit-item]').forEach((button) => button.onclick = () => editItem(button.dataset.editItem));
  list.querySelectorAll('[data-delete-item]').forEach((button) => button.onclick = () => deleteItem(button.dataset.deleteItem));
}

function renderCategories() {
  const container = $('#categoryList');
  if (!container) return;
  container.innerHTML = categories().map((category) => `<div class="category-row"><span>${esc(category.name)}</span><div><button class="mini" data-rename-category="${esc(category.id)}">Düzenle</button><button class="mini danger" data-delete-category="${esc(category.id)}">Sil</button></div></div>`).join('');
  container.querySelectorAll('[data-rename-category]').forEach((button) => button.onclick = () => renameCategory(button.dataset.renameCategory));
  container.querySelectorAll('[data-delete-category]').forEach((button) => button.onclick = () => deleteCategory(button.dataset.deleteCategory));
}

function renderFeed() {
  const items = state.items.filter((item) => !activeCategory || item.categoryId===activeCategory);
  $('#feedTitle').textContent = 'Son haberler';
  $('#empty').classList.toggle('hidden', items.length > 0);
  $('#feed').innerHTML = items.map((item) => {
    const category = categories().find((entry) => entry.id === item.categoryId)?.name || 'Kategorisiz';
    const canManage = Boolean(adminKey);
    const preview = isXPost(item.link)
      ? `<div class="post-preview"><blockquote class="twitter-tweet" data-theme="dark" data-dnt="true"><a href="${esc(item.link)}">X gönderisini görüntüle</a></blockquote></div>`
      : safeLink(item.link, `${hostOf(item.link)} adresindeki haberi aç`);
    return `<article class="story"><div class="story-meta"><span class="tag">${esc(category)}</span><span>·</span><time>${esc(formatDate(item.createdAt))}</time><span>·</span><span>${esc(hostOf(item.link))}</span></div>${canManage?`<div class="story-actions"><button class="mini" data-edit-item="${esc(item.id)}">Düzenle</button><button class="mini danger" data-delete-item="${esc(item.id)}">Sil</button></div>`:''}<h3 class="story-title">${esc(displayTitle(item))}</h3><div class="story-preview">${preview}</div><div class="source-line">Haber kaynağı: ${esc(hostOf(item.link))}</div>${renderFollowups(item,canManage)}</article>`;
  }).join('');
  $('#feed').querySelectorAll('[data-edit-item]').forEach((button) => button.onclick = () => editItem(button.dataset.editItem));
  $('#feed').querySelectorAll('[data-delete-item]').forEach((button) => button.onclick = () => deleteItem(button.dataset.deleteItem));
  $('#feed').querySelectorAll('[data-follow-form]').forEach((form) => form.onsubmit = (event) => addFollowup(event,form));
  $('#feed').querySelectorAll('[data-delete-follow]').forEach((button) => button.onclick = () => deleteFollowup(button.dataset.deleteFollow));
  $('#feed').querySelectorAll('[data-edit-follow]').forEach((button) => button.onclick = () => editFollowup(button.dataset.editFollow));
  if (window.twttr?.widgets) window.twttr.widgets.load($('#feed'));
  else if (window.twttrReady) window.twttrReady.then(() => window.twttr?.widgets?.load($('#feed')));
}

function render() { renderFilters(); renderFeed(); if (adminKey) renderAdminItems(); }
async function load() {
  try {
    const incoming = await request();
    state = { items:Array.isArray(incoming.items)?incoming.items:[], categories:Array.isArray(incoming.categories)&&incoming.categories.length?incoming.categories:DEFAULT_CATEGORIES };
    $('#connection').textContent = '● Bağlı';
    $('#connection').classList.add('connected');
    render();
  } catch (error) {
    $('#connection').textContent = '● Bağlantı yok';
    $('#feedTitle').textContent = 'Haber akışına ulaşılamadı';
    $('#empty').textContent = 'Bu proje Netlify üzerinde çalışırken haberler yüklenir.';
    $('#empty').classList.remove('hidden');
  }
}

function setAdmin(enabled) {
  $('#adminPanel').classList.remove('hidden');
  $('#loginForm').classList.toggle('hidden',enabled);
  $('#editor').classList.toggle('hidden',!enabled);
  $('#logout').classList.toggle('hidden',!enabled);
  $('#adminToggle').textContent = enabled ? 'Yönetim açık' : 'Yönetici girişi';
  render();
}
function editItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  $('#itemId').value = item.id;
  $('#category').value = item.categoryId;
  $('#title').value = item.title || '';
  $('#link').value = item.link;
  $('#formHeading').textContent = 'Haberi düzenle';
  $('#saveNews').textContent = 'Değişiklikleri kaydet';
  $('#cancelEdit').classList.remove('hidden');
  $('#newsForm').scrollIntoView({behavior:'smooth',block:'center'});
}
function clearForm() {
  $('#newsForm').reset(); $('#itemId').value = '';
  $('#formHeading').textContent = 'Yeni haber ekle'; $('#saveNews').textContent = 'Haberi ekle';
  $('#cancelEdit').classList.add('hidden');
}
async function syncRequest(method,payload,message) {
  try { state = await request(method,payload); setError(); render(); toast(message); return true; }
  catch (error) { setError(error.message); return false; }
}
async function deleteItem(id) {
  if (!confirm('Bu haberi ve devam haberlerini silmek istiyor musunuz?')) return;
  await syncRequest('DELETE',{id},'Haber silindi.');
}
async function addFollowup(event,form) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  if (!validUrl(values.link)) return toast('Geçerli bir http veya https bağlantısı girin.');
  await syncRequest('POST',{resource:'followup',itemId:form.dataset.followForm,...values},'Devam haberi eklendi.');
}
async function deleteFollowup(value) {
  const [itemId,followupId] = value.split('|');
  if (!confirm('Bu devam haberini silmek istiyor musunuz?')) return;
  await syncRequest('DELETE',{resource:'followup',itemId,followupId},'Devam haberi silindi.');
}
async function editFollowup(value) {
  const [itemId,followupId] = value.split('|');
  const item = state.items.find((entry)=>entry.id===itemId), followup = item?.followups?.find((entry)=>entry.id===followupId);
  if (!followup) return;
  const title = prompt('Devam haberinin başlığı (isteğe bağlı)',followup.title || '');
  if (title === null) return;
  const link = prompt('Devam haberinin bağlantısı',followup.link);
  if (link === null) return;
  if (!validUrl(link)) return toast('Geçerli bir http veya https bağlantısı girin.');
  await syncRequest('PUT',{resource:'followup',itemId,followupId,title,link},'Devam haberi güncellendi.');
}

async function renameCategory(id) {
  const category = categories().find((entry) => entry.id === id);
  if (!category) return;
  const name = prompt('Kategori adı', category.name);
  if (name === null) return;
  if (!name.trim()) return toast('Kategori adı boş olamaz.');
  await syncRequest('PUT', {resource:'category', id, name:name.trim()}, 'Kategori güncellendi.');
}
async function deleteCategory(id) {
  const category = categories().find((entry) => entry.id === id);
  if (!category) return;
  if (categories().length <= 1) return toast('En az bir kategori kalmalı.');
  if (!confirm(`“${category.name}” kategorisini silmek istiyor musunuz? Bu kategorideki haberler “Kategorisiz” olarak kalır.`)) return;
  await syncRequest('DELETE', {resource:'category', id}, 'Kategori silindi.');
}

$('#adminToggle').onclick = () => { $('#adminPanel').classList.toggle('hidden'); if (!$('#adminPanel').classList.contains('hidden')) $('#adminKey').focus(); };
$('#loginForm').onsubmit = async (event) => {
  event.preventDefault(); adminKey = $('#adminKey').value.trim();
  try { await request('POST',{resource:'check'}); }
  catch (error) {
    if (error.message.includes('Yetkisiz')) { adminKey=''; return setError('Yönetici anahtarı doğrulanamadı.'); }
    adminKey=''; return setError(error.message);
  }
  setError(); setAdmin(true); $('#adminKey').value='';
};
$('#logout').onclick = () => { adminKey=''; setAdmin(false); };
$('#newsForm').onsubmit = async (event) => {
  event.preventDefault();
  const payload = {categoryId:$('#category').value,title:$('#title').value.trim(),link:$('#link').value.trim()};
  if (!validUrl(payload.link)) return setError('Geçerli bir http veya https haber bağlantısı girin.');
  const id = $('#itemId').value;
  await syncRequest(id?'PUT':'POST',id?{...payload,id}:payload,id?'Haber güncellendi.':'Haber eklendi.');
  clearForm();
};
$('#cancelEdit').onclick = clearForm;
$('#categoryForm').onsubmit = async (event) => {
  event.preventDefault();
  const name = $('#newCategory').value.trim();
  if (!name) return;
  if (await syncRequest('POST', {resource:'category', name}, 'Kategori eklendi.')) $('#newCategory').value = '';
};
window.twttrReady = new Promise((resolve) => {
  let attempts = 0;
  const loaded = () => {
    if (window.twttr?.widgets) return resolve(window.twttr);
    if (++attempts < 40) setTimeout(loaded, 250);
  };
  loaded();
});
load();
