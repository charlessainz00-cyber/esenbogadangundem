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
function hostOf(value) { try { return new URL(value).hostname.replace(/^www\./,''); } catch { return 'Kaynak'; } }
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
  $('#category').innerHTML = list.map((category) => `<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('');
}

function safeLink(url, label, className = 'story-link') {
  if (!validUrl(url)) return '';
  return `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label || url)} ↗</a>`;
}

function renderFollowups(item, canManage) {
  const list = Array.isArray(item.followups) ? item.followups : [];
  const entries = list.map((entry) => `<div class="follow"><h4>${esc(entry.title)}</h4>${safeLink(entry.link,hostOf(entry.link),'follow-link')}${canManage?`<div class="follow-edit"><button class="mini" data-edit-follow="${esc(item.id)}|${esc(entry.id)}">Düzenle</button><button class="mini danger" data-delete-follow="${esc(item.id)}|${esc(entry.id)}">Sil</button></div>`:''}</div>`).join('');
  return `${list.length?`<div class="followups"><div class="follow-title">HABERİN DEVAMI · ${list.length}</div>${entries}</div>`:''}${canManage?`<div class="follow-admin"><div class="follow-title">BU HABERLE İLGİLİ DEVAM HABERİ EKLE</div><form class="follow-form" data-follow-form="${esc(item.id)}"><input name="title" maxlength="240" placeholder="Devam haberinin başlığı" required><input name="link" type="url" placeholder="https://kaynak.com/devam-haberi" required><button>Devam haberi ekle</button></form></div>`:''}`;
}

function renderAdminItems() {
  const items = state.items;
  $('#adminCount').textContent = `${items.length} haber`;
  $('#adminList')?.remove();
  if (!items.length) return;
  const list = document.createElement('div');
  list.id = 'adminList';
  list.innerHTML = items.map((item) => `<div class="admin-story"><div><b>${esc(item.title)}</b><small>${esc(item.categoryName || categories().find((c)=>c.id===item.categoryId)?.name || 'Haber')} · ${esc(hostOf(item.link))}</small></div><div class="admin-story-actions"><button class="mini" data-edit-item="${esc(item.id)}">Düzenle</button><button class="mini danger" data-delete-item="${esc(item.id)}">Sil</button></div></div>`).join('');
  $('#editor').append(list);
  list.querySelectorAll('[data-edit-item]').forEach((button) => button.onclick = () => editItem(button.dataset.editItem));
  list.querySelectorAll('[data-delete-item]').forEach((button) => button.onclick = () => deleteItem(button.dataset.deleteItem));
}

function renderFeed() {
  const query = $('#search').value.trim().toLocaleLowerCase('tr-TR');
  const items = state.items.filter((item) => (!activeCategory || item.categoryId===activeCategory) && (!query || `${item.title} ${hostOf(item.link)} ${(item.followups||[]).map((follow)=>follow.title).join(' ')}`.toLocaleLowerCase('tr-TR').includes(query)));
  $('#feedTitle').textContent = `${items.length} haber`;
  $('#empty').classList.toggle('hidden', items.length > 0);
  $('#feed').innerHTML = items.map((item) => {
    const category = categories().find((entry) => entry.id === item.categoryId)?.name || item.categoryName || 'Haber';
    const canManage = Boolean(adminKey);
    return `<article class="story"><div class="story-meta"><span class="tag">${esc(category)}</span><span>·</span><time>${esc(formatDate(item.createdAt))}</time><span>·</span><span>${esc(hostOf(item.link))}</span></div>${canManage?`<div class="story-actions"><button class="mini" data-edit-item="${esc(item.id)}">Düzenle</button><button class="mini danger" data-delete-item="${esc(item.id)}">Sil</button></div>`:''}<h3>${esc(item.title)}</h3>${safeLink(item.link, item.link)}<div class="source-line">Haber kaynağı: ${esc(hostOf(item.link))}</div>${renderFollowups(item,canManage)}</article>`;
  }).join('');
  $('#feed').querySelectorAll('[data-edit-item]').forEach((button) => button.onclick = () => editItem(button.dataset.editItem));
  $('#feed').querySelectorAll('[data-delete-item]').forEach((button) => button.onclick = () => deleteItem(button.dataset.deleteItem));
  $('#feed').querySelectorAll('[data-follow-form]').forEach((form) => form.onsubmit = (event) => addFollowup(event,form));
  $('#feed').querySelectorAll('[data-delete-follow]').forEach((button) => button.onclick = () => deleteFollowup(button.dataset.deleteFollow));
  $('#feed').querySelectorAll('[data-edit-follow]').forEach((button) => button.onclick = () => editFollowup(button.dataset.editFollow));
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
  $('#title').value = item.title;
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
  try { state = await request(method,payload); setError(); render(); toast(message); }
  catch (error) { setError(error.message); }
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
  const title = prompt('Devam haberinin başlığı',followup.title);
  if (title === null) return;
  const link = prompt('Devam haberinin bağlantısı',followup.link);
  if (link === null) return;
  if (!validUrl(link)) return toast('Geçerli bir http veya https bağlantısı girin.');
  await syncRequest('PUT',{resource:'followup',itemId,followupId,title,link},'Devam haberi güncellendi.');
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
$('#search').oninput = renderFeed;
load();
