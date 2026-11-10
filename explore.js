/* TMDB: ricerca e scoperta, senza modificare il modello dati personale. */
const ROOT='https://api.themoviedb.org/3';
export const EXPLORE_GENRES=[
  {value:'',name:'Tutti i generi'},
  {value:'16',name:'Animazione'}, {value:'35',name:'Commedia'},
  {value:'18',name:'Drammatico'}, {value:'80',name:'Crime'},
  {value:'99',name:'Documentario'}, {value:'9648',name:'Mistero'},
  {value:'10751',name:'Famiglia'}
];
const mediaItem=(r,media)=>({
  tmdbId:Number(r.id),tmdbMediaType:r.media_type||media,
  title:r.title||r.name||r.original_title||r.original_name||'',
  originalTitle:r.original_title||r.original_name||'',
  year:String(r.release_date||r.first_air_date||'').slice(0,4),
  posterPath:r.poster_path||'',overview:r.overview||'',
  score:Number(r.vote_average)||0,voteCount:Number(r.vote_count)||0,
  genreIds:Array.isArray(r.genre_ids)?r.genre_ids:[],
  originalLanguage:r.original_language||'',popularity:Number(r.popularity)||0,
  releaseDate:r.release_date||r.first_air_date||''
});
async function requestTMDB(apiKey,path,params,signal){
  const url=new URL(ROOT+path);const p=new URLSearchParams({...params,api_key:apiKey,language:'it-IT',include_adult:'false'});
  url.search=p.toString();
  const response=await fetch(url,{headers:{Accept:'application/json'},signal});
  if(!response.ok)throw new Error(response.status===401?'La chiave TMDB non è valida.':`Errore TMDB (${response.status}). Riprova.`);
  const json=await response.json();return json.results||[];
}
export async function browseTMDB(apiKey,filters,page=1,signal){
  const {query='',media='all',genre='',year='',sort='popularity.desc'}=filters;
  const types=media==='movie'?['movie']:media==='tv'?['tv']:['movie','tv'];
  const isSearch=query.trim().length>0;
  const lists=await Promise.all(types.map(async type=>{
    let path=isSearch?`/search/${type}`:`/discover/${type}`;
    const params={page:String(page)};
    if(isSearch) params.query=query.trim();
    else {
      params.sort_by=sort==='date.desc'?(type==='movie'?'primary_release_date.desc':'first_air_date.desc'):sort;
      if(sort==='vote_average.desc')params['vote_count.gte']='100';
      if(year)params[type==='movie'?'primary_release_year':'first_air_date_year']=String(year);
      if(genre)params.with_genres=genre;
      if(media==='anime'){
        params.with_genres=genre&&genre!=='16'?`16|${genre}`:'16';
        params.with_original_language='ja';
      }
    }
    return (await requestTMDB(apiKey,path,params,signal)).map(r=>mediaItem(r,type));
  }));
  let items=lists.flat().filter(x=>x.title && x.tmdbId>0);
  if(isSearch){
    if(year)items=items.filter(x=>x.year===String(year));
    if(genre)items=items.filter(x=>x.genreIds.includes(Number(genre)));
    if(media==='anime')items=items.filter(x=>x.genreIds.includes(16)&&x.originalLanguage==='ja');
  }
  const comparison=sort==='vote_average.desc'?((a,b)=>b.score-a.score||b.voteCount-a.voteCount):
    sort==='date.desc'?((a,b)=>b.releaseDate.localeCompare(a.releaseDate)):
    ((a,b)=>b.popularity-a.popularity);
  items.sort(comparison);
  return {items,hasMore:lists.some(l=>l.length>=20)};
}
