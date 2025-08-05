/* ----------------------------------------------------------
   Document-Center front-end logic
   ----------------------------------------------------------
   ‣ Requires two globals injected by Astro (or your backend):
       window.orders        → array  of order objects
       window.docsByOrder   → object keyed by orderId with arrays of docs
   ‣ IDs, classes and datasets match the markup I supplied.
   ‣ No external dependencies – pure, modern JS.
   ---------------------------------------------------------- */

/* ---------- 1. DATA ---------- */

const orders        = window.orders        || [];
const docsByOrder   = window.docsByOrder   || {};

/* current working sets */
let currentOrderId        = null;
let documents             = [];
let filteredDocuments     = [];

const itemsPerPage        = 4;
let currentPage           = 1;

/* ---------- 2. DOM REFS ---------- */

const ordersGrid          = document.getElementById('orders-grid');
const statsSection        = document.getElementById('documents-stats');
const docsSection         = document.getElementById('documents-section');
const docsContainer       = document.getElementById('documents-container');

const totalDocsEl         = document.getElementById('total-docs');
const recentDocsEl        = document.getElementById('recent-docs');
const pendingDocsEl       = document.getElementById('pending-docs');
const reviewedDocsEl      = document.getElementById('reviewed-docs');
const reviewedBarEl       = document.getElementById('reviewed-progress');
const recentInfoEl        = document.getElementById('recent-info');
const pendingInfoEl       = document.getElementById('pending-info');

const paginationInfoEl    = document.getElementById('pagination-info');
const prevBtn             = document.getElementById('prev-btn');
const nextBtn             = document.getElementById('next-btn');
const pageNumbersEl       = document.getElementById('page-numbers');

const searchInput         = document.getElementById('search-input');
const typeFilter          = document.getElementById('type-filter');

const emailModal          = document.getElementById('email-modal');
const emailModalContent   = emailModal?.querySelector('.relative');
const closeEmailModalBtn  = document.getElementById('close-email-modal');
const cancelEmailBtn      = document.getElementById('cancel-email');
const sendEmailBtn        = document.getElementById('send-email');

/* ---------- 3. UTILS ---------- */

const statusColours = {
  Unread  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Viewed  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Reviewed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
};

function fmtDate (iso) {
  const date = new Date(iso);
  const now  = new Date();
  const diff = (now - date) / 3_600_000; // h

  const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (diff < 24)  return `${date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',timeZone:tz})} today`;
  if (diff < 48)  return `${date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',timeZone:tz})} yesterday`;
  if (diff < 168) return date.toLocaleString('en-US',{weekday:'long',hour:'2-digit',minute:'2-digit',timeZone:tz});
  return date.toLocaleString('en-US',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:tz});
}

function notify (msg, type='success') {
  const n  = document.createElement('div');
  n.className = `fixed right-4 ${type==='success'?'bg-green-600':'bg-red-600'}
                 text-white px-6 py-4 rounded-xl shadow-xl z-[9999]
                 transform translate-x-full transition-transform duration-300`;
  n.innerHTML  = `<p class="text-sm">${msg}</p>`;
  document.body.appendChild(n);
  requestAnimationFrame(()=>n.classList.remove('translate-x-full'));
  setTimeout(()=>{ n.classList.add('translate-x-full');
                   n.addEventListener('transitionend',()=>n.remove()); }, 4000);
}

/* ---------- 4. ORDER GRID ---------- */

function renderOrders () {
  ordersGrid.innerHTML = '';
  orders.forEach(o=>{
    const card = document.createElement('div');
    card.dataset.orderId = o.id;
    card.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all duration-200 hover:shadow-md';
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div>
          <h4 class="font-semibold text-gray-900 dark:text-white">${o.orderNumber}</h4>
          <p  class="text-sm text-gray-600 dark:text-gray-400">${o.clientName}</p>
        </div>
        <div class="flex space-x-2">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            {'In Progress':'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
             Completed    :'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
             Pending      :'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}[o.status]
          }">${o.status}</span>
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            {high:'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
             medium:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
             low:'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}[o.priority]
          }">${o.priority}</span>
        </div>
      </div>
      <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>${o.documents} documents</span>
        <span>Updated ${fmtDate(o.lastUpdated)}</span>
      </div>`;
    card.addEventListener('click', ()=>selectOrder(o.id));
    ordersGrid.appendChild(card);
  });
}

/* ---------- 5. SELECT ORDER & DOCUMENTS ---------- */

function selectOrder (orderId) {
  currentOrderId   = orderId;
  documents        = docsByOrder[orderId] ? [...docsByOrder[orderId]] : [];
  filteredDocuments= [...documents];
  currentPage      = 1;

  statsSection.classList.remove('hidden');
  docsSection .classList.remove('hidden');

  [...ordersGrid.children].forEach(c=>c.classList.remove('ring-2','ring-blue-500','border-blue-500'));
  ordersGrid.querySelector(`[data-order-id="${orderId}"]`)
            ?.classList.add('ring-2','ring-blue-500','border-blue-500');

  renderDocuments();
  updateStats();
  updatePagination();

  const ord = orders.find(o=>o.id===orderId);
  if (ord) notify(`Selected order: ${ord.orderNumber} - ${ord.clientName}`);
}

/* ---------- 6. RENDER DOCUMENT LIST ---------- */

function renderDocuments () {
  const start = (currentPage-1)*itemsPerPage;
  const pageDocs = filteredDocuments.slice(start,start+itemsPerPage);
  docsContainer.innerHTML = '';

  pageDocs.forEach(doc=>{
    const iconMap = {
      pdf:{bg:'bg-red-100 dark:bg-red-900/30', svg:`<svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`},
      doc:{bg:'bg-blue-100 dark:bg-blue-900/30', svg:`<svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`},
      img:{bg:'bg-green-100 dark:bg-green-900/30', svg:`<svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`}
    };

    const row   = document.createElement('div');
    row.className = 'p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200';
    row.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 ${iconMap[doc.type]?.bg || 'bg-gray-100'} rounded-lg flex items-center justify-center">
              ${iconMap[doc.type]?.svg || ''}
            </div>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white">${doc.name}</h3>
            <p  class="text-sm text-gray-500 dark:text-gray-400">${doc.category} • ${doc.size} • Updated ${fmtDate(doc.updated)}</p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColours[doc.status]}">${doc.status}</span>

          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Download" data-action="download" data-id="${doc.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </button>

          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="View" data-action="view" data-id="${doc.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>

          <button class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Email Issue" data-action="email" data-id="${doc.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </button>

          ${doc.status!=='Reviewed'
            ? `<button class="text-gray-400 hover:text-green-600 dark:hover:text-green-400" title="Mark reviewed" data-action="review" data-id="${doc.id}">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
               </button>`
            : `<button class="text-green-400 hover:text-red-600 dark:hover:text-red-400" title="Un-review" data-action="unreview" data-id="${doc.id}">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>`
          }
        </div>
      </div>`;
    docsContainer.appendChild(row);
  });
}

/* ---------- 7. STATS ---------- */

function updateStats () {
  const total        = filteredDocuments.length;
  const now          = Date.now();

  const recent       = filteredDocuments.filter(d => (now - new Date(d.updated))/(3_600_000) < 168).length;
  const today        = filteredDocuments.filter(d => (now - new Date(d.updated))/(3_600_000) < 24).length;
  const unread       = filteredDocuments.filter(d => d.status==='Unread').length;
  const reviewed     = filteredDocuments.filter(d => d.status==='Reviewed').length;
  const progressPct  = total ? (reviewed/total)*100 : 0;

  totalDocsEl.textContent     = total;
  recentDocsEl.textContent    = recent;
  pendingDocsEl.textContent   = unread;
  reviewedDocsEl.textContent  = `${reviewed}/${total}`;
  reviewedBarEl.style.width   = `${progressPct}%`;

  recentInfoEl.textContent    = today ? `${today} new today` : 'No new today';
  pendingInfoEl.textContent   = unread ? `${unread} remaining` : 'All read';

  reviewedBarEl.className = `h-2 rounded-full transition-all duration-300 ${
    progressPct>=80 ? 'bg-green-600'
    : progressPct>=50 ? 'bg-yellow-600'
    : 'bg-purple-600'
  }`;
}

/* ---------- 8. PAGINATION ---------- */

function updatePagination () {
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startItem  = (currentPage-1)*itemsPerPage + 1;
  const endItem    = Math.min(currentPage*itemsPerPage, filteredDocuments.length);

  paginationInfoEl.textContent = `Showing ${startItem}-${endItem} of ${filteredDocuments.length} documents`;

  pageNumbersEl.innerHTML = '';
  Array.from({length:totalPages}, (_,i)=>{
    const btn = document.createElement('button');
    btn.className = `px-3 py-2 text-sm font-medium border rounded-md transition-colors duration-200
      ${i+1===currentPage 
        ? 'text-white bg-blue-600 border-transparent'
        : 'text-gray-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`;
    btn.textContent = (i+1);
    btn.addEventListener('click', ()=>{ currentPage=i+1; renderDocuments(); updatePagination(); });
    pageNumbersEl.appendChild(btn);
  });

  prevBtn.disabled = currentPage===1;
  nextBtn.disabled = currentPage===totalPages;
}

/* ---------- 9. FILTERS ---------- */

function filterDocuments () {
  const term   = searchInput.value.toLowerCase();
  const t      = typeFilter.value;

  filteredDocuments = documents.filter(d=>{
    const matchText = d.name.toLowerCase().includes(term) || d.category.toLowerCase().includes(term);
    const matchType = !t || d.type===t;
    return matchText && matchType;
  });

  currentPage=1;
  renderDocuments();
  updatePagination();
  updateStats();
}

/* ---------- 10. DOC ACTIONS ---------- */

function downloadDocument (doc) {
  notify(`Downloading ${doc.name}`);
  if (doc.status==='Unread') { doc.status='Viewed'; filterDocuments(); }
}
function viewDocument (doc) {
  notify(`Opening ${doc.name}`);
  if (doc.status==='Unread') { doc.status='Viewed'; filterDocuments(); }
}
function markReviewed (doc) {
  doc.status='Reviewed'; notify(`${doc.name} marked as reviewed`);
  filterDocuments();
}
function markUnreviewed (doc) {
  doc.status='Viewed';   notify(`${doc.name} marked as not reviewed`);
  filterDocuments();
}
function openEmailModal (doc) {
  emailModal.dataset.docId = doc.id;
  // fill placeholder info inside modal (simple)
  document.getElementById('document-details').innerHTML =
      `<p class="text-sm">${doc.name}</p><p class="text-xs text-gray-500 dark:text-gray-400">${doc.category}</p>`;

  emailModal.classList.remove('hidden');
  requestAnimationFrame(()=>emailModalContent.classList.remove('scale-95','opacity-0'));
}
function closeEmailModal () {
  emailModalContent.classList.add('scale-95','opacity-0');
  setTimeout(()=>emailModal.classList.add('hidden'),200);
}

/* ---------- 11. GLOBAL EVENT DELEGATION ---------- */

docsContainer.addEventListener('click', e=>{
  const btn   = e.target.closest('button[data-action]');
  if (!btn) return;
  const id    = +btn.dataset.id;
  const doc   = documents.find(d=>d.id===id);
  if (!doc) return;

  switch (btn.dataset.action) {
    case 'download': downloadDocument(doc); break;
    case 'view'    : viewDocument(doc); break;
    case 'email'   : openEmailModal(doc); break;
    case 'review'  : markReviewed(doc); break;
    case 'unreview': markUnreviewed(doc); break;
  }
});

/* modal controls */
closeEmailModalBtn?.addEventListener('click', closeEmailModal);
cancelEmailBtn   ?.addEventListener('click', closeEmailModal);
emailModal.addEventListener('click', e=>{
  if (e.target===emailModal) closeEmailModal();
});
sendEmailBtn?.addEventListener('click', ()=>{
  notify('Issue report submitted (mock)');
  closeEmailModal();
});

/* pagination buttons */
prevBtn.addEventListener('click', ()=>{ if (currentPage>1) {currentPage--; renderDocuments(); updatePagination();}});
nextBtn.addEventListener('click', ()=>{ const totalPages=Math.ceil(filteredDocuments.length/itemsPerPage);
                                        if (currentPage<totalPages){currentPage++; renderDocuments(); updatePagination();}});

/* filters */
searchInput.addEventListener('input', filterDocuments);
typeFilter .addEventListener('change', filterDocuments);

/* ---------- 12. INIT ---------- */

renderOrders();