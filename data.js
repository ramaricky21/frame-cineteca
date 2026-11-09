/** Funzioni pure: conversione voti, filtri, validazioni, export/import. */
export const DEFAULT_CATEGORIES = [
  { id: 'anime', name: 'Anime', color: '#c5a2f3' },
  { id: 'romance', name: 'Romance', color: '#f4a6bc' },
  { id: 'film', name: 'Film', color: '#f6bd73' },
  { id: 'serie-tv', name: 'Serie TV', color: '#79c8c1' },
  { id: 'fantasy', name: 'Fantasy / Isekai', color: '#91a5ed' }
];
export const STATUSES = [
  { id:'seen', label:'Già visti', short:'Visto', icon:'✓' },
  { id:'planned', label:'Da vedere', short:'Da vedere', icon:'◷' },
  { id:'watching', label:'In corso', short:'In corso', icon:'▷' },
  { id:'disliked', label:'Non mi piace', short:'Non mi piace', icon:'♡' }
];
export const FORMATS = ['Anime','Film','Serie TV','Live action','Altro'];
export const PALETTE = ['#c5a2f3','#f4a6bc','#f6bd73','#79c8c1','#91a5ed','#d9fc86','#f18f79','#a5b3f1'];

// '10 e lode', '9+', '9-', '8,5', '11/10' sono ammessi: il voto mostrato resta fedele,
// quello numerico viene usato per l'ordinamento (lode=+0,5, +/-=+/-0,25).
export function parseRating(value) {
  const label = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!label) return { score:null, label:'' };
  const lower = label.toLocaleLowerCase('it').replace(',', '.');
  const m = lower.match(/^(\d+(?:\.\d+)?)\s*(?:(e\s+lode|con\s+lode|lode)|([+-])|(?:\/\s*10))?$/);
  if (!m) throw new Error('Voto non valido. Esempi: 8,5 · 9+ · 10 e lode · 11/10.');
  const base = Number(m[1]);
  if (!Number.isFinite(base) || base < 0 || base > 100) throw new Error('Inserisci un voto compreso tra 0 e 100.');
  const extra = m[2] ? 0.5 : m[3] === '+' ? 0.25 : m[3] === '-' ? -0.25 : 0;
  return { score: base + extra, label: label.slice(0,24) };
}
export function sortedEntries(entries, sort='rating-desc') {
  return [...entries].sort((a,b)=> {
    if(sort==='title') return String(a.title).localeCompare(String(b.title),'it');
    if(sort==='recent') return (b.createdMs||0)-(a.createdMs||0);
    const av= typeof a.ratingScore==='number' ? a.ratingScore : (sort==='rating-asc'? Infinity:-Infinity);
    const bv= typeof b.ratingScore==='number' ? b.ratingScore : (sort==='rating-asc'? Infinity:-Infinity);
    return (sort==='rating-asc'? av-bv : bv-av) || String(a.title).localeCompare(String(b.title),'it');
  });
}
export function filteredEntries(entries,{status='all',category='all',query='',sort='rating-desc'}={}){
  const q=String(query).trim().toLocaleLowerCase('it');
  return sortedEntries(entries.filter(e=>(status==='all'||e.status===status)
    && (category==='all'||(Array.isArray(e.categoryIds)&&e.categoryIds.includes(category)))
    && (!q||[e.title,e.originalTitle,e.notes,e.year,e.format].some(x=>String(x??'').toLocaleLowerCase('it').includes(q)))),sort);
}
export function slugId(prefix='id'){
  if(globalThis.crypto?.randomUUID) return prefix+'-'+globalThis.crypto.randomUUID();
  return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
}
export function normalizeEntry(input){
  const title=String(input.title??'').trim().slice(0,180);
  if(!title) throw new Error('Inserisci il titolo.');
  const r=parseRating(input.ratingLabel ?? '');
  const status= STATUSES.some(s=>s.id===input.status)?input.status:'planned';
  return {
    title, originalTitle:String(input.originalTitle??'').trim().slice(0,180),
    year:String(input.year??'').trim().slice(0,12),
    format: FORMATS.includes(input.format)?input.format:'Altro',
    status, ratingLabel:r.label, ratingScore:r.score,
    categoryIds:[...new Set((Array.isArray(input.categoryIds)?input.categoryIds:[]).filter(x=>typeof x==='string'))].slice(0,80),
    notes:String(input.notes??'').trim().slice(0,3000),
    posterPath: typeof input.posterPath==='string'&&/^\/[A-Za-z0-9/_.-]{2,180}$/.test(input.posterPath)?input.posterPath:'',
    tmdbId:Number.isSafeInteger(Number(input.tmdbId))&&Number(input.tmdbId)>0?Number(input.tmdbId):null,
    tmdbMediaType:['movie','tv'].includes(input.tmdbMediaType)?input.tmdbMediaType:'',
    demoPoster:typeof input.demoPoster==='string'&&/^assets\/frame_mock_[a-z]+\.jpg$/.test(input.demoPoster)?input.demoPoster:'',
    createdMs:Number.isFinite(Number(input.createdMs))?Number(input.createdMs):Date.now()
  };
}
export function cleanCategory(input){
  const name=String(input.name??'').trim().slice(0,45);
  if(!name) throw new Error('Inserisci un nome per la categoria.');
  return {name, color:PALETTE.includes(input.color)?input.color:PALETTE[0]};
}
export function backupPayload(categories,entries){
  return {app:'FRAME',version:1,exportedAt:new Date().toISOString(),
    categories:categories.map(({id,name,color})=>({id,name,color})),
    entries:entries.map(({id,...data})=>({id,...normalizeEntry(data)}))};
}
export function validateBackup(payload){
  if(!payload||payload.app!=='FRAME'||payload.version!==1||!Array.isArray(payload.categories)||!Array.isArray(payload.entries)){
    throw new Error('File non valido: serve un backup JSON di FRAME (versione 1).');
  }
  if(payload.categories.length>1000||payload.entries.length>20000) throw new Error('Backup troppo grande.');
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
  const categories=payload.categories.map(c=>{if(!validId(c.id))throw new Error('ID categoria non valido.');return {id:c.id,...cleanCategory(c)};});
  const entries=payload.entries.map(e=>{if(!validId(e.id))throw new Error('ID titolo non valido.');return {id:e.id,...normalizeEntry(e)};});
  return {categories,entries};
}
