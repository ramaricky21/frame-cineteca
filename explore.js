/* TMDB: ricerca e scoperta, senza modificare il modello dati personale. */
const ROOT='https://api.themoviedb.org/3';

/* I generi di TMDB non hanno sempre lo stesso ID per film e serie TV. */
export const EXPLORE_GENRES=[
  {value:'',name:'Tutti i generi'},
  {value:'action',name:'Azione'}, {value:'adventure',name:'Avventura'},
  {value:'16',name:'Animazione'}, {value:'35',name:'Commedia'},
  {value:'80',name:'Crime'}, {value:'99',name:'Documentario'},
  {value:'18',name:'Drammatico'}, {value:'10751',name:'Famiglia'},
  {value:'fantasy',name:'Fantasy'}, {value:'scifi',name:'Fantascienza'},
  {value:'war',name:'Guerra'}, {value:'horror',name:'Horror'},
  {value:'9648',name:'Mistero'}, {value:'music',name:'Musicale'},
  {value:'romance',name:'Romance'}, {value:'history',name:'Storico'},
  {value:'thriller',name:'Thriller'}, {value:'western',name:'Western'}
];
const GENRES={
  '16':{movie:'16',tv:'16'},'35':{movie:'35',tv:'35'},
  '18':{movie:'18',tv:'18'},'80':{movie:'80',tv:'80'},
  '99':{movie:'99',tv:'99'},'9648':{movie:'9648',tv:'9648'},
  '10751':{movie:'10751',tv:'10751'},
  action:{movie:'28',tv:'10759'},adventure:{movie:'12',tv:'10759'},
  fantasy:{movie:'14',tv:'10765'},scifi:{movie:'878',tv:'10765'},
  war:{movie:'10752',tv:'10768'},western:{movie:'37',tv:'37'},
  horror:{movie:'27',tvKeywords:['horror']},
  history:{movie:'36',tvKeywords:['historical','period drama']},
  music:{movie:'10402',tvKeywords:['music','musical']},
  romance:{movie:'10749',tvKeywords:['romance','romantic comedy','love story']},
  thriller:{movie:'53',tvKeywords:['thriller']}
};
const TEXT_HINTS={
  romance:/romanc|romant|innamor|amore|relazion|love|dating|couple|affettiv/i,
  horror:/horror|terrore|spavent|paura|incubo|ghost|zombi|creatur|haunt/i,
  history:/stori|histor|epoca|period|secolo|medieval|dinasti/i,
  music:/music|musical|cant|band|sing|concerto|canzon/i,
  thriller:/thriller|suspense|suspens|tension|pericol|conspir/i
};
const keywordCache=new Map();
const pageCountCache=new Map();
const mediaItem=(r,media)=>({
  tmdbId:Number(r.id),tmdbMediaType:media,
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
  const url=new URL(ROOT+path);
  url.search=new URLSearchParams({...params,api_key:apiKey,language:'it-IT',include_adult:'false'}).toString();
  const response=await fetch(url,{headers:{Accept:'application/json'},signal});
  if(!response.ok)throw new Error(response.status===401?'La chiave TMDB non è valida.':`Errore TMDB (${response.status}). Riprova.`);
  const json=await response.json();
  return {results:Array.isArray(json.results)?json.results:[],totalPages:Math.min(500,Math.max(0,Number(json.total_pages)||0))};
}
/* Le serie TV non hanno un genere Romance ufficiale: usiamo keyword TMDB verificate. */
async function tvKeywords(apiKey,genre,signal){
  if(keywordCache.has(genre))return keywordCache.get(genre);
  const terms=GENRES[genre]?.tvKeywords||[];
  const results=await Promise.all(terms.map(async term=>{
    const answer=await requestTMDB(apiKey,'/search/keyword',{query:term,page:'1'},signal);
    return answer.results.filter(x=>String(x.name||'').toLowerCase().trim()===term).map(x=>Number(x.id)).filter(Number.isFinite);
  }));
  const ids=[...new Set(results.flat())];
  if(!ids.length)throw new Error('Non è stato possibile trovare il genere selezionato tra le parole chiave TMDB. Riprova.');
  keywordCache.set(genre,ids.join('|'));
  return ids.join('|');
}
async function requestForType(apiKey,filters,type,page,signal){
  const {query='',media='all',genre='',year='',sort='popularity.desc'}=filters;
  const isSearch=query.trim().length>0;
  const params={page:String(page)};
  if(isSearch)params.query=query.trim();
  else{
    params.sort_by=(sort==='date.desc')?(type==='movie'?'primary_release_date.desc':'first_air_date.desc'):
      (sort==='random'?'popularity.desc':sort);
    if(sort==='vote_average.desc')params['vote_count.gte']='100';
    if(year)params[type==='movie'?'primary_release_year':'first_air_date_year']=String(year);
    const rule=GENRES[genre];
    const genreId=rule?.[type]||'';
    if(genreId)params.with_genres=genreId;
    else if(type==='tv'&&rule?.tvKeywords)params.with_keywords=await tvKeywords(apiKey,genre,signal);
    if(media==='anime'){
      /* Virgola = AND, non OR: anime giapponesi del genere richiesto. */
      params.with_genres=genreId&&genreId!=='16'?`16,${genreId}`:'16';
      params.with_original_language='ja';
    }
  }
  const answer=await requestTMDB(apiKey,isSearch?`/search/${type}`:`/discover/${type}`,params,signal);
  let items=answer.results.map(r=>mediaItem(r,type)).filter(x=>x.title&&x.tmdbId>0);
  if(isSearch){
    if(year)items=items.filter(x=>x.year===String(year));
    const rule=GENRES[genre];
    if(rule){
      const genreId=rule[type];
      if(genreId)items=items.filter(x=>x.genreIds.includes(Number(genreId)));
      else if(type==='tv'&&rule.tvKeywords){
        const hint=TEXT_HINTS[genre];
        if(hint)items=items.filter(x=>hint.test(`${x.title} ${x.originalTitle} ${x.overview}`));
      }
    }
    if(media==='anime')items=items.filter(x=>x.genreIds.includes(16)&&x.originalLanguage==='ja');
  }
  return {items,totalPages:answer.totalPages};
}
const typesFor=(media)=>media==='movie'?['movie']:media==='tv'||media==='anime'?['tv']:['movie','tv'];
const itemKey=(item)=>item.tmdbMediaType+':'+item.tmdbId;
const shuffle=(items)=>{
  const copy=items.slice();
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
};
export async function browseTMDB(apiKey,filters,page=1,signal){
  const lists=await Promise.all(typesFor(filters.media).map(type=>requestForType(apiKey,filters,type,page,signal)));
  let items=lists.flatMap(x=>x.items);
  const sort=filters.sort||'popularity.desc';
  const comparison=sort==='vote_average.desc'?((a,b)=>b.score-a.score||b.voteCount-a.voteCount):
    sort==='date.desc'?((a,b)=>b.releaseDate.localeCompare(a.releaseDate)):
    ((a,b)=>b.popularity-a.popularity);
  items.sort(comparison);
  return {items,hasMore:lists.some(x=>page<x.totalPages)};
}
/* La modalità casuale pesca PAGINE diverse da TMDB, non rimescola soltanto gli stessi 20 titoli. */
export async function browseRandomTMDB(apiKey,filters,{seen=new Set(),usedPages=new Map()}={},signal){
  const types=typesFor(filters.media);
  const signature=JSON.stringify([filters.query,filters.media,filters.genre,filters.year]);
  const plans=await Promise.all(types.map(async type=>{
    const key=JSON.stringify([signature,type]);
    let totalPages=pageCountCache.get(key);
    let initial=null;
    if(totalPages===undefined){
      initial=await requestForType(apiKey,{...filters,sort:'random'},type,1,signal);
      totalPages=initial.totalPages;
      pageCountCache.set(key,totalPages);
    }
    return {type,totalPages:Math.min(totalPages,200),initial};
  }));
  const candidates=[];
  const taken=new Set(seen);
  const collect=(items)=>{
    for(const item of items){const key=itemKey(item);
      if(!taken.has(key)){candidates.push(item);taken.add(key);}
    }
  };
  /* Al primo accesso sfruttiamo anche la pagina iniziale già richiesta per conoscere il totale. */
  for(const plan of plans){
    if(plan.initial){
      collect(plan.initial.items);
      if(!usedPages.has(plan.type))usedPages.set(plan.type,new Set());
      usedPages.get(plan.type).add(1);
    }
  }
  /* Due pagine per tipologia, poi un ulteriore tentativo se i risultati nuovi scarseggiano. */
  for(let round=0;round<2;round++){
    if(round===1&&candidates.length>=20)break;
    const requests=[];
    for(const plan of plans){
      if(!plan.totalPages)continue;
      const history=usedPages.get(plan.type)||new Set();
      if(!usedPages.has(plan.type))usedPages.set(plan.type,history);
      let available=[];
      for(let p=1;p<=plan.totalPages;p++)if(!history.has(p))available.push(p);
      if(!available.length){history.clear();for(let p=1;p<=plan.totalPages;p++)available.push(p);}
      for(const page of shuffle(available).slice(0,round===0?2:1)){
        history.add(page);
        requests.push(requestForType(apiKey,{...filters,sort:'random'},plan.type,page,signal));
      }
    }
    const answers=await Promise.all(requests);
    answers.forEach(answer=>collect(answer.items));
  }
  /* Preferire le schede con locandina senza nascondere i titoli quando sono pochi. */
  const random=shuffle(candidates);
  const withPosters=random.filter(item=>item.posterPath);
  const withoutPosters=random.filter(item=>!item.posterPath);
  return {items:withPosters.concat(withoutPosters).slice(0,24)};
}
