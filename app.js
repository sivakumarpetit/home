import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB-2jQpNIOtTjX47aOZExkCCY1mir9axA4",
  authDomain: "home-dashboard-fb38a.firebaseapp.com",
  projectId: "home-dashboard-fb38a",
  storageBucket: "home-dashboard-fb38a.firebasestorage.app",
  messagingSenderId: "1093394313648",
  appId: "1:1093394313648:web:96b52896bc14dbaf8d6675"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const stateRef = doc(db, "family-dashboard", "shared-state");

const DASHBOARD_PIN = "258963"; 

const DEFAULT_TEMPLATES = [
  "🧺 Laundry", "🍳 Cooking", "🗑️ Trash Pickup", "🛒 Grocery Run", 
  "🧽 Clean Kitchen", "🪴 Water Plants", "🍽️ Dishwasher", 
  "📦 Mail/Packages", "🧹 Vacuum", "🌿 Lawn Care"
];

const LIFT_OPTIONS = ["Squat", "Deadlift", "Bench Press", "Overhead Press"];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

let state = {
  tasks: [],
  templates: [...DEFAULT_TEMPLATES],
  storeOrder: ['Grocery','Costco','Indian','Amazon','Walmart'],
  shopping: { Grocery: [], Costco: [], Indian: [], Amazon: [], Walmart: [] },
  meals: {},
  workouts: {}
};
const mealTypes = ['breakfast','lunch','dinner'];
let currentTaskFilter = 'all';

// WORKOUT CALENDAR NAV & SELECTION STATE
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth(); // 0-indexed
let activeSelectedIsoDate = getIsoDateKey(0); // Default to today

let saveTimer = null;
let remoteVersion = null;
let pendingRemoteData = null;

function checkPinAuth(){
  const savedPin = localStorage.getItem('dash_pin_auth');
  const overlay = document.getElementById('pin-overlay');
  if(savedPin === DASHBOARD_PIN){
    overlay.style.display = 'none';
    loadState();
  } else {
    overlay.style.display = 'flex';
  }
}

function verifyPin(){
  const input = document.getElementById('pin-input');
  const errEl = document.getElementById('pin-error');
  const val = input.value.trim();

  if(val === DASHBOARD_PIN){
    localStorage.setItem('dash_pin_auth', val);
    document.getElementById('pin-overlay').style.display = 'none';
    errEl.innerText = '';
    loadState();
  } else {
    errEl.innerText = 'Incorrect PIN. Please try again.';
    input.value = '';
    input.focus();
  }
}

function lockDashboard(){
  localStorage.removeItem('dash_pin_auth');
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').innerText = '';
  document.getElementById('pin-overlay').style.display = 'flex';
}

function setSyncStatus(text){
  const el = document.getElementById('sync-status');
  if(el) el.innerText = text;
}
function isEditingSomething(){
  const el = document.activeElement;
  if(!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.isContentEditable;
}

function sanitizeData(data){
  const cleanTasks = (data.tasks || []).map(t => ({
    id: t.id || (Date.now() + Math.random()),
    text: t.text || 'Untitled Task',
    column: t.column || 'today',
    assignee: t.assignee || '',
    completed: Boolean(t.completed),
    completedDate: t.completedDate || null
  }));

  const cleanWorkouts = {};
  if(data.workouts && typeof data.workouts === 'object'){
    Object.keys(data.workouts).forEach(dateKey => {
      const item = data.workouts[dateKey] || {};
      cleanWorkouts[dateKey] = {
        type: ['running','strength','rest'].includes(item.type) ? item.type : null,
        mileage: typeof item.mileage === 'number' ? item.mileage : (parseFloat(item.mileage) || null),
        lifts: Array.isArray(item.lifts) ? item.lifts.filter(l => LIFT_OPTIONS.includes(l)) : []
      };
    });
  }

  return {
    tasks: cleanTasks,
    templates: Array.isArray(data.templates) && data.templates.length ? data.templates : [...DEFAULT_TEMPLATES],
    storeOrder: Array.isArray(data.storeOrder) && data.storeOrder.length ? data.storeOrder : ['Grocery','Costco','Indian','Amazon','Walmart'],
    shopping: data.shopping || { Grocery: [], Costco: [], Indian: [], Amazon: [], Walmart: [] },
    meals: data.meals || {},
    workouts: cleanWorkouts
  };
}

function applyRemoteData(data){
  state = sanitizeData(data);
  remoteVersion = JSON.stringify(data);
  renderAll();
  setSyncStatus('updated ' + new Date().toLocaleTimeString());
}

function loadState(){
  setSyncStatus('connecting…');
  onSnapshot(stateRef, (snap)=>{
    if(!snap.exists()){
      setSyncStatus('ready — add something to get started');
      renderAll();
      return;
    }
    const data = snap.data();
    const json = JSON.stringify(data);
    if(json === remoteVersion) return;
    if(isEditingSomething()){
      pendingRemoteData = data;
      return;
    }
    applyRemoteData(data);
  }, (err)=>{
    console.error(err);
    setSyncStatus('connection error — check console');
  });
}

document.addEventListener('focusout', ()=>{
  setTimeout(()=>{
    if(pendingRemoteData && !isEditingSomething()){
      applyRemoteData(pendingRemoteData);
      pendingRemoteData = null;
    }
  }, 50);
});

function scheduleSave(){
  clearTimeout(saveTimer);
  setSyncStatus('saving…');
  saveTimer = setTimeout(saveToFirestore, 500);
}
async function saveToFirestore(){
  try{
    await setDoc(stateRef, state);
    remoteVersion = JSON.stringify(state);
    setSyncStatus('synced ' + new Date().toLocaleTimeString());
  } catch(e){
    console.error(e);
    setSyncStatus('save failed — retrying…');
    saveTimer = setTimeout(saveToFirestore, 3000);
  }
}

function switchTab(tabId){
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('section-'+tabId).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tab-'+tabId).classList.add('active');
}

function getIsoDateKey(offsetDays = 0){
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateStr){
  const [year, month, day] = dateStr.split('-');
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function initArchiveVisibility(){
  const isCollapsed = localStorage.getItem('archive_collapsed') === 'true';
  const content = document.getElementById('archive-content');
  const btn = document.getElementById('archive-toggle-btn');
  if(isCollapsed){
    content.classList.add('collapsed');
    btn.innerText = '► Show';
  } else {
    content.classList.remove('collapsed');
    btn.innerText = '▼ Hide';
  }
}

function toggleArchiveVisibility(){
  const content = document.getElementById('archive-content');
  const btn = document.getElementById('archive-toggle-btn');
  const isNowCollapsed = content.classList.toggle('collapsed');
  btn.innerText = isNowCollapsed ? '► Show' : '▼ Hide';
  localStorage.setItem('archive_collapsed', isNowCollapsed);
}

// --- MASTER FILTER & TEMPLATES ---
function setTaskFilter(filter){
  currentTaskFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('filter-' + filter.toLowerCase());
  if(activeBtn) activeBtn.classList.add('active');
  renderTasks();
}

function renderTemplates(){
  const container = document.getElementById('template-pills');
  if(!container) return;
  container.innerHTML = '';

  (state.templates || DEFAULT_TEMPLATES).forEach((text, index) => {
    const pill = document.createElement('div');
    pill.className = 'template-pill';
    pill.innerHTML = `
      <span class="pill-text">${escapeHtml(text)}</span>
      <button type="button" class="del-pill" title="Remove Template" onclick="event.stopPropagation(); removeTemplate(${index})">✕</button>
    `;
    pill.onclick = () => addQuickTemplateTask(text);
    container.appendChild(pill);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'add-pill-btn';
  addBtn.innerText = '+ Custom';
  addBtn.onclick = promptAddTemplate;
  container.appendChild(addBtn);
}

function promptAddTemplate(){
  const text = prompt('Enter a new recurring quick-add template:');
  if(!text || !text.trim()) return;
  if(!state.templates) state.templates = [];
  state.templates.push(text.trim());
  renderTemplates();
  scheduleSave();
}

function removeTemplate(index){
  if(!state.templates) return;
  state.templates.splice(index, 1);
  renderTemplates();
  scheduleSave();
}

function addQuickTemplateTask(text){
  state.tasks.push({
    id: Date.now() + Math.random(),
    text,
    column: 'today',
    assignee: '',
    completed: false,
    completedDate: null
  });
  renderTasks();
  scheduleSave();
}

// --- TASKS ---
function addTask(){
  const textInput = document.getElementById('task-input');
  const colSelect = document.getElementById('task-column');
  const assignSelect = document.getElementById('task-assignee');
  const text = textInput.value.trim();
  if(!text) return;

  state.tasks.push({ 
    id: Date.now() + Math.random(), 
    text, 
    column: colSelect.value,
    assignee: assignSelect.value,
    completed: false,
    completedDate: null
  });
  textInput.value = '';
  textInput.focus();
  renderTasks();
  scheduleSave();
}

function updateTaskText(id, newTextRaw){
  const newText = newTextRaw.trim();
  state.tasks = state.tasks.map(t => {
    if(t.id === id) return { ...t, text: newText || t.text };
    return t;
  });
  renderTasks();
  scheduleSave();
}

function cycleAssignee(id){
  const assignees = ['', 'Siva', 'Priya'];
  state.tasks = state.tasks.map(t => {
    if(t.id === id){
      const currIdx = assignees.indexOf(t.assignee || '');
      const nextIdx = (currIdx + 1) % assignees.length;
      return { ...t, assignee: assignees[nextIdx] };
    }
    return t;
  });
  renderTasks();
  scheduleSave();
}

function toggleTask(id){
  state.tasks = state.tasks.map(t => {
    if(t.id === id) {
      const isNowDone = !t.completed;
      return {
        ...t,
        completed: isNowDone,
        completedDate: isNowDone ? getIsoDateKey(0) : null
      };
    }
    return t;
  });
  renderTasks();
  scheduleSave();
}

function deleteTask(id){
  state.tasks = state.tasks.filter(t => t.id!==id);
  renderTasks();
  scheduleSave();
}

function moveTask(id, newColumn, beforeId){
  const idx = state.tasks.findIndex(t=>t.id===id);
  if(idx===-1) return;
  const [task] = state.tasks.splice(idx,1);
  task.column = newColumn;
  if(beforeId!=null){
    const beforeIdx = state.tasks.findIndex(t=>t.id===beforeId);
    if(beforeIdx!==-1){ state.tasks.splice(beforeIdx,0,task); return; }
  }
  state.tasks.push(task);
}

function renderTasks(){
  let activeTasks = state.tasks.filter(t => !t.completed);

  if(currentTaskFilter === 'Siva') activeTasks = activeTasks.filter(t => t.assignee === 'Siva');
  else if(currentTaskFilter === 'Priya') activeTasks = activeTasks.filter(t => t.assignee === 'Priya');
  else if(currentTaskFilter === 'none') activeTasks = activeTasks.filter(t => !t.assignee);

  ['today','week','someday'].forEach(col=>{
    const listEl = document.getElementById('list-'+col);
    const countEl = document.getElementById('count-'+col);
    const filtered = activeTasks.filter(t=>t.column===col);
    countEl.innerText = filtered.length;
    listEl.innerHTML = '';
    filtered.forEach(task=>{
      const li = document.createElement('li');
      const assigneeClass = task.assignee ? ` assignee-${task.assignee.toLowerCase()}` : '';
      li.className = 'task-item' + assigneeClass;
      li.dataset.id = task.id;

      const chipLabel = task.assignee || '+ Assign';
      const chipClass = task.assignee ? task.assignee.toLowerCase() : '';

      li.innerHTML = `
        <span class="drag-handle">⠿⠿</span>
        <div class="task-checkbox-wrap">
          <input type="checkbox" onchange="toggleTask(${task.id})">
        </div>
        <span class="task-text-edit" contenteditable="true" spellcheck="false"
          onblur="updateTaskText(${task.id}, this.innerText)"
          onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${escapeHtml(task.text)}</span>
        <button type="button" class="assignee-chip ${chipClass}" onclick="cycleAssignee(${task.id})">${chipLabel}</button>
        <button type="button" onclick="deleteTask(${task.id})">✕</button>
      `;

      listEl.appendChild(li);
      const handle = li.querySelector('.drag-handle');
      handle.addEventListener('pointerdown', (e)=>startDrag(e, task.id, li));
    });
  });

  renderArchive();
}

function renderArchive(){
  const archiveContainer = document.getElementById('archive-list-container');
  const archiveCountEl = document.getElementById('count-archive');
  archiveContainer.innerHTML = '';

  const completedTasks = state.tasks.filter(t => t.completed);
  archiveCountEl.innerText = completedTasks.length;

  if(completedTasks.length === 0){
    archiveContainer.innerHTML = '<p style="color:var(--muted);font-size:13px;font-style:italic;margin:0;">No completed tasks archived yet.</p>';
    return;
  }

  const groups = {};
  completedTasks.forEach(task => {
    const dateKey = task.completedDate || 'Earlier';
    if(!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(task);
  });

  const sortedDates = Object.keys(groups).sort().reverse();

  sortedDates.forEach(dateKey => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'archive-group';

    const dateHead = document.createElement('div');
    dateHead.className = 'archive-date-head';
    dateHead.innerText = dateKey === 'Earlier' ? 'Earlier' : formatDateLabel(dateKey);
    groupDiv.appendChild(dateHead);

    const ul = document.createElement('ul');
    ul.className = 'task-list';

    groups[dateKey].forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item done';
      li.dataset.id = task.id;
      const chipLabel = task.assignee || 'Unassigned';
      const chipClass = task.assignee ? task.assignee.toLowerCase() : '';
      li.innerHTML = `
        <div class="task-checkbox-wrap">
          <input type="checkbox" checked onchange="toggleTask(${task.id})">
        </div>
        <span style="flex:1;">${escapeHtml(task.text)}</span>
        <span class="assignee-chip ${chipClass}">${chipLabel}</span>
        <button type="button" onclick="deleteTask(${task.id})">✕</button>
      `;
      ul.appendChild(li);
    });

    groupDiv.appendChild(ul);
    archiveContainer.appendChild(groupDiv);
  });
}

// --- Drag & Drop ---
let dragState = null;

function startDrag(e, taskId, li){
  e.preventDefault();
  const rect = li.getBoundingClientRect();
  const ghost = li.cloneNode(true);
  ghost.classList.add('ghost-card');
  ghost.style.width = rect.width + 'px';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  document.body.appendChild(ghost);
  li.classList.add('dragging');

  dragState = {
    taskId, li, ghost,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    lastCol: null
  };

  const handle = e.target;
  handle.setPointerCapture(e.pointerId);
  handle.addEventListener('pointermove', onDragMove);
  handle.addEventListener('pointerup', onDragEnd);
  handle.addEventListener('pointercancel', onDragEnd);
}

function onDragMove(e){
  if(!dragState) return;
  const { ghost, offsetX, offsetY } = dragState;
  ghost.style.left = (e.clientX - offsetX) + 'px';
  ghost.style.top = (e.clientY - offsetY) + 'px';

  ghost.style.display = 'none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  ghost.style.display = '';

  document.querySelectorAll('.task-col').forEach(c=>c.classList.remove('drop-hover'));
  const col = under ? under.closest('.task-col') : null;
  if(col){
    col.classList.add('drop-hover');
    dragState.lastCol = col.dataset.column;
  }
}

function onDragEnd(e){
  if(!dragState) return;
  const { taskId, li, ghost } = dragState;
  const handle = e.target;
  handle.removeEventListener('pointermove', onDragMove);
  handle.removeEventListener('pointerup', onDragEnd);
  handle.removeEventListener('pointercancel', onDragEnd);

  document.querySelectorAll('.task-col').forEach(c=>c.classList.remove('drop-hover'));
  ghost.remove();
  li.classList.remove('dragging');

  if(dragState.lastCol){
    ghost.style.display = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const targetLi = under ? under.closest('.task-item') : null;
    const beforeId = (targetLi && Number(targetLi.dataset.id) !== taskId) ? Number(targetLi.dataset.id) : null;
    moveTask(taskId, dragState.lastCol, beforeId);
  }
  dragState = null;
  renderTasks();
  scheduleSave();
}

// --- SHOPPING ---
function addStore(){
  const input = document.getElementById('new-store-input');
  const name = input.value.trim();
  if(!name) return;
  if(state.storeOrder.includes(name)){
    input.value = '';
    return;
  }
  state.storeOrder.push(name);
  state.shopping[name] = [];
  input.value = '';
  renderShopping();
  scheduleSave();
}
function removeStore(name){
  state.storeOrder = state.storeOrder.filter(s => s!==name);
  delete state.shopping[name];
  renderShopping();
  scheduleSave();
}
function renameStore(oldName, newNameRaw){
  const newName = newNameRaw.trim();
  if(!newName || newName === oldName) { renderShopping(); return; }
  if(state.storeOrder.includes(newName)){
    state.shopping[newName] = [...(state.shopping[newName]||[]), ...(state.shopping[oldName]||[])];
    state.storeOrder = state.storeOrder.filter(s=>s!==oldName);
    delete state.shopping[oldName];
  } else {
    const idx = state.storeOrder.indexOf(oldName);
    if(idx!==-1) state.storeOrder[idx] = newName;
    state.shopping[newName] = state.shopping[oldName] || [];
    if(newName!==oldName) delete state.shopping[oldName];
  }
  renderShopping();
  scheduleSave();
}

function addShoppingItem(store, inputEl){
  const text = inputEl.value.trim();
  if(!text) return;

  const itemsToAdd = text.split(',').map(s => s.trim()).filter(Boolean);
  itemsToAdd.forEach(itemText => {
    state.shopping[store].push({ id: Date.now() + Math.random(), text: itemText, checked: false });
  });

  renderShopping();
  scheduleSave();

  const newCardInput = document.querySelector(`[data-store-input="${store}"]`);
  if(newCardInput){
    newCardInput.value = '';
    newCardInput.focus();
  }
}

function toggleShoppingItem(store, id){
  state.shopping[store] = state.shopping[store].map(it => it.id===id ? {...it, checked:!it.checked} : it);
  renderShopping();
  scheduleSave();
}
function clearCheckedShopping(store){
  state.shopping[store] = state.shopping[store].filter(it=>!it.checked);
  renderShopping();
  scheduleSave();
}
function renderShopping(){
  const grid = document.getElementById('shopping-grid');
  grid.innerHTML = '';
  state.storeOrder.forEach(store=>{
    const card = document.createElement('div');
    card.className = 'shop-card';
    const items = state.shopping[store] || [];
    let itemsHtml = items.map(item=>`
      <li class="shop-item ${item.checked?'checked':''}">
        <label onclick="toggleShoppingItem('${store}', ${item.id})">
          <input type="checkbox" ${item.checked?'checked':''} onclick="event.stopPropagation(); toggleShoppingItem('${store}', ${item.id})">
          ${escapeHtml(item.text)}
        </label>
      </li>
    `).join('');
    card.innerHTML = `
      <div class="shop-card-head">
        <span class="store-name" contenteditable="true" spellcheck="false"
          onblur="renameStore('${store}', this.innerText)"
          onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">${escapeHtml(store)}</span>
        <button class="remove-store-btn" title="Remove store" onclick="removeStore('${store}')">✕</button>
      </div>
      <ul>${itemsHtml}</ul>
      ${items.some(i=>i.checked) ? `<button class="clear-btn" onclick="clearCheckedShopping('${store}')">🧹 Clear checked</button>` : ''}
      <div class="shop-add">
        <input type="text" data-store-input="${store}" placeholder="Add item(s), e.g. Milk, Eggs…" onkeydown="if(event.key==='Enter'){addShoppingItem('${store}', this);}">
        <button type="button" onclick="addShoppingItem('${store}', this.previousElementSibling)">Add</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// --- MEALS ---
function updateMeal(dateKey, type, value){
  if(!state.meals[dateKey]) state.meals[dateKey] = { breakfast:'', lunch:'', dinner:'' };
  state.meals[dateKey][type] = value;
  scheduleSave();
}

function renderMeals(){
  const tbody = document.getElementById('meal-table-body');
  tbody.innerHTML = '';

  for(let i = 0; i < 7; i++){
    const dateKey = getIsoDateKey(i);
    const labelText = i === 0 ? `Today (${formatDateLabel(dateKey)})` : formatDateLabel(dateKey);
    
    if(!state.meals[dateKey]){
      state.meals[dateKey] = { breakfast:'', lunch:'', dinner:'' };
    }

    const row = document.createElement('tr');
    let rowHtml = `<td>${labelText}</td>`;
    mealTypes.forEach(type=>{
      const val = state.meals[dateKey][type] || '';
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      rowHtml += `<td data-label="${label}"><input type="text" value="${escapeHtml(val)}" oninput="updateMeal('${dateKey}','${type}', this.value)"></td>`;
    });
    row.innerHTML = rowHtml;
    tbody.appendChild(row);
  }
}

// --- WORKOUTS ENGINE ---
function getWorkout(dateKey){
  return state.workouts[dateKey] || { type: null, mileage: null, lifts: [] };
}

function setWorkoutType(dateKey, type){
  const curr = getWorkout(dateKey);
  if(curr.type === type) return;
  state.workouts[dateKey] = {
    ...curr,
    type: type
  };
  renderWorkouts();
  scheduleSave();
}

function setWorkoutMileage(dateKey, mileageVal){
  const curr = getWorkout(dateKey);
  const num = parseFloat(mileageVal);
  state.workouts[dateKey] = {
    ...curr,
    mileage: !isNaN(num) && num >= 0 ? num : null
  };
  renderWorkoutsStatsOnly();
  scheduleSave();
}

function toggleWorkoutLift(dateKey, liftName){
  const curr = getWorkout(dateKey);
  const currentLifts = curr.lifts || [];
  const exists = currentLifts.includes(liftName);
  const nextLifts = exists 
    ? currentLifts.filter(l => l !== liftName)
    : [...currentLifts, liftName];

  state.workouts[dateKey] = {
    ...curr,
    lifts: nextLifts
  };
  renderWorkoutsStatsOnly();
  scheduleSave();
}

function selectCalendarDate(isoDateKey){
  activeSelectedIsoDate = isoDateKey;
  renderWorkouts();
}

function changeMonth(delta){
  viewMonth += delta;
  if(viewMonth < 0){
    viewMonth = 11;
    viewYear--;
  } else if(viewMonth > 11){
    viewMonth = 0;
    viewYear++;
  }
  renderWorkoutCalendar();
}

function renderWorkoutsStatsOnly(){
  renderWorkoutStats();
  renderWorkoutCalendar();
}

function renderWorkoutStats(){
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentQuarter = Math.floor(currentMonth / 3);

  // Total days in targets
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Calculate total days in current quarter
  const qStartMonth = currentQuarter * 3;
  const daysInCurrentQuarter = new Date(currentYear, qStartMonth + 3, 0).getDate() 
    + new Date(currentYear, qStartMonth + 2, 0).getDate() 
    + new Date(currentYear, qStartMonth + 1, 0).getDate();

  const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
  const daysInCurrentYear = isLeapYear ? 366 : 365;

  let thisWeekCount = 0;
  let thisMonthCount = 0;
  let thisQuarterCount = 0;
  let thisYearCount = 0;
  let totalMiles = 0;
  const liftCounts = { "Squat": 0, "Deadlift": 0, "Bench Press": 0, "Overhead Press": 0 };

  // Calculate Last 7 Days (This Week)
  for(let i = 0; i >= -6; i--){
    const k = getIsoDateKey(i);
    const w = getWorkout(k);
    if(w.type === 'running' || w.type === 'strength'){
      thisWeekCount++;
    }
  }

  Object.keys(state.workouts).forEach(dateStr => {
    const w = state.workouts[dateStr];
    if(!w) return;

    const [yStr, mStr] = dateStr.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1; // 0-indexed
    const q = Math.floor(m / 3);

    const isRealWorkout = w.type === 'running' || w.type === 'strength';

    if(isRealWorkout){
      if(y === currentYear) {
        thisYearCount++;
        if(q === currentQuarter) {
          thisQuarterCount++;
          if(m === currentMonth) {
            thisMonthCount++;
          }
        }
      }
    }

    if(w.type === 'running' && typeof w.mileage === 'number' && !isNaN(w.mileage)){
      totalMiles += w.mileage;
    }

    if(w.type === 'strength' && Array.isArray(w.lifts)){
      w.lifts.forEach(l => {
        if(liftCounts[l] !== undefined) liftCounts[l]++;
      });
    }
  });

  // Determine Top Lift
  let topLift = '—';
  let maxLiftCount = 0;
  Object.keys(liftCounts).forEach(l => {
    if(liftCounts[l] > maxLiftCount){
      maxLiftCount = liftCounts[l];
      topLift = l;
    }
  });

  document.getElementById('stat-week').innerText = `${thisWeekCount}/7`;
  document.getElementById('stat-month').innerText = `${thisMonthCount}/${daysInCurrentMonth}`;
  document.getElementById('stat-month-lbl').innerText = `${monthNames[currentMonth]}`;
  document.getElementById('stat-quarter').innerText = `${thisQuarterCount}/${daysInCurrentQuarter}`;
  document.getElementById('stat-year').innerText = `${thisYearCount}/${daysInCurrentYear}`;
  document.getElementById('stat-miles').innerText = totalMiles.toFixed(1);
  document.getElementById('stat-toplift').innerText = topLift;
}

function renderWorkoutCalendar(){
  const gridEl = document.getElementById('calendar-days-grid');
  const titleEl = document.getElementById('calendar-month-title');
  if(!gridEl) return;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  titleEl.innerText = `${monthNames[viewMonth]} ${viewYear}`;

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayIso = getIsoDateKey(0);

  gridEl.innerHTML = '';

  // Leading blank cells
  for(let i = 0; i < startWeekday; i++){
    const blank = document.createElement('div');
    blank.className = 'cal-cell empty';
    gridEl.appendChild(blank);
  }

  // Month day cells
  for(let day = 1; day <= daysInMonth; day++){
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateKey = `${viewYear}-${mStr}-${dStr}`;
    const w = getWorkout(dateKey);

    const dateObj = new Date(viewYear, viewMonth, day);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const cell = document.createElement('div');
    let typeClass = '';
    if(w.type === 'running') typeClass = ' type-running';
    else if(w.type === 'strength') typeClass = ' type-strength';
    else if(w.type === 'rest') typeClass = ' type-rest';

    const isWeekendClass = isWeekend ? ' is-weekend' : '';
    const isTodayClass = dateKey === todayIso ? ' is-today' : '';
    const isSelectedClass = dateKey === activeSelectedIsoDate ? ' is-selected' : '';

    cell.className = 'cal-cell' + isWeekendClass + typeClass + isTodayClass + isSelectedClass;
    cell.innerText = day;
    cell.onclick = () => selectCalendarDate(dateKey);

    // Build Hover/Long-press Tooltip Detail
    if(w.type === 'running'){
      const mi = w.mileage ? `${w.mileage} mi` : 'Run';
      cell.title = `${formatDateLabel(dateKey)}: Running (${mi})`;
    } else if(w.type === 'strength'){
      const liftsStr = w.lifts && w.lifts.length ? w.lifts.join(', ') : 'No lifts selected';
      cell.title = `${formatDateLabel(dateKey)}: Strength (${liftsStr})`;
    } else if(w.type === 'rest'){
      cell.title = `${formatDateLabel(dateKey)}: Rest Day`;
    } else {
      cell.title = formatDateLabel(dateKey);
    }

    gridEl.appendChild(cell);
  }
}

function renderDayCard(dateKey){
  const w = getWorkout(dateKey);
  const todayIso = getIsoDateKey(0);
  const isToday = dateKey === todayIso;

  const card = document.createElement('div');
  card.className = `day-card ${isToday ? 'card-today' : ''}`;

  const dateLabelText = isToday ? `Today (${formatDateLabel(dateKey)})` : formatDateLabel(dateKey);
  const todayBadgeHtml = isToday ? `<span class="today-badge">Today</span>` : '';

  let contentHtml = '';
  if(w.type === 'running'){
    const milesVal = typeof w.mileage === 'number' ? w.mileage : '';
    contentHtml = `
      <div class="workout-input-panel">
        <div class="running-input-wrap">
          <input type="number" step="0.1" min="0" placeholder="Miles" value="${milesVal}"
            oninput="setWorkoutMileage('${dateKey}', this.value)">
          <span class="running-unit">miles</span>
        </div>
      </div>
    `;
  } else if(w.type === 'strength'){
    const selectedLifts = w.lifts || [];
    const chipsHtml = LIFT_OPTIONS.map(lift => {
      const isSel = selectedLifts.includes(lift);
      return `
        <button type="button" class="lift-chip ${isSel ? 'selected' : ''}"
          onclick="toggleWorkoutLift('${dateKey}', '${lift}')">
          ${isSel ? '✓ ' : ''}${lift}
        </button>
      `;
    }).join('');

    contentHtml = `
      <div class="workout-input-panel">
        <div class="lift-chips-grid">
          ${chipsHtml}
        </div>
      </div>
    `;
  } else if(w.type === 'rest'){
    contentHtml = `
      <div class="workout-input-panel">
        <div class="rest-note">😴 Resting on this day.</div>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="day-card-head">
      <div class="day-card-date">
        📅 ${dateLabelText} ${todayBadgeHtml}
      </div>
    </div>
    <div class="segmented-picker">
      <button type="button" class="seg-btn seg-running ${w.type === 'running' ? 'active' : ''}"
        onclick="setWorkoutType('${dateKey}', 'running')">🏃 Run</button>
      <button type="button" class="seg-btn seg-strength ${w.type === 'strength' ? 'active' : ''}"
        onclick="setWorkoutType('${dateKey}', 'strength')">🏋️ Strength</button>
      <button type="button" class="seg-btn seg-rest ${w.type === 'rest' ? 'active' : ''}"
        onclick="setWorkoutType('${dateKey}', 'rest')">😴 Rest</button>
    </div>
    ${contentHtml}
  `;

  return card;
}

function renderWorkouts(){
  renderWorkoutStats();
  renderWorkoutCalendar();

  const activeContainer = document.getElementById('workout-active-day-container');
  if(activeContainer){
    activeContainer.innerHTML = '';
    activeContainer.appendChild(renderDayCard(activeSelectedIsoDate));
  }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

function renderAll(){
  renderTasks();
  renderShopping();
  renderMeals();
  renderTemplates();
  renderWorkouts();
  initArchiveVisibility();
}

checkPinAuth();

Object.assign(window, {
  switchTab, addTask, updateTaskText, toggleTask, deleteTask, setTaskFilter, addQuickTemplateTask, cycleAssignee,
  promptAddTemplate, removeTemplate,
  addStore, removeStore, renameStore,
  addShoppingItem, toggleShoppingItem, clearCheckedShopping,
  updateMeal, toggleArchiveVisibility, verifyPin, lockDashboard,
  setWorkoutType, setWorkoutMileage, toggleWorkoutLift, selectCalendarDate, changeMonth
});