/* FRAME: equivalenza delle opere e chiavi stabili, senza dipendenze esterne. */
export function normalizeWorkTitle(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('it').replace(/&/g,' e ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
export function mediaKind(item) {
  if (item?.tmdbMediaType === 'movie' || item?.tmdbMediaType === 'tv') return item.tmdbMediaType;
  if (item?.format === 'Film') return 'movie';
  if (item?.format === 'Serie TV') return 'tv';
  return ''; // Anime e Altro: il formato non identifica in modo certo film o serie.
}
export function sameWork(a,b) {
  if (!a || !b) return false;
  const aId=Number(a.tmdbId), bId=Number(b.tmdbId);
  const aKind=mediaKind(a), bKind=mediaKind(b);
  if (aId>0 && bId>0 && a.tmdbMediaType && b.tmdbMediaType)
    return aId===bId && a.tmdbMediaType===b.tmdbMediaType;
  if (aKind && bKind && aKind!==bKind) return false;
  const ay=String(a.year||'').match(/^\d{4}/)?.[0];
  const by=String(b.year||'').match(/^\d{4}/)?.[0];
  if (ay && by && ay!==by) return false;
  const namesA=[a.title,a.originalTitle].map(normalizeWorkTitle).filter(Boolean);
  const namesB=[b.title,b.originalTitle].map(normalizeWorkTitle).filter(Boolean);
  return namesA.some(n=>namesB.includes(n));
}
export function findDuplicate(entries,candidate,excludeId=null) {
  return entries.find(e=>e.id!==excludeId && sameWork(e,candidate)) || null;
}
export function duplicateGroups(entries) {
  const groups=[];
  for (const e of entries) {
    const existing=groups.find(g=>g.some(x=>sameWork(x,e)));
    if (existing) existing.push(e); else groups.push([e]);
  }
  return groups.filter(g=>g.length>1);
}
export function uniqueEntries(entries) {
  const uniques=[];
  for (const entry of entries) if (!findDuplicate(uniques,entry)) uniques.push(entry);
  return uniques;
}
export function changedFields(oldEntry,newEntry) {
  const fields=['title','year','format','status','ratingLabel','notes','categoryIds'];
  return fields.filter(f=>f==='categoryIds'
    ? JSON.stringify([...(oldEntry[f]||[])].sort())!==JSON.stringify([...(newEntry[f]||[])].sort())
    : String(oldEntry[f]??'')!==String(newEntry[f]??''));
}
// SHA-256 evita collisioni pratiche per titoli manuali, conservando doc ID corti in Firestore.
export async function workKey(item) {
  if (Number.isSafeInteger(Number(item.tmdbId)) && Number(item.tmdbId)>0 && ['movie','tv'].includes(item.tmdbMediaType))
    return `tmdb_${item.tmdbMediaType}_${Number(item.tmdbId)}`;
  const identity=`${mediaKind(item)||'other'}|${normalizeWorkTitle(item.title)}|${String(item.year||'').slice(0,4)}`;
  const bytes=new TextEncoder().encode(identity);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return 'manual_'+[...digest].map(n=>n.toString(16).padStart(2,'0')).join('');
}
