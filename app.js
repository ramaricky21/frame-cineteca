import { FIREBASE_CONFIG, TMDB_API_KEY } from './config.js';
import { DEFAULT_CATEGORIES, STATUSES, FORMATS, PALETTE, parseRating,
  filteredEntries, sortedEntries, slugId, normalizeEntry, cleanCategory, backupPayload, validateBackup } from './data.js';

const $ = (id)=>document.getElementById(id);
const esc = (value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured = Object.values(FIREBASE_CONFIG).every(v=>typeof v==='string'&&v.length>3&&!v.includes('INSERISCI'));
const tmdbReady = typeof TMDB_API_KEY==='string'&&TMDB_API_KEY.length>=8&&!TMDB_API_KEY.includes('INSERISCI');
const state = { mode:'startup', user:null, entries:[], categories:[], status:'all', category:'all', query:'', sort:'rating-desc',
  unsubs:[], sdk:null, auth:null, db:null, selectedTmdb:null, searchSeq:0, searchTimer:null, busy:false, modalKind:'',
  initialized:false, listenersReady:0 };
const DEMO_ITEMS = [
  {id:'demo-chainsaw',title:'Chainsaw Man',format:'Anime',status:'seen',ratingLabel:'11/10',categoryIds:['anime','fantasy'],demoPoster:'assets/frame_mock_chainsaw.jpg',createdMs:800},
  {id:'demo-alya',title:'Alya Sometimes Hides Her Feelings in Russian',format:'Anime',status:'seen',ratingLabel:'10 e lode',categoryIds:['anime','romance'],demoPoster:'assets/frame_mock_alya.jpg',createdMs:700},
  {id:'demo-blue',title:'Blue Box',format:'Anime',status:'watching',ratingLabel:'9+',categoryIds:['anime','romance'],demoPoster:'assets/frame_mock_blue.jpg',createdMs:600},
  {id:'demo-dress',title:'My Dress-Up Darling',format:'Anime',status:'seen',ratingLabel:'9-',categoryIds:['anime','romance'],demoPoster:'assets/frame_mock_dressup.jpg',createdMs:500},
  {id:'demo-trapped',title:'Trapped in a Dating Sim',format:'Anime',status:'seen',ratingLabel:'8,5',categoryIds:['anime','fantasy'],demoPoster:'assets/frame_mock_trapped.jpg',createdMs:400},
  {id:'demo-aoharu',title:'Ao Haru Ride',format:'Anime',status:'seen',ratingLabel:'8,5',categoryIds:['anime','romance'],demoPoster:'assets/frame_mock_aoharu.jpg',createdMs:300},
  {id:'demo-your',title:'Your Name',format:'Film',status:'seen',ratingLabel:'8',categoryIds:['anime','film'],demoPoster:'assets/frame_mock_yourname.jpg',createdMs:200},
  {id:'demo-wistoria',title:'Wistoria',format:'Anime',status:'planned',ratingLabel:'',categoryIds:['anime','fantasy'],demoPoster:'assets/frame_mock_wistoria.jpg',createdMs:100}
].map(x=>({...normalizeEntry(x),id:x.id}));

function toast(message,type='info') {
  const node=document.createElement('div');node.className='toast'+(type==='error'?' error':type==='warn'?' warn':'');node.textContent=message;
  $('toasts').append(node);setTimeout(()=>node.remove(),5000);
}
function sync(text,level='ok'){
  $('syncLabel').className='sync-pill'+(level!=='ok'?' '+level:'');$('syncText').textContent=text;
}
function openDrawer(){ $('sidebar').classList.add('open');$('drawerScrim').hidden=false; }
function closeDrawer(){ $('sidebar').classList.remove('open');$('drawerScrim').hidden=true; }
function modal({kind,title,kicker='LA TUA CINETECA',intro='',body}){
  state.modalKind=kind;
  $('modalKicker').textContent=kicker;$('modalTitle').textContent=title;$('modalIntro').textContent=intro;
  $('modalBody').innerHTML=body;$('modalBackdrop').hidden=false;
  const field=$('modalBody').querySelector('[autofocus]');if(field)setTimeout(()=>field.focus(),70);
}
function closeModal(force=false){
  if(state.busy&&!force)return;
  if(['login','register','setup','boot'].includes(state.modalKind)&&state.mode!=='demo'&&state.mode!=='cloud')return;
  $('modalBackdrop').hidden=true;state.modalKind='';state.selectedTmdb=null;clearTimeout(state.searchTimer);state.searchSeq++;
}
function requireApp(){ if(!['demo','cloud'].includes(state.mode)){toast('Accedi prima di aggiungere titoli.','warn');return false}return true; }
function formatScore(entry){return entry.ratingLabel?`★ ${esc(entry.ratingLabel)}`:'★ —';}
function imageUrl(entry,size='w342'){
  if(entry.posterPath&&/^\/[A-Za-z0-9/_.-]{2,180}$/.test(entry.posterPath))return `https://image.tmdb.org/t/p/${size}${entry.posterPath}`;
  if(state.mode==='demo'&&entry.demoPoster)return './'+entry.demoPoster;
  return '';
}
function categoryLabel(entry){return (entry.categoryIds||[]).map(id=>state.categories.find(c=>c.id===id)?.name).filter(Boolean).join(' · ')||entry.format||'Senza categoria';}
function statusName(id){return STATUSES.find(s=>s.id===id)?.short||'Da vedere';}
function render(){
  const nav=[{id:'all',label:'La mia cineteca',icon:'▦'},...STATUSES.map(s=>({id:s.id,label:s.label,icon:s.icon}))];
  $('statusNav').innerHTML=nav.map(n=>`<button class="nav-item ${state.status===n.id?'active':''}" data-status="${n.id}"><span class="nav-symbol">${n.icon}</span><span>${esc(n.label)}</span>${n.id==='all'?`<small class="nav-count">${state.entries.length}</small>`:''}</button>`).join('');
  $('categoryNav').innerHTML=state.categories.map(c=>`<div class="cat-item ${state.category===c.id?'active':''}" style="--dot:${c.color}"><button class="cat-item-main" data-category="${esc(c.id)}" title="Mostra ${esc(c.name)}" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;background:none;border:0;text-align:left;padding:0;color:inherit"><span class="cat-dot"></span><span class="cat-title">${esc(c.name)}</span><small class="nav-count">${state.entries.filter(e=>(e.categoryIds||[]).includes(c.id)).length}</small></button><button class="cat-action" data-category-actions="${esc(c.id)}" title="Gestisci ${esc(c.name)}" aria-label="Gestisci ${esc(c.name)}">⋯</button></div>`).join('');
  $('filterPills').innerHTML=`<button class="pill ${state.category==='all'?'active':''}" data-category="all">Tutti</button>`+state.categories.map(c=>`<button class="pill ${state.category===c.id?'active':''}" data-category="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  const shown=filteredEntries(state.entries,{status:state.status,category:state.category,query:state.query,sort:state.sort});
  const selectedCat=state.categories.find(c=>c.id===state.category);
  $('sectionTitle').innerHTML=selectedCat?`Categoria <em>${esc(selectedCat.name)}</em>`:state.status==='all'?'La tua <em>cineteca</em>':`${esc(statusName(state.status))}<em>.</em>`;
  $('sectionSubtitle').textContent=`${shown.length} ${shown.length===1?'titolo':'titoli'} ${state.query?'trovati':'nella selezione'}`;
  $('quickPlanned').textContent=state.status==='planned'?'Tutti i titoli':'Solo da vedere';
  $('libraryCards').innerHTML=shown.map(entry=>{
    const src=imageUrl(entry); const poster=`<div class="poster-fallback">${esc(entry.title)}</div>`+(src?`<img loading="lazy" src="${esc(src)}" alt="Locandina di ${esc(entry.title)}" onerror="this.style.display='none'">`:'');
    return `<article class="media-card" data-edit="${esc(entry.id)}" role="button" tabindex="0" aria-label="Modifica ${esc(entry.title)}"><div class="poster">${poster}<span class="rating-badge">${formatScore(entry)}</span><span class="poster-status">${state.status==='all'?esc(statusName(entry.status)):esc(entry.format)}</span></div><div class="card-bottom"><div><strong>${esc(entry.title)}</strong><p>${esc(categoryLabel(entry))}</p></div><button class="card-edit" title="Modifica" data-edit="${esc(entry.id)}" aria-label="Modifica ${esc(entry.title)}">✎</button></div></article>`;
  }).join('');
  $('emptyState').hidden=shown.length>0;$('libraryCards').hidden=shown.length===0;
  $('emptyTitle').textContent=state.entries.length===0?'Qui iniziano le tue storie.':'Nessun titolo in questa selezione.';
  $('emptyMessage').textContent=state.entries.length===0?'Aggiungi il tuo primo titolo: la sua locandina arriverà automaticamente da TMDB.':'Prova un altro filtro oppure aggiungi un nuovo titolo.';
  const top=sortedEntries(state.entries).find(e=>typeof e.ratingScore==='number');
  $('heroFeature').hidden=!top;if(top){$('topTitle').textContent=top.title;$('topRating').textContent=top.ratingLabel||''}
  const name=state.user?.email|| (state.mode==='demo'?'Modalità demo':'Il mio spazio');
  $('profileName').textContent=name;$('profileSub').textContent=state.mode==='cloud'?'Sincronizzato con Firebase':state.mode==='demo'?'Dati solo in questa demo':'Le tue storie, ovunque';
  $('avatar').textContent=name.slice(0,1).toUpperCase();$('userBtn').textContent=name.slice(0,1).toUpperCase();
  $('logoutBtn').hidden=state.mode==='startup';
}
function setStatus(id){state.status=id;closeDrawer();render();}
function setCategory(id){state.category=id;closeDrawer();render();}
function entryId(id){return state.entries.find(x=>x.id===id);}
function catId(id){return state.categories.find(x=>x.id===id);}

function ratingInputValue(e){return e?.ratingLabel||'';}
function formEntryMarkup(entry=null){
  const isEdit=!!entry;
  return `<form id="entryForm" class="wide-body">
    <div class="callout" id="tmdbNotice">${tmdbReady?'Cerca il titolo su TMDB: scegli il risultato corretto e la <strong>locandina verrà aggiunta automaticamente</strong>.':'Per la ricerca automatica delle locandine, configura prima la chiave TMDB in <code>config.js</code>. Puoi comunque inserire titoli senza locandina.'}</div>
    <label class="form-label" for="titleSearch">Cerca su TMDB (film, serie TV e anime)</label>
    <input id="titleSearch" class="input" type="search" placeholder="Es. Your Name, Chainsaw Man, Interstellar..." autocomplete="off" ${tmdbReady?'autofocus':''} ${tmdbReady?'':'disabled'}>
    <div class="search-results" id="tmdbResults" hidden></div>
    <div id="selectedTmdb" ${entry?.posterPath?'':'hidden'}>${entry?.posterPath?`<div class="selected-result"><img alt="Locandina" src="${esc(imageUrl(entry,'w185'))}"><div><strong>Locandina già associata</strong><small>Puoi sostituirla cercando un altro titolo.</small></div></div>`:''}</div>
    <label class="form-label" for="entryTitle">Titolo visualizzato *</label>
    <input class="input" id="entryTitle" required maxlength="180" placeholder="Nome del titolo" value="${esc(entry?.title||'')}" ${tmdbReady?'':'autofocus'}>
    <div class="form-two"><div><label class="form-label" for="entryFormat">Formato</label><select class="select" id="entryFormat">${FORMATS.map(v=>`<option ${entry?.format===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div><label class="form-label" for="entryYear">Anno (facoltativo)</label><input class="input" id="entryYear" maxlength="12" placeholder="Es. 2024" value="${esc(entry?.year||'')}"></div></div>
    <div class="form-two"><div><label class="form-label" for="entryStatus">Stato</label><select class="select" id="entryStatus">${STATUSES.map(s=>`<option value="${s.id}" ${entry?.status===s.id?'selected':(!entry&&s.id==='seen'?'selected':'')}>${esc(s.short)}</option>`).join('')}</select></div><div><label class="form-label" for="entryRating">Voto personale</label><input class="input" id="entryRating" placeholder="8,5 · 9+ · 10 e lode · 11/10" value="${esc(ratingInputValue(entry))}"><div class="help">Lascia vuoto se non hai ancora dato un voto.</div></div></div>
    <div class="tiny-row"><label class="form-label" style="margin:5px 0">Categorie (anche più di una)</label><button type="button" class="text-button" id="entryNewCategory">＋ Nuova categoria</button></div>
    <div id="entryCategoryChecks" class="category-checks"></div>
    <label class="form-label" for="entryNotes">Note e impressioni (facoltative)</label><textarea id="entryNotes" class="textarea" maxlength="3000" placeholder="Cosa ti è piaciuto, personaggi, momenti memorabili...">${esc(entry?.notes||'')}</textarea>
    <div class="form-actions"><div class="left-actions">${isEdit?'<button type="button" class="danger-button" id="deleteEntry">Elimina titolo</button>':''}</div><div class="right-actions"><button type="button" class="secondary-button" id="cancelEntry">Annulla</button><button type="submit" class="accent-button" id="saveEntry">${isEdit?'Salva modifiche':'Aggiungi alla cineteca'}</button></div></div>
  </form>`;
}
function renderEntryChecks(selectedIds=[]){
  const node=$('entryCategoryChecks');if(!node)return;
  node.innerHTML=state.categories.length?state.categories.map(c=>`<label class="category-check"><input type="checkbox" name="categoryId" value="${esc(c.id)}" ${selectedIds.includes(c.id)?'checked':''}><span class="cat-dot" style="--dot:${c.color}"></span>${esc(c.name)}</label>`).join(''):'<p class="help">Non hai ancora categorie. Puoi crearne una adesso.</p>';
}
let currentEditId=null;
function openEntry(id=null){
  if(!requireApp())return;
  const entry=id?entryId(id):null;if(id&&!entry){toast('Titolo non trovato.','error');return}
  currentEditId=entry?.id||null;state.selectedTmdb=null;
  modal({kind:'entry',title:entry?'Modifica titolo':'Aggiungi una storia',intro:entry?'Modifica voto, stato, categorie o locandina in qualsiasi momento.':'Cerca il titolo: FRAME recupera automaticamente la locandina da TMDB.',body:formEntryMarkup(entry)});
  renderEntryChecks(entry?.categoryIds||[]);
  $('entryNewCategory').onclick=()=>openCategory(null,'entry');
  $('cancelEntry').onclick=()=>closeModal();
  $('entryForm').onsubmit=saveEntry;
  if(entry)$('deleteEntry').onclick=()=>deleteEntry(entry);
  $('titleSearch').oninput=searchTmdbDebounced;
}
async function searchTmdbDebounced(ev){
  clearTimeout(state.searchTimer);const query=ev.target.value.trim();const box=$('tmdbResults');state.searchSeq++;
  if(!query||query.length<2){box.hidden=true;box.innerHTML='';return}
  const seq=state.searchSeq;box.hidden=false;box.innerHTML='<div class="help" style="padding:12px"><span class="spinner"></span>Ricerca...</div>';
  state.searchTimer=setTimeout(async()=>{
    try{
      const url=new URL('https://api.themoviedb.org/3/search/multi');
      url.search=new URLSearchParams({api_key:TMDB_API_KEY,query,language:'it-IT',include_adult:'false',page:'1'}).toString();
      const response=await fetch(url,{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(response.status===401?'Chiave TMDB non valida.':`TMDB ha risposto con errore ${response.status}.`);
      const json=await response.json();if(seq!==state.searchSeq||state.modalKind!=='entry')return;
      const results=(json.results||[]).filter(r=>r.media_type==='movie'||r.media_type==='tv').slice(0,12);
      if(!results.length){box.innerHTML='<div class="help" style="padding:12px">Nessun risultato. Puoi inserire il titolo manualmente.</div>';return}
      box.innerHTML=results.map((r,i)=>{const title=r.title||r.name||r.original_title||r.original_name||'';const year=(r.release_date||r.first_air_date||'').slice(0,4);const poster=r.poster_path?`https://image.tmdb.org/t/p/w92${r.poster_path}`:'';
        return `<button class="tmdb-result" type="button" data-result-index="${i}">${poster?`<img loading="lazy" src="${esc(poster)}" alt="">`:'<span class="result-placeholder">◈</span>'}<span><strong>${esc(title)}</strong><small>${r.media_type==='tv'?'Serie TV':'Film'} · ${esc(year||'Anno sconosciuto')}${r.original_name&&r.original_name!==title?' · '+esc(r.original_name):''}</small></span></button>`;
      }).join('');
      box.querySelectorAll('[data-result-index]').forEach(btn=>btn.onclick=()=>{
        const r=results[Number(btn.dataset.resultIndex)];
        const title=r.title||r.name||r.original_title||r.original_name||'';
        state.selectedTmdb={tmdbId:r.id,tmdbMediaType:r.media_type,posterPath:r.poster_path||'',originalTitle:r.original_title||r.original_name||''};
        $('entryTitle').value=title;$('entryYear').value=(r.release_date||r.first_air_date||'').slice(0,4);
        $('entryFormat').value=r.media_type==='movie'?'Film':'Serie TV';
        $('selectedTmdb').hidden=false;
        $('selectedTmdb').innerHTML=`<div class="selected-result">${r.poster_path?`<img alt="Locandina" src="https://image.tmdb.org/t/p/w185${esc(r.poster_path)}">`:'<span class="result-placeholder">◈</span>'}<div><strong>${esc(title)}</strong><small>Risultato TMDB selezionato · locandina automatica ${r.poster_path?'✓':'non disponibile'}</small></div></div>`;
        box.hidden=true;box.innerHTML='';
      });
    }catch(err){if(seq===state.searchSeq&&box){box.innerHTML=`<div class="error-text" style="padding:12px">${esc(err.message)} — puoi inserire il titolo senza ricerca.</div>`}}
  },380);
}
function readEntryForm(old){
  const input={title:$('entryTitle').value,originalTitle:state.selectedTmdb?.originalTitle||old?.originalTitle||'',year:$('entryYear').value,
    format:$('entryFormat').value,status:$('entryStatus').value,ratingLabel:$('entryRating').value,
    categoryIds:[...document.querySelectorAll('#entryCategoryChecks input:checked')].map(n=>n.value),notes:$('entryNotes').value,
    posterPath:state.selectedTmdb?state.selectedTmdb.posterPath:old?.posterPath||'',
    tmdbId:state.selectedTmdb?state.selectedTmdb.tmdbId:old?.tmdbId||null,
    tmdbMediaType:state.selectedTmdb?state.selectedTmdb.tmdbMediaType:old?.tmdbMediaType||'',
    demoPoster:state.selectedTmdb?'':old?.demoPoster||'',createdMs:old?.createdMs||Date.now()};
  return normalizeEntry(input);
}
async function saveEntry(event){
  event.preventDefault();if(state.busy)return;
  const old=currentEditId?entryId(currentEditId):null;
  try{
    const data=readEntryForm(old);if(!data.categoryIds.length&&state.categories.length) toast('Puoi anche scegliere una o più categorie.','warn');
    const id=old?.id||slugId('title');
    await writeRecord('entries',id,data);
    closeModal(true);toast(old?'Titolo aggiornato.':'Titolo aggiunto alla cineteca.');
  }catch(err){toast(showError(err),'error')}
}
async function deleteEntry(entry){
  if(!confirm(`Eliminare «${entry.title}»? Questa operazione rimuove solo questo titolo.`))return;
  try{await removeRecord('entries',entry.id);closeModal(true);toast('Titolo eliminato.')}catch(err){toast(showError(err),'error')}
}
function showError(err){
  const code=String(err?.code||'');
  if(code.includes('permission-denied'))return 'Accesso al database negato. Verifica le regole Firestore della guida.';
  if(code.includes('network')||code.includes('unavailable'))return 'Connessione non disponibile. Riprova online.';
  if(code.includes('unauthorized-domain'))return 'Dominio non autorizzato: aggiungi il dominio github.io in Firebase Authentication.';
  if(code.includes('email-already-in-use'))return 'Indirizzo email già registrato. Usa Accedi.';
  if(code.includes('invalid-email'))return 'Inserisci un indirizzo email valido.';
  if(code.includes('weak-password'))return 'Password troppo debole: usa almeno 6 caratteri.';
  if(code.includes('invalid-credential')||code.includes('wrong-password'))return 'Email o password non corretti.';
  if(code.includes('too-many-requests'))return 'Troppi tentativi. Riprova più tardi.';
  return err?.message||'Operazione non riuscita.';
}
async function writeRecord(collectionName,id,data){
  if(state.mode==='demo'){
    const arr=collectionName==='entries'?state.entries:state.categories;
    const index=arr.findIndex(x=>x.id===id);if(index<0)arr.push({id,...data});else arr[index]={id,...data};
    render();return;
  }
  if(state.mode!=='cloud'||!state.user)throw new Error('Effettua prima l’accesso.');
  const fs=state.sdk.fs;
  await fs.setDoc(fs.doc(state.db,'users',state.user.uid,collectionName,id),data);
}
async function removeRecord(collectionName,id){
  if(state.mode==='demo'){state[collectionName==='entries'?'entries':'categories']=state[collectionName==='entries'?'entries':'categories'].filter(x=>x.id!==id);render();return}
  await state.sdk.fs.deleteDoc(state.sdk.fs.doc(state.db,'users',state.user.uid,collectionName,id));
}
function openCategory(id=null,returnTo='manage'){
  if(!requireApp())return;
  const cat=id?catId(id):null;const selected=cat?.color||PALETTE[state.categories.length%PALETTE.length];
  const previousReturn=returnTo;const selectedForEntry=state.modalKind==='entry'?[...document.querySelectorAll('#entryCategoryChecks input:checked')].map(x=>x.value):[];
  const entryDraft=previousReturn==='entry'?{
    title:$('entryTitle')?.value||'',year:$('entryYear')?.value||'',format:$('entryFormat')?.value||'Anime',status:$('entryStatus')?.value||'seen',ratingLabel:$('entryRating')?.value||'',notes:$('entryNotes')?.value||'',categoryIds:selectedForEntry,
    posterPath:state.selectedTmdb?.posterPath||entryId(currentEditId)?.posterPath||'',tmdbId:state.selectedTmdb?.tmdbId||entryId(currentEditId)?.tmdbId||null,tmdbMediaType:state.selectedTmdb?.tmdbMediaType||entryId(currentEditId)?.tmdbMediaType||'',originalTitle:state.selectedTmdb?.originalTitle||entryId(currentEditId)?.originalTitle||''
  }:null;
  modal({kind:'category',title:cat?'Modifica categoria':'Nuova categoria',intro:'Le categorie sono completamente personalizzabili.',body:`<form id="categoryForm"><label class="form-label">Nome *</label><input class="input" id="categoryName" maxlength="45" value="${esc(cat?.name||'')}" placeholder="Es. Romance, Thriller, Anime..." required autofocus><label class="form-label">Colore</label><div class="color-grid" id="colorGrid">${PALETTE.map(c=>`<button type="button" data-color="${c}" class="color-choice ${selected===c?'active':''}" style="--choice:${c}" title="Colore ${c}"></button>`).join('')}</div><div class="form-actions"><button type="button" class="secondary-button" id="cancelCategory">Annulla</button><button type="submit" class="accent-button">${cat?'Salva categoria':'Crea categoria'}</button></div></form>`});
  let color=selected;
  $('colorGrid').onclick=e=>{const b=e.target.closest('[data-color]');if(!b)return;color=b.dataset.color;$('colorGrid').querySelectorAll('button').forEach(n=>n.classList.toggle('active',n===b));};
  $('cancelCategory').onclick=()=>{if(entryDraft){restoreDraft(entryDraft)}else if(cat||previousReturn==='manage')openManageCategories();else closeModal()};
  $('categoryForm').onsubmit=async e=>{
    e.preventDefault();try{const value=cleanCategory({name:$('categoryName').value,color});
      if(state.categories.some(c=>c.id!==cat?.id&&c.name.toLocaleLowerCase('it')===value.name.toLocaleLowerCase('it')))throw new Error('Esiste già una categoria con questo nome.');
      const newId=cat?.id||slugId('cat');await writeRecord('categories',newId,value);
      if(!catId(newId))state.categories.push({id:newId,...value});
      toast(cat?'Categoria aggiornata.':'Categoria creata.');
      if(entryDraft){entryDraft.categoryIds.push(newId);restoreDraft(entryDraft)}else openManageCategories();
    }catch(err){toast(showError(err),'error')}
  };
}
function restoreDraft(draft){
  const prev=currentEditId;
  openEntry(prev);
  $('entryTitle').value=draft.title;$('entryYear').value=draft.year;$('entryFormat').value=draft.format;
  $('entryStatus').value=draft.status;$('entryRating').value=draft.ratingLabel;$('entryNotes').value=draft.notes;
  state.selectedTmdb=draft.tmdbId?{tmdbId:draft.tmdbId,tmdbMediaType:draft.tmdbMediaType,posterPath:draft.posterPath,originalTitle:draft.originalTitle}:null;
  renderEntryChecks(draft.categoryIds);
}
function openManageCategories(){
  if(!requireApp())return;
  const html=state.categories.length?state.categories.map(c=>`<div class="manage-row"><span class="cat-dot" style="--dot:${c.color}"></span><span>${esc(c.name)}</span><small>${state.entries.filter(e=>e.categoryIds.includes(c.id)).length} titoli</small><button class="secondary-button" data-rename="${esc(c.id)}">Modifica</button><button class="danger-button" data-delete-category="${esc(c.id)}">Elimina</button></div>`).join(''):'<p class="help">Nessuna categoria: creane una per organizzare il catalogo.</p>';
  modal({kind:'manage',title:'Gestisci categorie',intro:'Puoi rinominare o eliminare ogni categoria. I titoli restano sempre nella tua cineteca.',body:`<div class="wide-body">${html}<div class="form-actions"><button id="closeCategories" class="secondary-button">Chiudi</button><button id="newCategory" class="accent-button">＋ Crea categoria</button></div></div>`});
  $('closeCategories').onclick=closeModal;$('newCategory').onclick=()=>openCategory(null,'manage');
  $('modalBody').querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>openCategory(b.dataset.rename,'manage'));
  $('modalBody').querySelectorAll('[data-delete-category]').forEach(b=>b.onclick=()=>deleteCategory(b.dataset.deleteCategory));
}
async function deleteCategory(id){
  const cat=catId(id);if(!cat)return;
  const affected=state.entries.filter(e=>e.categoryIds.includes(id));
  if(!confirm(`Eliminare la categoria «${cat.name}»?\n\nI ${affected.length} titoli associati NON verranno eliminati: perderanno solo questa categoria.`))return;
  try{
    if(state.mode==='demo'){
      state.entries=state.entries.map(e=>({...e,categoryIds:e.categoryIds.filter(c=>c!==id)}));
      state.categories=state.categories.filter(c=>c.id!==id);
    }else{
      const fs=state.sdk.fs;const root=['users',state.user.uid];
      // Operazioni a blocchi per non superare il limite Firestore di 500 scritture per batch.
      for(let i=0;i<affected.length;i+=350){const batch=fs.writeBatch(state.db);
        for(const entry of affected.slice(i,i+350))batch.update(fs.doc(state.db,...root,'entries',entry.id),{categoryIds:fs.arrayRemove(id)});
        await batch.commit();
      }
      await fs.deleteDoc(fs.doc(state.db,...root,'categories',id));
    }
    if(state.category===id)state.category='all';render();toast('Categoria eliminata. I titoli sono stati conservati.');openManageCategories();
  }catch(err){toast(showError(err),'error')}
}
function downloadJson(payload,filename){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function openBackup(){
  if(!requireApp())return;
  modal({kind:'backup',title:'Backup e importazione',intro:'Esporta tutti i tuoi titoli, voti e categorie in un file JSON, da conservare come copia personale.',body:`<div class="backup-ui"><div class="callout"><strong>Sincronizzazione:</strong> ${state.mode==='cloud'?'attiva via Firebase, con lo stesso account su ogni dispositivo.':'non attiva in modalità demo: i dati sono solo temporanei.'}<br><strong>Backup:</strong> il file JSON può essere importato in seguito anche su un altro account.</div><button class="accent-button" id="exportBackup">⇩ Scarica backup JSON</button><label class="form-label" for="importBackup">Importa un backup FRAME</label><input class="input" type="file" accept=".json,application/json" id="importBackup"><p>L'importazione <strong>aggiunge o aggiorna</strong> i record con lo stesso identificativo; non cancella gli altri titoli esistenti.</p><button class="secondary-button" id="doImport" type="button">Importa il file scelto</button></div>`});
  $('exportBackup').onclick=()=>{const p=backupPayload(state.categories,state.entries);downloadJson(p,`FRAME_backup_${new Date().toISOString().slice(0,10)}.json`);toast('Backup scaricato.')};
  $('doImport').onclick=async()=>{
    const file=$('importBackup').files?.[0];if(!file){toast('Scegli prima un file JSON.','warn');return}
    if(file.size>8*1024*1024){toast('Backup troppo grande (max 8 MB).','error');return}
    try{const data=validateBackup(JSON.parse(await file.text()));
      if(!confirm(`Importare ${data.entries.length} titoli e ${data.categories.length} categorie? I titoli con lo stesso ID verranno aggiornati.`))return;
      $('doImport').disabled=true;
      if(state.mode==='demo'){
        for(const c of data.categories){const i=state.categories.findIndex(x=>x.id===c.id);if(i<0)state.categories.push(c);else state.categories[i]=c;}
        for(const e of data.entries){const i=state.entries.findIndex(x=>x.id===e.id);if(i<0)state.entries.push(e);else state.entries[i]=e;}
      }else{
        const fs=state.sdk.fs;
        const jobs=[...data.categories.map(c=>({collection:'categories',data:c})),...data.entries.map(e=>({collection:'entries',data:e}))];
        for(let i=0;i<jobs.length;i+=350){const batch=fs.writeBatch(state.db);for(const job of jobs.slice(i,i+350)){
          const {id,...payload}=job.data;batch.set(fs.doc(state.db,'users',state.user.uid,job.collection,id),payload);
        }await batch.commit();}
      }
      toast(`Importati ${data.entries.length} titoli e ${data.categories.length} categorie.`);closeModal(true);render();
    }catch(err){toast('Importazione fallita: '+showError(err),'error')}finally{if($('doImport'))$('doImport').disabled=false}
  };
}
function openAbout(){
  modal({kind:'about',kicker:'INFORMAZIONI',title:'FRAME e i suoi dati',intro:'Una cineteca personale gratuita, senza pubblicità e senza abbonamenti.',body:`<div class="credits"><p>FRAME salva titoli, voti, categorie, stati e note nel tuo account Firebase. Le locandine e i metadati vengono richiesti al catalogo TMDB.</p><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" title="The Movie Database"><img class="tmdb-logo" src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="Logo ufficiale TMDB" loading="lazy"></a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><p><a href="https://www.themoviedb.org/about/logos-attribution" target="_blank" rel="noopener noreferrer">Crediti TMDB e logo ufficiale</a> · <a href="https://developer.themoviedb.org/docs/faq" target="_blank" rel="noopener noreferrer">Condizioni d'uso API</a></p><div class="callout">L'app è progettata per utilizzo <strong>personale non commerciale</strong>, usando GitHub Pages e Firebase Spark entro i rispettivi limiti gratuiti. Non possiamo garantire che i fornitori mantengano invariati i loro piani nel futuro.</div><button class="secondary-button" id="aboutClose">Chiudi</button></div>`});
  $('aboutClose').onclick=closeModal;
}
function startDemo(){
  state.mode='demo';state.user=null;state.entries=DEMO_ITEMS.map(e=>({...e,categoryIds:[...e.categoryIds]}));state.categories=DEFAULT_CATEGORIES.map(c=>({...c}));
  closeModal(true);sync('Demo locale','warn');render();toast('Modalità demo: le modifiche non vengono sincronizzate.');
}
function authMarkup(kind){
  const register=kind==='register',setup=kind==='setup',boot=kind==='boot';
  if(setup)return `<div class="auth-container"><div class="callout"><strong>Il codice dell'app è pronto.</strong> Per attivare i tuoi dati condivisi tra dispositivi devi creare un NUOVO progetto Firebase e incollare la sua configurazione nel file <code>config.js</code>, poi pubblicare su un NUOVO repository GitHub.<br>Segui la guida <code>GUIDA_PASSO_PASSO.md</code> contenuta nel progetto completo.</div><div class="form-actions"><button type="button" id="tryDemo" class="accent-button">Prova subito la demo</button></div></div>`;
  if(boot)return '<div class="help"><span class="spinner"></span>Connessione a Firebase in corso...</div>';
  return `<form class="auth-container" id="authForm"><label class="form-label" for="authEmail">Indirizzo email</label><input type="email" class="input" id="authEmail" placeholder="nome@email.it" autocomplete="email" required autofocus><label class="form-label" for="authPassword">Password</label><input type="password" class="input" id="authPassword" placeholder="Almeno 6 caratteri" autocomplete="${register?'new-password':'current-password'}" required minlength="6"><div class="form-actions"><button class="accent-button" type="submit" id="authSubmit">${register?'Crea account':'Accedi'}</button><button type="button" class="secondary-button" id="switchAuth">${register?'Hai già un account?':'Crea un account'}</button></div><div class="tiny-row"><button type="button" class="text-button" id="resetPassword">Password dimenticata?</button><button type="button" class="text-button" id="demoAuth">Prova la demo (senza sincronizzazione)</button></div><p id="authError" class="error-text" role="alert"></p></form>`;
}
function openAuth(kind='login'){
  if(kind==='boot'){modal({kind,title:'Connessione a FRAME',kicker:'ACCOUNT PERSONALE',intro:'La sincronizzazione usa il tuo nuovo Firebase.',body:authMarkup(kind)});return}
  modal({kind,title:kind==='register'?'Crea il tuo account':kind==='setup'?'Configura FRAME':'Bentornato su FRAME',kicker:'IL TUO SPAZIO PERSONALE',intro:kind==='setup'?'Puoi visualizzare la demo anche prima della configurazione.':'Accedi con la stessa email e password da qualsiasi dispositivo.',body:authMarkup(kind)});
  if(kind==='setup'){$('tryDemo').onclick=startDemo;return}
  $('switchAuth').onclick=()=>openAuth(kind==='register'?'login':'register');
  $('demoAuth').onclick=startDemo;
  $('resetPassword').onclick=async()=>{
    const email=$('authEmail').value.trim();if(!email){$('authError').textContent='Scrivi prima la tua email.';return}
    try{await state.sdk.auth.sendPasswordResetEmail(state.auth,email);toast('Se l’email è registrata, riceverai un link per reimpostare la password.')}catch(err){$('authError').textContent=showError(err)}
  };
  $('authForm').onsubmit=async e=>{
    e.preventDefault();const email=$('authEmail').value.trim();const pass=$('authPassword').value;
    $('authError').textContent='';$('authSubmit').disabled=true;
    try{if(kind==='register')await state.sdk.auth.createUserWithEmailAndPassword(state.auth,email,pass);
      else await state.sdk.auth.signInWithEmailAndPassword(state.auth,email,pass);
    }catch(err){$('authError').textContent=showError(err);$('authSubmit').disabled=false}
  };
}
async function startCloud(){
  if(!configured){sync('Da configurare','warn');openAuth('setup');return}
  sync('Connessione...','warn');openAuth('boot');
  try{
    const version='13.2.0';
    const [appMod,authMod,fs]=await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);
    state.sdk={auth:authMod,fs};const app=appMod.initializeApp(FIREBASE_CONFIG);
    state.auth=authMod.getAuth(app);
    try{state.db=fs.initializeFirestore(app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentMultipleTabManager()})});}
    catch(err){console.warn('Offline persistence non disponibile; uso cache in memoria.',err);state.db=fs.getFirestore(app)}
    authMod.onAuthStateChanged(state.auth,async user=>{
      stopListeners();state.user=user;
      if(!user){state.mode='startup';state.entries=[];state.categories=[];state.listenersReady=0;render();sync('Non connesso','warn');openAuth('login');return}
      state.mode='cloud';state.entries=[];state.categories=[];state.listenersReady=0;render();sync('Sincronizzazione...','warn');
      closeModal(true);
      try{await initProfileIfNeeded(user.uid);startListeners(user.uid)}catch(err){sync('Errore database','error');toast(showError(err),'error')}
    });
  }catch(err){console.error(err);sync('Errore connessione','error');modal({kind:'setup',title:'Connessione non riuscita',intro:'Controlla la connessione Internet, il file config.js e la guida.',body:`<div class="callout">${esc(showError(err))}</div><button class="accent-button" id="tryDemo">Prova la demo locale</button>`});$('tryDemo').onclick=startDemo;}
}
async function initProfileIfNeeded(uid){
  const fs=state.sdk.fs;const profile=fs.doc(state.db,'users',uid);
  const snap=await fs.getDoc(profile);
  if(!snap.exists()){
    const batch=fs.writeBatch(state.db);
    batch.set(profile,{initialized:true,createdMs:Date.now()});
    for(const cat of DEFAULT_CATEGORIES){const {id,...data}=cat;batch.set(fs.doc(state.db,'users',uid,'categories',id),data)}
    await batch.commit();
  }
}
function stopListeners(){for(const un of state.unsubs){try{un()}catch{}}state.unsubs=[]}
function startListeners(uid){
  const fs=state.sdk.fs;
  const onError=err=>{sync('Errore Firestore','error');toast(showError(err),'error')};
  state.unsubs.push(fs.onSnapshot(fs.collection(state.db,'users',uid,'entries'),{includeMetadataChanges:true},snap=>{
    if(state.user?.uid!==uid)return;
    state.entries=snap.docs.map(d=>({id:d.id,...d.data()}));
    state.listenersReady|=1;sync(snap.metadata.fromCache?'Cache locale':'Sincronizzato',snap.metadata.fromCache?'warn':'ok');render();
  },onError));
  state.unsubs.push(fs.onSnapshot(fs.collection(state.db,'users',uid,'categories'),{includeMetadataChanges:true},snap=>{
    if(state.user?.uid!==uid)return;
    state.categories=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name,'it'));
    state.listenersReady|=2;render();
  },onError));
}
async function logout(){
  if(state.mode==='demo'){state.mode='startup';state.entries=[];state.categories=[];render();sync('Non connesso','warn');openAuth(configured?'login':'setup');return}
  if(state.auth){try{await state.sdk.auth.signOut(state.auth)}catch(err){toast(showError(err),'error')}}
}
function bind(){
  $('openDrawer').onclick=openDrawer;$('closeDrawer').onclick=closeDrawer;$('drawerScrim').onclick=closeDrawer;
  $('statusNav').onclick=e=>{const btn=e.target.closest('[data-status]');if(btn)setStatus(btn.dataset.status)};
  $('categoryNav').onclick=e=>{const actions=e.target.closest('[data-category-actions]');if(actions){openManageCategories();return}const btn=e.target.closest('[data-category]');if(btn)setCategory(btn.dataset.category)};
  $('filterPills').onclick=e=>{const btn=e.target.closest('[data-category]');if(btn)setCategory(btn.dataset.category)};
  $('searchAll').oninput=e=>{state.query=e.target.value;render()};
  const srch=$('searchAll').closest('.header-search');srch.onclick=()=>srch.classList.add('expanded');
  $('searchAll').onblur=()=>{if(!$('searchAll').value)srch.classList.remove('expanded')};
  $('sortSelect').onchange=e=>{state.sort=e.target.value;render()};
  $('quickPlanned').onclick=()=>setStatus(state.status==='planned'?'all':'planned');
  $('heroBrowse').onclick=()=>$('library').scrollIntoView({behavior:'smooth'});
  $('addEntryBtn').onclick=()=>openEntry();$('emptyAdd').onclick=()=>openEntry();
  $('addCategorySide').onclick=()=>openCategory(null,'manage');$('manageCategories').onclick=openManageCategories;
  $('backupBtn').onclick=openBackup;$('aboutBtn').onclick=openAbout;$('footerCredits').onclick=e=>{e.preventDefault();openAbout()};
  $('logoutBtn').onclick=logout;$('userBtn').onclick=()=>state.mode==='cloud'?toast('Account: '+state.user.email):state.mode==='demo'?toast('Stai usando la demo locale.'):openAuth(configured?'login':'setup');
  $('libraryCards').onclick=e=>{const item=e.target.closest('[data-edit]');if(item)openEntry(item.dataset.edit)};
  $('libraryCards').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.media-card')){e.preventDefault();openEntry(e.target.dataset.edit)}};
  $('closeModal').onclick=()=>closeModal();$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();closeModal()}});
  window.addEventListener('online',()=>{if(state.mode==='cloud')sync('Riconnessione...','warn')});
  window.addEventListener('offline',()=>{if(state.mode==='cloud')sync('Offline / cache','warn')});
}
function bootstrap(){bind();render();startCloud();if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('PWA non disponibile',e)));}
bootstrap();
