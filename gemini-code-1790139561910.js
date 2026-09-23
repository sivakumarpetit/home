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
const daysOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
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
  initMealsState();
  renderAll();
  setSyncStatus('updated ' + new Date().toLocaleTimeString());
}

function loadState(){
  setSyncStatus('connecting…');
  onSnapshot(stateRef, (snap)=>{
    if(!snap.exists()){
      setSyncStatus('ready — add something to get started');
      initMealsState();
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

// --- TASKS ---
function addTask(){
  const textInput = document.getElementById('task-input');
  const colSelect = document.getElementById('task-column');
  const text = textInput.value.trim();
  if(!text) return;
  state.tasks.push({ id: Date.now()+Math.random(), text, column: colSelect.value, completed:false });
  textInput.value = '';
  textInput.focus();
  renderTasks();
  scheduleSave();
}
function toggleTask(id){
  state.tasks = state.tasks.map(t => t.id===id ? {...t, completed:!t.completed} : t);
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
  ['today','week','someday'].forEach(col=>{
    const listEl = document.getElementById('list-'+col);
    const countEl = document.getElementById('count-'+col);
    const filtered = state.tasks.filter(t=>t.column===col);
    countEl.innerText = filtered.length;
    listEl.innerHTML = '';
    filtered.forEach(task=>{
      const li = document.createElement('li');
      li.className = 'task-item' + (task.completed ? ' done' : '');
      li.dataset.id = task.id;
      li.innerHTML = `
        <span class="drag-handle">⠿⠿</span>
        <label onclick="toggleTask(${task.id})">
          <input type="checkbox" ${task.completed?'checked':''} onclick="event.stopPropagation(); toggleTask(${task.id})">
          <span>${escapeHtml(task.text)}</span>
        </label>
        <button onclick="deleteTask(${task.id})">✕</button>
      `;
      listEl.appendChild(li);
      const handle = li.querySelector('.drag-handle');
      handle.addEventListener('pointerdown', (e)=>startDrag(e, task.id, li));
    });
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
function initMealsState(){
  daysOfWeek.forEach(day=>{
    if(!state.meals[day]) state.meals[day] = { breakfast:'', lunch:'', dinner:'' };
  });
}
function updateMeal(day, type, value){
  state.meals[day][type] = value;
  scheduleSave();
}
function renderMeals(){
  const tbody = document.getElementById('meal-table-body');
  tbody.innerHTML = '';
  daysOfWeek.forEach(day=>{
    const row = document.createElement('tr');
    let rowHtml = `<td>${day}</td>`;
    mealTypes.forEach(type=>{
      const val = state.meals[day][type] || '';
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      rowHtml += `<td data-label="${label}"><input type="text" value="${escapeHtml(val)}" oninput="updateMeal('${day}','${type}', this.value)"></td>`;
    });
    row.innerHTML = rowHtml;
    tbody.appendChild(row);
  });
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
}

loadState();

Object.assign(window, {
  switchTab, addTask, toggleTask, deleteTask,
  addStore, removeStore, renameStore,
  addShoppingItem, toggleShoppingItem, clearCheckedShopping,
  updateMeal
});