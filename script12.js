(function() {
// ========== SUPABASE CONFIGURATION ==========
const SUPABASE_URL = 'https://dashboard-omega-ten-14.vercel.app/api';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1c3ZzbnBqdmJqbnRhZnpvd25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTkzNjMsImV4cCI6MjA5MTA3NTM2M30.Y202QpgUCKMi5HGObvTWujQUxmP6XRP3K3nEldR5NXQ';
let supabase;
let currentUser = null;
let isAdmin = false;
let isSupabaseReady = false;
let userPersonalData = {
nickname: '',
avatar: '',
water: { ml: 0, goal: 2000 },
notes: { main: '', extra: [] }
};

// ========== WORD OF THE DAY (из eng_terms.js) ==========
let currentWordIndex = -1;

function getWordOfTheDay() {
    // Проверяем существование PRO_ENGLISH_TERMS
    if (typeof PRO_ENGLISH_TERMS === 'undefined') {
        console.warn('⚠️ PRO_ENGLISH_TERMS not loaded');
        return { word: '—', pronunciation: '', translation: '', definition: 'Загрузка...', example: '—', example_ru: '—', category: '' };
    }
    
    const today = new Date().toLocaleDateString('en-CA');
    const saved = localStorage.getItem('word_of_the_day');
    
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.date === today && parsed.wordIndex !== undefined && parsed.wordIndex < PRO_ENGLISH_TERMS.length) {
                currentWordIndex = parsed.wordIndex;
                return PRO_ENGLISH_TERMS[currentWordIndex];
            }
        } catch(e) {}
    }
    
    const newIndex = Math.floor(Math.random() * PRO_ENGLISH_TERMS.length);
    currentWordIndex = newIndex;
    localStorage.setItem('word_of_the_day', JSON.stringify({
        date: today,
        wordIndex: newIndex
    }));
    return PRO_ENGLISH_TERMS[newIndex];
}

// ========== UTILS: БЕЗОПАСНЫЙ ПАРСИНГ ==========
function transliterate(word) {
const a = { "Ё ": "YO ", "Й ": "I ", "Ц ": "TS ", "У ": "U ", "К ": "K ", "Е ": "E ", "Н ": "N ", "Г ": "G ", "Ш ": "SH ", "Щ ": "SCH ", "З ": "Z ", "Х ": "H ", "Ъ ": " ", "ё ": "yo ", "й ": "i ", "ц ": "ts ", "у ": "u ", "к ": "k ", "е ": "e ", "н ": "n ", "г ": "g ", "ш ": "sh ", "щ ": "sch ", "з ": "z ", "х ": "h ", "ъ ": " ", "Ф ": "F ", "Ы ": "I ", "В ": "V ", "А ": "A ", "П ": "P ", "Р ": "R ", "О ": "O ", "Л ": "L ", "Д ": "D ", "Ж ": "ZH ", "Э ": "E ", "ф ": "f ", "ы ": "i ", "в ": "v ", "а ": "a ", "п ": "p ", "р ": "r ", "о ": "o ", "л ": "l ", "д ": "d ", "ж ": "zh ", "э ": "e ", "Я ": "Ya ", "Ч ": "CH ", "С ": "S ", "М ": "M ", "И ": "I ", "Т ": "T ", "Ь ": " ", "Б ": "B ", "Ю ": "YU ", "я ": "ya ", "ч ": "ch ", "с ": "s ", "м ": "m ", "и ": "i ", "т ": "t ", "ь ": " ", "б ": "b ", "ю ": "yu "};
return word.split('').map(char => a[char] || char).join(" ").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}
function generateMainCardId(title) {
const base = transliterate(title) || 'card';
let id = base + '' + Date.now();
let counter = 0;
while (document.querySelector('[data-card-id="' + id + '"]') && counter < 100) {
id = base + '' + Date.now() + '_' + (++counter);
}
return id;
}

// ========== UI: LOGIN & MODALS ==========
function createLoginUI() {
  if (document.getElementById('authOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;justify-content:center;align-items:center;';
  
  overlay.innerHTML = `
    <div style="background:#fff;padding:30px;border-radius:12px;width:320px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
      <h2 style="margin:0 0 20px;font-size:1.5rem;color:#2d3748;">🔐 Вход в систему</h2>
      <input id="loginUsername" type="text" placeholder="Логин (например: user)" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #cbd5e0;border-radius:6px;box-sizing:border-box;font-size:1rem;">
      <input id="loginPass" type="password" placeholder="Пароль" style="width:100%;padding:10px;margin-bottom:15px;border:1px solid #cbd5e0;border-radius:6px;box-sizing:border-box;font-size:1rem;">
      <div id="loginError" style="color:#e53e3e;font-size:0.9rem;margin-bottom:10px;min-height:1.2em;"></div>
      <button id="loginBtn" style="width:100%;padding:12px;background:#4299e1;color:#fff;border:none;border-radius:6px;font-size:1rem;cursor:pointer;font-weight:600;">Войти</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('loginBtn').onclick = attemptLogin;
  document.getElementById('loginPass').onkeypress = function(e) { if(e.key==='Enter') attemptLogin(); };
  document.getElementById('loginUsername').onkeypress = function(e) { if(e.key==='Enter') attemptLogin(); };
}

function showLoginUI() { createLoginUI(); document.getElementById('authOverlay').style.display = 'flex'; }
function hideLoginUI() { const el = document.getElementById('authOverlay'); if(el) el.style.display = 'none'; }

async function attemptLogin() {
  const username = document.getElementById('loginUsername').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.innerText = '';

  if (!username || !pass) {
    errEl.innerText = 'Заполните все поля';
    return;
  }

  const email = `${username}@gv.ru`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: pass
  });

  if (error) {
    errEl.innerText = '❌ Неверный логин или пароль';
    return;
  }

  await handleAuthState(data.user);
}

function showCardTypeModal(onSelect) {
if (document.getElementById('cardTypeModal')) return;
const modal = document.createElement('div');
modal.id = 'cardTypeModal';
modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;justify-content:center;align-items:center;';
modal.innerHTML = `<div style="background:#fff;padding:25px;border-radius:16px;width:350px;text-align:center;">
<h3 style="margin:0 0 20px;">📋 Для кого карточка?</h3>
<button id="cardTypeUser" style="display:block;width:100%;padding:12px;margin-bottom:10px;background:#eef6fc;border:1px solid #667eea;border-radius:8px;cursor:pointer;">👤 Только для меня</button>
<button id="cardTypeMain" style="display:block;width:100%;padding:12px;margin-bottom:15px;background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;cursor:pointer;">🌍 Для всех пользователей</button>
<button id="cardTypeCancel" style="display:block;width:100%;padding:8px;background:transparent;border:none;color:#666;cursor:pointer;">✕ Отмена</button>
<p style="font-size:12px;color:#666;margin-top:10px;">"Для всех" — карточка появится у каждого сотрудника</p>
</div>`;
document.body.appendChild(modal);
document.getElementById('cardTypeUser').onclick = function() { modal.remove(); onSelect('user'); };
document.getElementById('cardTypeMain').onclick = function() { modal.remove(); onSelect('main'); };
document.getElementById('cardTypeCancel').onclick = function() { modal.remove(); onSelect(null); };
modal.onclick = function(e) { if(e.target === modal) { modal.remove(); onSelect(null); } };
}
function setupLogoutButton() {
if (document.getElementById('logoutBtn')) return;
const header = document.querySelector('.header-buttons');
if (!header) return;
const btn = document.createElement('button');
btn.id = 'logoutBtn';
btn.innerText = '< Выйти';
btn.className = 'add-card-btn';
btn.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.reload(); });
header.appendChild(btn);
}

// ========== SUPABASE INIT & AUTH ==========
async function initSupabase() {
if (!window.supabase) { setTimeout(initSupabase, 500); return; }
supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sessionData = await supabase.auth.getSession();
const session = sessionData.data ? sessionData.data.session : null;
if (session) { await handleAuthState(session.user); } else { showLoginUI(); }
}
async function handleAuthState(user) {
currentUser = user;
const role = (user.app_metadata && user.app_metadata.role) || (user.user_metadata && user.user_metadata.role);
isAdmin = role === 'admin';
console.log('✅ Авторизован: ' + user.email + ' | Роль: ' + (isAdmin ? 'ADMIN' : 'USER'));
isSupabaseReady = true;
hideLoginUI();
setupLogoutButton();

await loadUserSettingsFromDB();
await loadAllCardsFromDB();
loadSavedCards();
renderBottomMenu();
applyVisibilityAndUpdateUI();
restorePanelState();
applyPersonalDataToUI();
loadWaterModules();
loadNotesModules();
attachDragEvents();
attachEditEvents();

const observer = new MutationObserver(function() { saveCardOrder(); renderBottomMenu(); });
observer.observe(document.getElementById('dashboardGrid'), { childList: true, subtree: false });
}

// ========== DB SYNC FUNCTIONS ==========
async function loadUserSettingsFromDB() {
if (!isSupabaseReady) return;
try {
const result = await supabase.from('user_settings').select('card_order, hidden_cards, nickname, avatar_filename, water_data, notes_data').eq('user_id', currentUser.id).single();
const data = result.data;
if (data) {
localStorage.setItem('dashboard_card_order', JSON.stringify(data.card_order || []));
localStorage.setItem('dashboard_hidden_cards', JSON.stringify(data.hidden_cards || []));
userPersonalData.nickname = data.nickname || '';
userPersonalData.avatar = data.avatar_filename || '';
userPersonalData.water = data.water_data || { ml: 0, goal: 2000 };
userPersonalData.notes = data.notes_data || { main: '', extra: [] };
}
} catch (e) { console.warn('⚠️ Нет настроек в БД, используем дефолт'); }
}
async function syncUserSettings() {
if (!isSupabaseReady || !currentUser) return;
const order = JSON.parse(localStorage.getItem('dashboard_card_order') || '[]');
const hidden = JSON.parse(localStorage.getItem('dashboard_hidden_cards') || '[]');
await supabase.from('user_settings').upsert({
user_id: currentUser.id, card_order: order, hidden_cards: hidden, updated_at: new Date().toISOString()
}, { onConflict: 'user_id' });
}
async function syncPersonalDataToDB() {
if (!isSupabaseReady || !currentUser) return;
try {
await supabase.from('user_settings').upsert({
user_id: currentUser.id,
nickname: userPersonalData.nickname,
avatar_filename: userPersonalData.avatar,
water_data: userPersonalData.water,
notes_data: userPersonalData.notes,
updated_at: new Date().toISOString()
}, { onConflict: 'user_id' });
} catch(e) { console.warn('⚠️ Ошибка сохранения личных данных:', e); }
}
function applyPersonalDataToUI() {
loadCurrentAvatarFromDB(userPersonalData.avatar);
if (!userPersonalData.nickname) { userPersonalData.nickname = getRandomNickname(); syncPersonalDataToDB(); }
const nickEl = document.getElementById('nicknameDisplay');
if (nickEl) nickEl.innerText = userPersonalData.nickname;
const refreshBtn = document.getElementById('refreshNicknameBtn');
if (refreshBtn) refreshBtn.onclick = updateNicknameDisplay;
updateGreetingAndDate();
updateWaterUIFromDB();
updateNotesUIFromDB();
}
async function loadAllCardsFromDB() {
if (!isSupabaseReady) return;
try {
const mainResult = await supabase.from('cards').select('*').eq('type', 'main').is('user_id', null).order('position', { ascending: true });
const mainData = mainResult.data || [];
const userResult = await supabase.from('cards').select('*').eq('type', 'user').eq('user_id', currentUser.id).order('position', { ascending: true });
const userData = userResult.data || [];
localStorage.setItem('dashboard_main_db_cards', JSON.stringify(mainData));
localStorage.setItem('dashboard_custom_cards', JSON.stringify(userData));
var allCards = mainData.concat(userData);
allCards.forEach(function(card) {
if (card.content) {
try { 
var groups = (typeof card.content === 'string') ? JSON.parse(card.content) : card.content;
localStorage.setItem('dashboard_links_' + card.id, JSON.stringify(groups)); 
} catch(e) { localStorage.setItem('dashboard_links_' + card.id, JSON.stringify([])); }
}
});
} catch (e) { console.error('❌ Ошибка загрузки карточек:', e); }
}
async function saveCardToDB(cardData, isMainCard) {
if (!isSupabaseReady || !currentUser) return;
var type = isMainCard ? 'main' : 'user';
var userId = isMainCard ? null : currentUser.id;
try {
var payload = { id: cardData.id, user_id: userId, type: type, title: cardData.title, emoji: cardData.emoji || '📁', content: JSON.stringify(cardData.groups || []), position: cardData.position || 0, is_visible: true, updated_at: new Date().toISOString() };
var result = await supabase.from('cards').upsert(payload, { onConflict: 'id' });
if (result.error) throw result.error;
} catch (e) { console.error('❌ Ошибка сохранения:', e.message); alert('Ошибка сохранения: ' + e.message); }
}
async function deleteCardFromDB(cardId, isMainCard) {
if (!isSupabaseReady || !currentUser) return;
try {
var query = supabase.from('cards').delete();
if (isMainCard) query = query.eq('id', cardId).eq('type', 'main');
else query = query.eq('id', cardId).eq('user_id', currentUser.id);
var result = await query;
if (result.error) throw result.error;
} catch (e) { console.error('❌ Ошибка удаления:', e.message); }
}

// ========== ORIGINAL LOGIC ==========
var isEditMode = false;
var editModeBtn = document.getElementById('editModeBtn');
var bodyEl = document.body;
function toggleEditMode() {
isEditMode = !isEditMode;
if (isEditMode) { bodyEl.classList.add('edit-mode'); editModeBtn.classList.add('active'); editModeBtn.innerHTML = '✓ Готово'; }
else { bodyEl.classList.remove('edit-mode'); editModeBtn.classList.remove('active'); editModeBtn.innerHTML = '✏️ Режим редактирования'; }

const addBtn = document.getElementById('addNewCardBtn');
if (addBtn) addBtn.style.display = isEditMode ? 'none' : '';
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.style.display = isEditMode ? 'none' : '';

document.querySelectorAll('.move-group-btn').forEach(function(btn) {
  btn.style.display = isEditMode ? 'inline-block' : 'none';
});
}
if (editModeBtn) editModeBtn.addEventListener('click', toggleEditMode);

var bottomBar = document.getElementById('bottomControlBar');
var menuHandle = document.getElementById('menuHandle');
var handleArrow = document.getElementById('handleArrow');
function toggleBottomMenu() {
if (!bottomBar) return;
var isCollapsed = bottomBar.classList.contains('collapsed');
if (isCollapsed) { bottomBar.classList.remove('collapsed'); if(handleArrow) handleArrow.innerText = '▼'; localStorage.setItem('bottom_panel_collapsed', 'false'); }
else { bottomBar.classList.add('collapsed'); if(handleArrow) handleArrow.innerText = '▲'; localStorage.setItem('bottom_panel_collapsed', 'true'); }
}
function restorePanelState() {
var saved = localStorage.getItem('bottom_panel_collapsed');
if (saved === 'false') { bottomBar.classList.remove('collapsed'); if(handleArrow) handleArrow.innerText = '▼'; }
else { bottomBar.classList.add('collapsed'); if(handleArrow) handleArrow.innerText = '▲'; }
}
if (menuHandle) menuHandle.addEventListener('click', toggleBottomMenu);

// ========== AVATAR (Supabase Sync) ==========
var AVATAR_LIST = ['avatar1.png','avatar2.png','avatar3.png','avatar4.png','avatar5.png','avatar6.png','avatar7.png','avatar8.png','avatar9.png','avatar10.png','avatar11.png','avatar12.png','avatar13.png','avatar14.png','avatar15.png'];
function getAvatarPath(f) { return 'avatar/' + f; }
function loadCurrentAvatarFromDB(filename) {
const avatarImg = document.getElementById('avatarImage');
const placeholder = document.getElementById('avatarPlaceholder');
if (filename && filename.trim() !== '') {
if(avatarImg) { avatarImg.src = getAvatarPath(filename); avatarImg.style.display = 'block'; }
if(placeholder) placeholder.style.display = 'none';
} else {
if(avatarImg) avatarImg.style.display = 'none';
if(placeholder) placeholder.style.display = 'flex';
}
}
function setAvatar(f) { userPersonalData.avatar = (f && f.trim()) ? f : ''; loadCurrentAvatarFromDB(userPersonalData.avatar); syncPersonalDataToDB(); closeAvatarModal(); }
function clearAvatar() { userPersonalData.avatar = ''; loadCurrentAvatarFromDB(''); syncPersonalDataToDB(); closeAvatarModal(); }
var avatarModal = document.getElementById('avatarModal');
function openAvatarModal() { renderAvatarGallery(); avatarModal.classList.add('active'); }
function closeAvatarModal() { avatarModal.classList.remove('active'); }
function renderAvatarGallery() {
var gallery = document.getElementById('avatarGallery');
if (!gallery) return;
gallery.innerHTML = '';
var current = userPersonalData.avatar || '';
AVATAR_LIST.forEach(function(af) {
var opt = document.createElement('div'); opt.className = 'avatar-option';
if (current === af) opt.classList.add('selected');
var img = document.createElement('img'); img.src = getAvatarPath(af); img.alt = af;
img.onerror = function() { opt.style.display = 'none'; };
opt.appendChild(img);
opt.addEventListener('click', function() { setAvatar(af); });
gallery.appendChild(opt);
});
if (!gallery.children.length) gallery.innerHTML = '<div style="color:#666;padding:20px;">📁 Загрузите аватары в папку avatar/</div>';
}
var avatarBtn = document.getElementById('avatarButton');
if (avatarBtn) avatarBtn.addEventListener('click', openAvatarModal);
var avatarCancelBtn = document.getElementById('avatarCancelBtn');
if (avatarCancelBtn) avatarCancelBtn.addEventListener('click', closeAvatarModal);
var avatarClearBtn = document.getElementById('avatarClearBtn');
if (avatarClearBtn) avatarClearBtn.addEventListener('click', clearAvatar);
if (avatarModal) avatarModal.addEventListener('click', function(e) { if (e.target === avatarModal) closeAvatarModal(); });

// ========== LINKS DATA & EDITOR ==========
var STORAGE_PREFIX = 'dashboard_links_';
var defaultCatalogGroups = [{ category: "Каталоги", links:[{name: "Oasis",url: "https://www.oasiscatalog.com/",iconSrc: "icon/oasis.png"},{name: "Проект 111",url: "https://gifts.ru/",iconSrc: "icon/111.png"},{name: "Happy Gifts",url: "https://happygifts.ru/",iconSrc: "icon/hg.png"},{name: "Океан",url: "https://www.oceangifts.ru/",iconSrc: "icon/ocean.png"}]},{ category: "Поставщики", links:[{name : "Поставщик 1",url: "https://",iconSrc: "🏭"},{name: "Поставщик 2",url: "https://",iconSrc: "🏭"},{name: "Поставщик 3",url: "https://",iconSrc: "🏭"},{name: "Поставщик 4",url: "https://",iconSrc: "🏭"}]}];
var defaultDeliveryGroups = [{ category: "Доставки", links:[{name: "1 МИГ",url: "https://home.courierexe.ru/122/auth/login",iconSrc: "icon/1mig.png",isYandex:false},{name: "Яндекс доставка",url: "https://gv.gt.tc/dash/",iconSrc: "icon/yandex.png",isYandex:true},{name: "DPD",url: "https://gv.gt.tc/dash/",iconSrc: "icon/dpd.png",isYandex:false},{name: "ТопЭкспресс",url: "https://lk.top-ex.ru/user/login",iconSrc: "icon/te.png",isYandex:false}]},{ category: "Пропуск на территорию", links:[{name: "Заказать пропуск",url: "http://217.67.191.217/Account/LogOn?ReturnUrl=%2f",iconSrc: "icon/visitor.png",isYandex:false}]}];
var defaultToolsGroups = [{ category: "Калькуляторы", links:[{name: "ГрафиксВ",url: "https://gv.gt.tc",iconSrc: "icon/gv.png"},{name: "PrintPoint",url: "https://printpoint.ru/",iconSrc: "icon/pp.png"},{name: "Группа М",url: "https://gmprint.ru/calc/leaflets",iconSrc: "icon/gm.png"},{name: "Цифровые технологии",url: "https://cifteh.ru/brochure-crampon",iconSrc: "icon/ctech.png"}]},{ category: "Сервисы", links:[{name: "редактор PDF",url: "https://ilovepdf.com/ru",iconSrc: "icon/ipdf.png"},{name: "Google Диск",url: "https://drive.google.com/",iconSrc: "icon/google.png"}]}];
var CARD_GROUPS_STORAGE = 'dashboard_custom_cards';
var customCards = [];

function loadGroups(cardId, defaultGroups) {
var key = STORAGE_PREFIX + cardId;
var saved = localStorage.getItem(key);
if (saved) { try { var parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch(e) {} }
return JSON.parse(JSON.stringify(defaultGroups));
}
function saveGroups(cardId, groups) { localStorage.setItem(STORAGE_PREFIX + cardId, JSON.stringify(groups)); }

var pendingGroups = null, pendingCardId = null, pendingGroupIndex = null, pendingDefaultGroups = null;
function openGroupLinksEditor(cardId, groupIndex, groups, defaultGroupsRef) {
pendingCardId = cardId; pendingGroupIndex = groupIndex; pendingGroups = groups; pendingDefaultGroups = defaultGroupsRef;
document.getElementById('linksEditorTitle').innerText = 'Редактирование';
var tableArea = document.getElementById('linksEditorTableArea');
tableArea.innerHTML = '';
var table = document.createElement('table');
table.className = 'links-editor-table';
table.innerHTML = '<thead><tr><th>Название</th><th>Ссылка (обязательно с https://)</th><th>Иконка</th><th></th></thead><tbody></tbody>';
var tbody = table.querySelector('tbody');
function renderRows() {
tbody.innerHTML = '';
pendingGroups[pendingGroupIndex].links.forEach(function(link, lIdx) {
var row = tbody.insertRow();
var nameInput = document.createElement('input'); nameInput.value = link.name; nameInput.style.cssText = 'width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:4px;';
nameInput.onchange = function(e) { pendingGroups[pendingGroupIndex].links[lIdx].name = e.target.value; };
row.insertCell(0).appendChild(nameInput);
var urlInput = document.createElement('input'); urlInput.value = link.url; urlInput.style.cssText = 'width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:4px;';
urlInput.onchange = function(e) { pendingGroups[pendingGroupIndex].links[lIdx].url = e.target.value; };
row.insertCell(1).appendChild(urlInput);
var iconInput = document.createElement('input'); iconInput.value = link.iconSrc || ''; iconInput.style.cssText = 'width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:4px;';
iconInput.onchange = function(e) { pendingGroups[pendingGroupIndex].links[lIdx].iconSrc = e.target.value; };
row.insertCell(2).appendChild(iconInput);
var delBtn = document.createElement('button'); delBtn.innerText = '❌'; delBtn.style.cssText = 'background:#fed7d7;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;';
delBtn.onclick = function() { pendingGroups[pendingGroupIndex].links.splice(lIdx, 1); renderRows(); };
row.insertCell(3).appendChild(delBtn);
});
var addCell = tbody.insertRow().insertCell(0); addCell.colSpan = 4;
var addBtn = document.createElement('button'); addBtn.innerText = '+ Добавить ссылку'; addBtn.style.cssText = 'padding:8px 16px;margin:10px 0;border-radius:20px;border:1px solid #667eea;background:#eef6fc;cursor:pointer;';
addBtn.onclick = function() { pendingGroups[pendingGroupIndex].links.push({ name: "Новая ссылка", url: "https://", iconSrc: "🔗" }); renderRows(); };
addCell.appendChild(addBtn);
}
renderRows(); tableArea.appendChild(table);
document.getElementById('linksEditorModal').classList.add('active');
}
function saveAndCloseLinksEditor() {
if (pendingCardId && pendingGroups) {
saveGroups(pendingCardId, pendingGroups);
if (!pendingCardId.startsWith('custom_')) {
if (!confirm("Вы редактируете основную карточку. Изменения будут видны у всех пользователей. Сохранить?")) { closeLinksEditor(); return; }
}
var cardEl = document.querySelector('.card[data-card-id="' + pendingCardId + '"]');
var title = cardEl ? cardEl.querySelector('h2').innerText : pendingCardId;
var emoji = cardEl ? cardEl.querySelector('.emoji').innerText : '📁';
saveCardToDB({ id: pendingCardId, title: title, emoji: emoji, groups: pendingGroups, position: Array.from(document.querySelectorAll('.card')).indexOf(cardEl) * 10 }, !pendingCardId.startsWith('custom_'));
var containerId = pendingCardId + 'Container';
var cont = document.getElementById(containerId);
if (cont) renderCardGroups(cont, pendingCardId, pendingGroups, pendingDefaultGroups);
}
closeLinksEditor();
}
function closeLinksEditor() {
document.getElementById('linksEditorModal').classList.remove('active');
pendingCardId = pendingGroupIndex = pendingGroups = pendingDefaultGroups = null;
}
var linksEditorOkBtn = document.getElementById('linksEditorOkBtn');
if (linksEditorOkBtn) linksEditorOkBtn.addEventListener('click', saveAndCloseLinksEditor);
var linksEditorCancelBtn = document.getElementById('linksEditorCancelBtn');
if (linksEditorCancelBtn) linksEditorCancelBtn.addEventListener('click', closeLinksEditor);
var linksEditorModal = document.getElementById('linksEditorModal');
if (linksEditorModal) linksEditorModal.addEventListener('click', function(e) { if(e.target === linksEditorModal) closeLinksEditor(); });

function renderCardGroups(container, cardId, groups, defaultGroupsRef) {
container.innerHTML = '';
var isCustomCard = cardId.startsWith('custom_');
var canEditGroups = isAdmin || isCustomCard;

groups.forEach(function(group, idx) {
  var groupDiv = document.createElement('div'); groupDiv.className = 'links-group';
  var titleDiv = document.createElement('div'); titleDiv.className = 'group-title';
  titleDiv.innerHTML = '<span>' + group.category + '</span>';
  var btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:4px;align-items:center;';
  
  if (canEditGroups) {
    if (idx > 0) {
      var upBtn = document.createElement('button');
      upBtn.innerText = '⬆️';
      upBtn.className = 'move-group-btn';
      upBtn.style.backgroundColor = '#edf2f7';
      upBtn.style.border = '1px solid #cbd5e0';
      upBtn.style.borderRadius = '4px';
      upBtn.style.cursor = 'pointer';
      upBtn.style.padding = '2px 6px';
      upBtn.style.fontSize = '12px';
      upBtn.style.display = isEditMode ? 'inline-block' : 'none';
      
      upBtn.onclick = function(e) {
        e.stopPropagation();
        var temp = groups[idx];
        groups[idx] = groups[idx-1];
        groups[idx-1] = temp;
        
        saveGroups(cardId, groups);
        renderCardGroups(container, cardId, groups, defaultGroupsRef);
        
        if (!isCustomCard) {
           var cardEl = document.querySelector('.card[data-card-id="' + cardId + '"]');
           if (cardEl) {
             var title = cardEl.querySelector('h2').innerText;
             var emoji = cardEl.querySelector('.emoji').innerText;
             saveCardToDB({ id: cardId, title: title, emoji: emoji, groups: groups, position: 0 }, true);
           }
        }
      };
      btns.appendChild(upBtn);
    }

    if (idx < groups.length - 1) {
      var downBtn = document.createElement('button');
      downBtn.innerText = '⬇️';
      downBtn.className = 'move-group-btn';
      downBtn.style.backgroundColor = '#edf2f7';
      downBtn.style.border = '1px solid #cbd5e0';
      downBtn.style.borderRadius = '4px';
      downBtn.style.cursor = 'pointer';
      downBtn.style.padding = '2px 6px';
      downBtn.style.fontSize = '12px';
      downBtn.style.display = isEditMode ? 'inline-block' : 'none';

      downBtn.onclick = function(e) {
        e.stopPropagation();
        var temp = groups[idx];
        groups[idx] = groups[idx+1];
        groups[idx+1] = temp;
        
        saveGroups(cardId, groups);
        renderCardGroups(container, cardId, groups, defaultGroupsRef);
        
        if (!isCustomCard) {
           var cardEl = document.querySelector('.card[data-card-id="' + cardId + '"]');
           if (cardEl) {
             var title = cardEl.querySelector('h2').innerText;
             var emoji = cardEl.querySelector('.emoji').innerText;
             saveCardToDB({ id: cardId, title: title, emoji: emoji, groups: groups, position: 0 }, true);
           }
        }
      };
      btns.appendChild(downBtn);
    }

    var editBtn = document.createElement('button'); editBtn.innerText = '✒️'; editBtn.className = 'edit-group-btn';
    editBtn.onclick = function(e) {
      e.stopPropagation();
      var t = prompt('Редактирование', group.category);
      if (t && t.trim()) { group.category = t.trim(); saveGroups(cardId, groups); renderCardGroups(container, cardId, groups, defaultGroupsRef); }
    };
    btns.appendChild(editBtn);

    var delBtn = document.createElement('button'); delBtn.innerText = '❌'; delBtn.className = 'delete-group-btn';
    delBtn.onclick = function(e) {
      e.stopPropagation();
      if (confirm('Удалить группу "' + group.category + '"?')) {
        groups.splice(idx, 1);
        saveGroups(cardId, groups);
        renderCardGroups(container, cardId, groups, defaultGroupsRef);
        if (!isCustomCard) {
           var cardEl = document.querySelector('.card[data-card-id="' + cardId + '"]');
           if (cardEl) {
             var title = cardEl.querySelector('h2').innerText;
             var emoji = cardEl.querySelector('.emoji').innerText;
             saveCardToDB({ id: cardId, title: title, emoji: emoji, groups: groups, position: 0 }, true);
           }
        }
      }
    };
    btns.appendChild(delBtn);
  }
  
  titleDiv.appendChild(btns); groupDiv.appendChild(titleDiv);
  
  var grid = document.createElement('div'); grid.className = 'links-grid';
  group.links.forEach(function(link) {
    var a = document.createElement('a'); a.className = 'link-btn';
    if (link.isYandex) { a.href = 'javascript:void(0)'; a.onclick = function(e) { e.preventDefault(); document.getElementById('yandexModal').classList.add('active'); }; }
    else { a.href = link.url; a.target = '_blank'; a.rel = 'noopener'; }
    var icon = document.createElement('span'); icon.className = 'link-icon';
    if (link.iconSrc && (link.iconSrc.startsWith('http') || link.iconSrc.startsWith('/') || link.iconSrc.startsWith('icon/'))) {
      var img = document.createElement('img'); img.src = link.iconSrc; img.style.cssText = 'width:18px;height:18px;'; img.onerror = function() { img.style.display='none'; }; icon.appendChild(img);
    } else { icon.innerText = link.iconSrc || '🔗'; }
    a.appendChild(icon); a.appendChild(document.createTextNode(link.name)); grid.appendChild(a);
  });
  if (canEditGroups) {
    var editLinksBtn = document.createElement('button'); editLinksBtn.innerHTML = '✒️'; editLinksBtn.className = 'edit-links-icon'; editLinksBtn.style.opacity = '0.6';
    editLinksBtn.onclick = function() { openGroupLinksEditor(cardId, idx, groups, defaultGroupsRef); };
    grid.appendChild(editLinksBtn);
  }
  groupDiv.appendChild(grid); container.appendChild(groupDiv);
});
if (canEditGroups) {
  var addGroup = document.createElement('button'); addGroup.innerHTML = '➕ Добавить группу'; addGroup.className = 'add-group-btn';
  addGroup.onclick = function() {
    var t = prompt('Редактирование', 'Новая группа');
    if (t && t.trim()) { groups.push({ category: t.trim(), links: [{ name: "Пример ссылки", url: "https://", iconSrc: "🔗" }] }); saveGroups(cardId, groups); renderCardGroups(container, cardId, groups, defaultGroupsRef); }
  };
  container.appendChild(addGroup);
}
}
function renderCard(cardId, title, emoji, defaultGroups, isCustom) {
var groups = loadGroups(cardId, defaultGroups);
var cardDiv = document.createElement('div');
cardDiv.className = 'card';
cardDiv.setAttribute('data-card-id', cardId);
cardDiv.setAttribute('draggable', 'true');
var canEditHeader = isAdmin || isCustom;
var canDelete = isAdmin || isCustom;
var headerHTML = '<div class="card-header"><span class="emoji">' + emoji + '</span><h2>' + title + '</h2>';
if (canEditHeader) headerHTML += '<button class="edit-header-btn" data-card-edit="' + cardId + '">✒️</button>';
if (canDelete) headerHTML += '<button class="delete-card-btn" data-card-delete="' + cardId + '">❌</button>';
headerHTML += '</div><div id="' + cardId + 'Container"></div>';
cardDiv.innerHTML = headerHTML;
renderCardGroups(cardDiv.querySelector('#' + cardId + 'Container'), cardId, groups, defaultGroups);
return cardDiv;
}
function saveCardOrder() {
var order = Array.from(document.querySelectorAll('.card')).map(c => c.getAttribute('data-card-id'));
localStorage.setItem('dashboard_card_order', JSON.stringify(order));
syncUserSettings();
}

// ========== VIBE / NICKNAME (Supabase Sync) ==========
function updateNicknameDisplay() { 
var nickname = getRandomNickname(); 
userPersonalData.nickname = nickname; 
var displayEl = document.getElementById('nicknameDisplay'); 
if(displayEl) displayEl.innerText = nickname; 
syncPersonalDataToDB(); 
}

// ========== WATER TRACKER (Supabase Sync) ==========
function updateWaterUIFromDB() {
const amountSpan = document.getElementById('waterAmountDisplay');
const fillDiv = document.getElementById('waterProgressFill');
const goalInput = document.getElementById('waterGoalInput');
if(amountSpan) amountSpan.innerText = userPersonalData.water.ml + ' мл';
if(fillDiv) fillDiv.style.width = ((userPersonalData.water.ml / userPersonalData.water.goal) * 100) + '%';
if(goalInput) goalInput.value = userPersonalData.water.goal;
}
function addWater(ml) {
let nv = userPersonalData.water.ml + ml;
if(nv > userPersonalData.water.goal) nv = userPersonalData.water.goal;
userPersonalData.water.ml = nv;
updateWaterUIFromDB(); syncPersonalDataToDB();
}
function resetWater() { userPersonalData.water.ml = 0; updateWaterUIFromDB(); syncPersonalDataToDB(); }
function setWaterGoal() {
let ng = parseInt(document.getElementById('waterGoalInput').value);
if(isNaN(ng) || ng < 100) ng = 2000;
userPersonalData.water.goal = ng;
userPersonalData.water.ml = Math.min(userPersonalData.water.ml, ng);
updateWaterUIFromDB(); syncPersonalDataToDB();
}
function loadWaterModules() {
updateWaterUIFromDB();
document.querySelectorAll('.water-btn[data-add]').forEach(b => b.onclick = () => addWater(parseInt(b.dataset.add)));
const resetBtn = document.getElementById('resetWaterBtn'); if(resetBtn) resetBtn.onclick = resetWater;
const setGoalBtn = document.getElementById('setWaterGoalBtn'); if(setGoalBtn) setGoalBtn.onclick = setWaterGoal;
}

// ========== SMART NOTES (Supabase Sync) ==========
function updateNotesUIFromDB() {
const mainTA = document.getElementById('quickNotes');
if(mainTA) mainTA.value = userPersonalData.notes.main || '';
renderExtraNotes();
}
function renderExtraNotes() {
const extraCont = document.getElementById('extraNotesContainer');
if(!extraCont) return;
extraCont.innerHTML = '';
userPersonalData.notes.extra.forEach(function(txt, idx){
const div = document.createElement('div'); div.className = 'extra-note-item';
const ta = document.createElement('textarea'); ta.value = txt; ta.rows = 2; ta.placeholder = 'ещё одна мысль ' + (idx+1) + '...';
ta.oninput = function(e) { userPersonalData.notes.extra[idx] = e.target.value; syncPersonalDataToDB(); };
const rm = document.createElement('button'); rm.innerText = '✕'; rm.className = 'remove-note-btn';
rm.onclick = function() { userPersonalData.notes.extra.splice(idx, 1); renderExtraNotes(); syncPersonalDataToDB(); };
div.appendChild(ta); div.appendChild(rm); extraCont.appendChild(div);
});
}
function addExtraNote() { userPersonalData.notes.extra.push(''); renderExtraNotes(); syncPersonalDataToDB(); }
function loadNotesModules() {
updateNotesUIFromDB();
const mainTA = document.getElementById('quickNotes');
if(mainTA) mainTA.oninput = function() { userPersonalData.notes.main = mainTA.value; syncPersonalDataToDB(); };
const addBtn = document.getElementById('addExtraNoteBtn'); if(addBtn) addBtn.onclick = addExtraNote;
}

// ========== SAVED CARDS RENDER ==========
function loadSavedCards() {
var saved = localStorage.getItem(CARD_GROUPS_STORAGE);
if (saved) { try { customCards = JSON.parse(saved); } catch(e) { customCards = []; } }
var mainDBCards = JSON.parse(localStorage.getItem('dashboard_main_db_cards') || '[]');
var grid = document.getElementById('dashboardGrid');
grid.innerHTML = '';
var presetCards =  [
{ id: 'vibe', title: 'Вайб дня:', emoji: '🎭', groups: [], isSpecial: true },
{ id: 'catalog', title: 'Каталоги & поставщики', emoji: '📦', groups: defaultCatalogGroups },
{ id: 'delivery', title: 'Курьеры & доставки', emoji: '🚚', groups: defaultDeliveryGroups },
{ id: 'tools', title: 'Калькуляторы & сервисы', emoji: '🧮', groups: defaultToolsGroups },
// { id: 'wordoftheday', title: 'Слово дня', emoji: '📖', groups: [], isSpecial: true },  // ЗАКОММЕНТИРОВАНО - карточка "Слово дня" скрыта
{ id: 'water', title: 'Гидротрекер', emoji: '💧', groups: [], isSpecial: true },
{ id: 'smartnotes', title: 'Мои умные мысли', emoji: '🧠', groups: [], isSpecial: true }
];
var mainDBMap = new Map();
mainDBCards.forEach(function(c) { mainDBMap.set(c.id, c); });

presetCards.forEach(function(pc) {
if (pc.isSpecial) {
if (pc.id === 'vibe') {
var card = document.createElement('div'); card.className = 'card'; card.setAttribute('data-card-id', 'vibe');
card.innerHTML = `<div class="card-header"><span class="emoji">🎭</span><h2>Вайб дня:</h2><button class="edit-header-btn" data-card-edit="vibe">✒️</button></div><div class="datetime-section"><div class="greeting-text" id="greetingText">Добрый день</div><div class="vibe-section"><div class="vibe-subtitle" style="font-size:1rem;margin-right:15%;margin-bottom:10px;color:#5c6f87;">✨ сегодня ты</div><div><span class="nickname-display" id="nicknameDisplay">загрузка...</span><button class="refresh-btn" id="refreshNicknameBtn">🔄</button></div><div class="date-hint"><span id="liveDate">----</span> — каждый день новый вайб</div></div></div>`;
grid.appendChild(card);
}

/*
// ========== КАРТОЧКА "СЛОВО ДНЯ" - ЗАКОММЕНТИРОВАНА ==========
} else if (pc.id === 'wordoftheday') {
    var card = document.createElement('div'); 
    card.className = 'card'; 
    card.setAttribute('data-card-id', 'wordoftheday');
    
    const wordData = getWordOfTheDay();
    
    // Функция для выделения термина в определении
    function highlightTermInDefinition(definition, term) {
        if (!definition || !term) return definition || '—';
        // Экранируем спецсимволы в термине для RegExp
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Ищем термин в начале определения (с учётом разных падежей)
        const regex = new RegExp(`^(${escapedTerm}\\s*[—–-]?\\s*)`, 'i');
        if (regex.test(definition)) {
            return definition.replace(regex, `<strong style="color: #2c7a97;">$1</strong>`);
        }
        // Если термин не в начале, ищем любое вхождение
        const regexAny = new RegExp(`(${escapedTerm})`, 'gi');
        return definition.replace(regexAny, `<strong style="color: #2c7a97;">$1</strong>`);
    }
    
    const highlightedDefinition = highlightTermInDefinition(wordData.definition, wordData.word);
    
    card.innerHTML = `
        <div class="card-header">
            <span class="emoji">📖</span>
            <h2>Слово дня</h2>
            <button class="edit-header-btn" data-card-edit="wordoftheday">✒️</button>
        </div>
        <div class="word-card-content" style="padding: 8px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 2.2rem; font-weight: 700; color: #2c7a97; word-break: break-word; letter-spacing: -0.5px;">${wordData.word}</div>
                <div style="font-size: 0.85rem; color: #8ba3b6; margin-top: 6px;">${wordData.pronunciation || ''}</div>
            </div>
            
            <!-- Определение слова с выделенным термином -->
            <div style="background: #f0f4f9; border-radius: 20px; padding: 14px 16px; margin: 12px 0;">
                <div style="font-size: 0.85rem; line-height: 1.5; color: #2c3e50;">${highlightedDefinition}</div>
            </div>
            
            <!-- Кнопка информации вынесена вниз -->
            <div style="display: none; justify-content: flex-end; margin-top: 16px;">
                <div class="word-info-icon" style="cursor: pointer; color: #2c7a97; font-size: 1.1rem; background: #eef2f8; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">ℹ️</div>
            </div>
        </div>
    `;
    grid.appendChild(card);
    
    // Создаём модальное окно для всплывающей карточки с примерами
    const modalId = 'wordExamplesModal';
    if (!document.getElementById(modalId)) {
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'word-modal-overlay';
        modal.innerHTML = `
            <div class="word-modal-window">
                <div class="word-modal-header">
                    <h3>📖 Примеры использования</h3>
                    <button class="word-modal-close">✕</button>
                </div>
                <div class="word-modal-content">
                    <div class="word-example-en">
                        <div class="word-example-label">🇬🇧 English</div>
                        <div class="word-example-text" id="wordExampleEn"></div>
                    </div>
                    <div class="word-example-ru">
                        <div class="word-example-label">🇷🇺 Русский</div>
                        <div class="word-example-text" id="wordExampleRu"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Стили для модального окна
        if (!document.getElementById('wordModalStyles')) {
            const style = document.createElement('style');
            style.id = 'wordModalStyles';
            style.textContent = `
                .word-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease, visibility 0.3s ease;
                }
                .word-modal-overlay.active {
                    opacity: 1;
                    visibility: visible;
                }
                .word-modal-window {
                    background: white;
                    border-radius: 28px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    animation: modalFadeIn 0.3s ease;
                }
                @keyframes modalFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .word-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e9edf2;
                }
                .word-modal-header h3 {
                    margin: 0;
                    font-size: 1.3rem;
                    color: #1a2c3e;
                }
                .word-modal-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #8ba3b6;
                    transition: color 0.2s;
                    line-height: 1;
                }
                .word-modal-close:hover {
                    color: #2c7a97;
                }
                .word-modal-content {
                    padding: 24px;
                }
                .word-example-en, .word-example-ru {
                    margin-bottom: 24px;
                }
                .word-example-en:last-child, .word-example-ru:last-child {
                    margin-bottom: 0;
                }
                .word-example-label {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #8ba3b6;
                    margin-bottom: 10px;
                    font-weight: 600;
                }
                .word-example-text {
                    font-size: 0.95rem;
                    line-height: 1.5;
                    color: #2c3e50;
                    background: #f8fafc;
                    padding: 14px 18px;
                    border-radius: 20px;
                    font-style: italic;
                }
                .word-example-text::before {
                    content: '“';
                    font-size: 1.2rem;
                    color: #2c7a97;
                }
                .word-example-text::after {
                    content: '”';
                    font-size: 1.2rem;
                    color: #2c7a97;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Закрытие модального окна
        const closeBtn = modal.querySelector('.word-modal-close');
        closeBtn.onclick = () => modal.classList.remove('active');
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.remove('active');
        };
    }
    
    // Добавляем обработчик клика на иконку информации
    setTimeout(() => {
        const wordCard = document.querySelector('.card[data-card-id="wordoftheday"]');
        if (!wordCard) return;
        
        const infoIcon = wordCard.querySelector('.word-info-icon');
        const modal = document.getElementById('wordExamplesModal');
        const exampleEnSpan = document.getElementById('wordExampleEn');
        const exampleRuSpan = document.getElementById('wordExampleRu');
        
        if (infoIcon && modal && exampleEnSpan && exampleRuSpan) {
            // Устанавливаем текущие примеры
            exampleEnSpan.textContent = wordData.example || '—';
            exampleRuSpan.textContent = wordData.example_ru || '—';
            
            infoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                modal.classList.add('active');
            });
        }
    }, 10);
    
*/
} else if (pc.id === 'water') {
var card = document.createElement('div'); card.className = 'card'; card.setAttribute('data-card-id', 'water');
card.innerHTML = `<div class="card-header"><span class="emoji">💧</span><h2>Гидротрекер</h2><button class="edit-header-btn" data-card-edit="water">✒️</button></div><div class="water-tracker"><div class="water-stats"><span>💧 Пейте больше воды</span><span id="waterAmountDisplay">0 мл</span></div><div class="progress-bar-bg"><div class="progress-fill" id="waterProgressFill"></div></div><div class="water-controls"><button class="water-btn" data-add="250">➕ 250 мл</button><button class="water-btn" data-add="500">➕ 500 мл</button><button class="water-btn reset-btn" id="resetWaterBtn">🗑 Сброс</button></div><div class="goal-control"><span>🎯 Цель:</span><input type="number" id="waterGoalInput" class="goal-input" value="2000" step="100"><button class="water-btn" id="setWaterGoalBtn">Установить</button></div></div>`;
grid.appendChild(card);
} else if (pc.id === 'smartnotes') {
var card = document.createElement('div'); card.className = 'card'; card.setAttribute('data-card-id', 'smartnotes');
card.innerHTML = `<div class="card-header"><span class="emoji">🧠</span><h2>Мои умные мысли</h2><button class="edit-header-btn" data-card-edit="smartnotes">✒️</button></div><div class="notes-main"><textarea id="quickNotes" class="notes-area" rows="3" placeholder="Главная мысль, идея или план..."></textarea><div id="extraNotesContainer" class="extra-notes-container"></div><div class="note-footer"><button class="add-note-btn" id="addExtraNoteBtn">+ Добавить поле для мыслей</button><span>✍️ автосохранение</span></div></div>`;
grid.appendChild(card);
}
 else {
var dbCard = mainDBMap.get(pc.id);
var title = dbCard ? dbCard.title : pc.title;
var emoji = dbCard ? dbCard.emoji : pc.emoji;
var groups = pc.groups;
if (dbCard && dbCard.content) { try { groups = (typeof dbCard.content === 'string') ? JSON.parse(dbCard.content) : dbCard.content; } catch(e) { groups = pc.groups; } }
grid.appendChild(renderCard(pc.id, title, emoji, groups, false));
}
});

mainDBCards.forEach(function(dbCard) {
if (!presetCards.some(function(pc) { return pc.id === dbCard.id; })) {
var groups = [];
if (dbCard.content) { try { groups = (typeof dbCard.content === 'string') ? JSON.parse(dbCard.content) : dbCard.content; } catch(e) { groups = []; } }
grid.appendChild(renderCard(dbCard.id, dbCard.title, dbCard.emoji || '📁', groups, false));
}
});
customCards.forEach(function(card) { grid.appendChild(renderCard(card.id, card.title, card.emoji, card.groups, true)); });

var savedOrder = localStorage.getItem('dashboard_card_order');
if (savedOrder) {
try {
var orderIds = JSON.parse(savedOrder);
var cards = Array.from(grid.children);
var map = new Map();
cards.forEach(function(c) { map.set(c.getAttribute('data-card-id'), c); });
var frag = document.createDocumentFragment();
orderIds.forEach(function(id) { if (map.has(id)) frag.appendChild(map.get(id)); });
cards.forEach(function(c) { if (!frag.contains(c)) frag.appendChild(c); });
grid.innerHTML = ''; grid.appendChild(frag);
} catch(e) {}
}
attachDragEvents(); attachEditEvents();
}

// ========== DRAG & DROP ==========
function attachDragEvents() {
document.querySelectorAll('.card').forEach(function(card) {
card.setAttribute('draggable', 'true');
card.removeEventListener('dragstart', handleDragStart); card.addEventListener('dragstart', handleDragStart);
card.removeEventListener('dragover', handleDragOver); card.addEventListener('dragover', handleDragOver);
card.removeEventListener('dragenter', handleDragEnter); card.addEventListener('dragenter', handleDragEnter);
card.removeEventListener('dragleave', handleDragLeave); card.addEventListener('dragleave', handleDragLeave);
card.removeEventListener('drop', handleDrop); card.addEventListener('drop', handleDrop);
card.removeEventListener('dragend', handleDragEnd); card.addEventListener('dragend', handleDragEnd);
});
}
var dragSrc = null;
function handleDragStart(e) { dragSrc = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); this.classList.add('dragging'); }
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
function handleDragEnter(e) { this.classList.add('drag-over'); }
function handleDragLeave(e) { this.classList.remove('drag-over'); }
function handleDrop(e) {
e.stopPropagation();
if (dragSrc !== this) {
var parent = this.parentNode; var cards = Array.from(parent.children);
var dragIdx = cards.indexOf(dragSrc); var dropIdx = cards.indexOf(this);
if (dragIdx !== -1 && dropIdx !== -1) {
if (dragIdx < dropIdx) parent.insertBefore(dragSrc, this.nextSibling); else parent.insertBefore(dragSrc, this);
saveCardOrder();
}
}
this.classList.remove('drag-over'); return false;
}
function handleDragEnd(e) { this.classList.remove('dragging'); document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over')); }

// ========== EDIT EVENTS ==========
function attachEditEvents() {
document.querySelectorAll('.edit-header-btn').forEach(btn => { btn.removeEventListener('click', headerEditHandler); btn.addEventListener('click', headerEditHandler); });
document.querySelectorAll('.delete-card-btn').forEach(btn => { btn.removeEventListener('click', deleteCardHandler); btn.addEventListener('click', deleteCardHandler); });
}
function headerEditHandler(e) {
e.stopPropagation();
var cardId = this.getAttribute('data-card-edit');
var card = this.closest('.card');
var h2 = card.querySelector('.card-header h2');
var currentText = h2 ? h2.innerText : '';
var newText = prompt('Редактирование', currentText);
if (newText && newText.trim()) {
if (h2) h2.innerText = newText.trim();
var isCustom = cardId.startsWith('custom_');
if (isCustom) {
var customData = JSON.parse(localStorage.getItem(CARD_GROUPS_STORAGE) || '[]');
var idx = customData.findIndex(c => c.id === cardId);
if (idx !== -1) { customData[idx].title = newText.trim(); localStorage.setItem(CARD_GROUPS_STORAGE, JSON.stringify(customData)); saveCardToDB(Object.assign({}, customData[idx], { title: newText.trim() }), false); }
} else {
if (confirm("Вы редактируете основную карточку. Изменения будут видны у всех пользователей. Сохранить?")) {
var emoji = card.querySelector('.emoji') ? card.querySelector('.emoji').innerText : '📁';
var groups = loadGroups(cardId, []);
saveCardToDB({ id: cardId, title: newText.trim(), emoji, groups, position: Array.from(document.querySelectorAll('.card')).indexOf(card) * 10 }, true);
}
}
renderBottomMenu();
}
}
function deleteCardHandler(e) {
e.stopPropagation();
var cardId = this.getAttribute('data-card-delete');
var isCustom = cardId.startsWith('custom_');
if (isCustom ? confirm('Удалить эту карточку?') : confirm("Вы удаляете ОСНОВНУЮ карточку. Она исчезнет у ВСЕХ пользователей. Удалить?")) {
this.closest('.card').remove();
var customData = JSON.parse(localStorage.getItem(CARD_GROUPS_STORAGE) || '[]');
localStorage.setItem(CARD_GROUPS_STORAGE, JSON.stringify(customData.filter(c => c.id !== cardId)));
localStorage.removeItem(STORAGE_PREFIX + cardId);
deleteCardFromDB(cardId, !isCustom);
saveCardOrder(); applyVisibilityAndUpdateUI(); renderBottomMenu();
}
}

// ========== ADD NEW CARD ==========
function addNewCard() {
var newTitle = prompt('Название карточки', 'Новая карточка');
if (!newTitle || newTitle.trim() === '') return;
var newEmoji = prompt('Эмодзи', '📁');
if (newEmoji === null) return;
var finalEmoji = newEmoji.trim() || '📁';
if (isAdmin) {
showCardTypeModal(function(selectedType) {
if (selectedType === null) return;
var newGroups = [{ category: "Моя группа", links: [{ name: "Пример ссылки", url: "https://", iconSrc: "🔗" }] }];
var newId, isMain;
if (selectedType === 'user') { newId = 'custom_' + Date.now(); isMain = false; customCards.push({ id: newId, title: newTitle.trim(), emoji: finalEmoji, groups: newGroups }); localStorage.setItem(CARD_GROUPS_STORAGE, JSON.stringify(customCards)); saveGroups(newId, newGroups); }
else { newId = generateMainCardId(newTitle); isMain = true; }
saveCardToDB({ id: newId, title: newTitle.trim(), emoji: finalEmoji, groups: newGroups, position: 9999 }, isMain);
loadSavedCards(); applyVisibilityAndUpdateUI(); renderBottomMenu();
});
} else {
var newId = 'custom_' + Date.now();
var newGroups = [{ category: "Моя группа", links: [{ name: "Пример ссылки", url: "https://", iconSrc: "🔗" }] }];
customCards.push({ id: newId, title: newTitle.trim(), emoji: finalEmoji, groups: newGroups });
localStorage.setItem(CARD_GROUPS_STORAGE, JSON.stringify(customCards)); saveGroups(newId, newGroups);
saveCardToDB({ id: newId, title: newTitle.trim(), emoji: finalEmoji, groups: newGroups, position: customCards.length * 10 }, false);
loadSavedCards(); applyVisibilityAndUpdateUI(); renderBottomMenu();
}
}
document.getElementById('addNewCardBtn')?.addEventListener('click', addNewCard);

// ========== GREETING & DATE ==========
function updateGreetingAndDate() {
var now = new Date();
var hour = now.getHours();
var greeting = hour >= 5 && hour < 12 ? '☕ Доброе утро' : hour >= 12 && hour < 18 ? '☀️ Добрый день' : hour >= 18 && hour < 23 ? '🌙 Добрый вечер' : '😴 Доброй ночи';
var greetEl = document.getElementById('greetingText'); if (greetEl) greetEl.innerText = greeting;
var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
var formattedDate = now.toLocaleDateString('ru-RU', options);
var dateEl = document.getElementById('liveDate'); if (dateEl) dateEl.innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}
setInterval(updateGreetingAndDate, 60000);
var professions = ["менеджер","работяга","труженик","сотрудник","дизайнер","печатник","сборщик","верстальщик","препресс","фасовщик","упаковщик","манагер","типограф","сувенирщик","фрезеровщик","брошюровщик","резчик","авитолог","клипмейкер","СММщик","логист","курьер","экспедитор","расчётчик","рекламщик","конструктор","лекальщик","продажник","офсетчик","полиграфист","художник","АХОшник","продаван","работник","закупщик","оператор","аккаунт","коллега","товарищ","фотограф","профессионал","продавец","маркетолог","трудяра","лазерщик","термопечатник","плоттерщик","передовик","администратор","мастер"];
var adjectives = ["яростный","примерный","дружелюбный","занятой","уставший","нервный","улыбчивый","осторожный","отважный","помятый","адекватный","неадекватный","хохочущий","прилежный","застенчивый","продуктивный","отчаянный","креативный","вдохновленный","сонный","бодрый","сосредоточенный","рассеянный","идейный","технаристый","деликатный","отмороженный","суровый","приятный","упакованный","понятливый","игривый","задорный","прошаренный","закалённый","подлеченный","беспристрастный","скиловый","свободный","раскрепощённый","умелый","грозный","прирождённый","работящий","уверенный","находчивый","боевой","раздосадованный","раздраженный","упрямый","мудрый","весёлый","энергичный","спокойный","вдумчивый","быстрый","методичный","безбашенный","продвинутый","озорной"];
function getRandomNickname() { 
    return adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' + professions[Math.floor(Math.random() * professions.length)]; }
// ========== YANDEX MODAL ==========
function showYandexModal() { document.getElementById('yandexModal').classList.add('active'); }
function closeYandexModal() { document.getElementById('yandexModal').classList.remove('active'); }
document.getElementById('modalCloseBtn')?.addEventListener('click', closeYandexModal);
document.getElementById('yandexModal')?.addEventListener('click', function(e) { if(e.target === document.getElementById('yandexModal')) closeYandexModal(); });

// ========== VISIBILITY & BOTTOM MENU ==========
var VISIBILITY_KEY = 'dashboard_hidden_cards';
function getHiddenSet() { var stored = localStorage.getItem(VISIBILITY_KEY); if(stored) { try { var arr = JSON.parse(stored); if(Array.isArray(arr)) return new Set(arr); } catch(e){} } return new Set(); }
function saveHiddenSet(set) { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(Array.from(set))); syncUserSettings(); }
function applyVisibilityAndUpdateUI() { var hiddenSet = getHiddenSet(); document.querySelectorAll('.card').forEach(card => { var id = card.getAttribute('data-card-id'); if(id && hiddenSet.has(id)) card.classList.add('hidden-card'); else card.classList.remove('hidden-card'); }); updateChipsActiveState(hiddenSet); }
function updateChipsActiveState(hiddenSet) { var container = document.getElementById('dynamicChipsContainer'); if(!container) return; var chips = container.querySelectorAll('.toggle-chip'); chips.forEach(chip => { var cardId = chip.getAttribute('data-card-id'); if(cardId) { if(hiddenSet.has(cardId)) chip.classList.remove('active-chip'); else chip.classList.add('active-chip'); } }); }
function toggleCard(cardId) { var hiddenSet = getHiddenSet(); if(hiddenSet.has(cardId)) hiddenSet.delete(cardId); else hiddenSet.add(cardId); saveHiddenSet(hiddenSet); applyVisibilityAndUpdateUI(); }
function showAllCards() { saveHiddenSet(new Set()); applyVisibilityAndUpdateUI(); }
function renderBottomMenu() {
var container = document.getElementById('dynamicChipsContainer'); if(!container) return;
container.innerHTML = '';
var allCards = Array.from(document.querySelectorAll('.card')).map(c => c.getAttribute('data-card-id'));
var hiddenSet = getHiddenSet();
allCards.forEach(function(cardId) {
if(!cardId) return;
var card = document.querySelector('.card[data-card-id="' + cardId + '"]'); if (!card) return;
var emoji = card.querySelector('.card-header .emoji') ? card.querySelector('.card-header .emoji').innerText : '📄';
var title = card.querySelector('.card-header h2') ? card.querySelector('.card-header h2').innerText : cardId;
var isVisible = !hiddenSet.has(cardId);
var chip = document.createElement('div'); chip.className = 'toggle-chip ' + (isVisible ? 'active-chip' : ''); chip.setAttribute('data-card-id', cardId);
chip.innerHTML = '<span class="chip-emoji">' + emoji + '</span><span class="chip-text">' + title.substring(0,20) + '</span>';
chip.addEventListener('click', function(e) { e.stopPropagation(); toggleCard(cardId); });
container.appendChild(chip);
});
}

// ========== START ==========
initSupabase();
document.getElementById('globalResetBtn')?.addEventListener('click', showAllCards);
})();
