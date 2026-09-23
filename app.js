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

let state = {
  tasks: [],
  storeOrder: ['Grocery','Costco','Indian','Amazon','Walmart'],
  shopping: { Grocery: [], Costco: [], Indian: [], Amazon: [], Walmart: [] },
  meals: {}
};
const mealTypes = ['breakfast','lunch','dinner'];

let saveTimer = null;
let remoteVersion = null;
let pendingRemoteData = null;

function setSyncStatus(text){
  const el = document.getElementById('sync-status');
  if(el) el.innerText = text;
}
function isEditingSomething(){
  const el = document.activeElement;
  if(!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.isContentEditable;
}
function applyRemoteData(data){
  state = Object.assign({tasks:[],storeOrder:[],shopping:{},meals:{}}, data);
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

// Format YYYY-MM-DD for clean dates
function getTodayKey(offsetDays = 0){
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr){
  const [year, month, day] = dateStr.split('-');
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// --- ARCHIVE TOGGLE VISIBILITY ---
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

// --- TASKS ---
function addTask(){
  const textInput = document.getElementById('task-input');
  const colSelect = document.getElementById('task-column');
  const text = textInput.value.trim();
  if(!text) return;
  state.tasks.push({ 
    id: Date.now() + Math.random(), 
    text, 
    column: colSelect.value, 
    completed: false,
    completedDate: null
  });
  textInput.value = '';
  textInput.focus();
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
        completedDate: isNowDone ? getTodayKey() : null
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
  // Active (uncompleted) tasks
  const activeTasks = state.tasks.filter(t => !t.completed);
  ['today','week','someday'].forEach(col=>{
    const listEl = document.getElementById('list-'+col);
    const countEl = document.getElementById('count-'+col);
    const filtered = activeTasks.filter(t=>t.column===col);
    countEl.innerText = filtered.length;
    listEl.innerHTML = '';
    filtered.forEach(task=>{
      const li = document.createElement('li');
      li.className = 'task-item';
      li.dataset.id = task.id;
      li.innerHTML = `
        <span class="drag-handle">⠿⠿</span>
        <label onclick="toggleTask(${task.id})">
          <input type="checkbox" onclick="event.stopPropagation(); toggleTask(${task.id})">
          <span>${escapeHtml(task.text)}</span>
        </label>
        <button onclick="deleteTask(${task.id})">✕</button>
      `;
      listEl.appendChild(li);
      const handle = li.querySelector('.drag-handle');
      handle.addEventListener('pointerdown', (e)=>startDrag(e, task.id, li));
    });
  });

  // Archive (completed) tasks sorted by date
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

  // Group completed tasks by date
  const groups = {};
  completedTasks.forEach(task => {
    const dateKey = task.completedDate || 'Earlier';
    if(!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(task);
  });

  // Sort dates descending (newest first)
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
      li.innerHTML = `
        <label onclick="toggleTask(${task.id})">
          <input type="checkbox" checked onclick="event.stopPropagation(); toggleTask(${task.id})">
          <span>${escapeHtml(task.text)}</span>
        </label>
        <button onclick="deleteTask(${task.id})">✕</button>
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
  state.shopping[store].push({ id: Date.now()+Math.random(), text, checked:false });
  inputEl.value = '';
  renderShopping();
  scheduleSave();
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
        <input type="text" placeholder="Add item…" onkeydown="if(event.key==='Enter'){addShoppingItem('${store}', this);}">
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
    const dateKey = getTodayKey(i);
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

function escapeHtml(str){
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

function renderAll(){
  renderTasks();
  renderShopping();
  renderMeals();
  initArchiveVisibility();
}

loadState();

Object.assign(window, {
  switchTab, addTask, toggleTask, deleteTask,
  addStore, removeStore, renameStore,
  addShoppingItem, toggleShoppingItem, clearCheckedShopping,
  updateMeal, toggleArchiveVisibility
});