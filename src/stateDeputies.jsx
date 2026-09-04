import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayTseValue } from './chamberProfile.jsx';

const BASE_URL = '/data/candidatos/deputado-estadual';
const DEFAULT_BATCH = 60;

const UF_NAMES = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo',
  GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará', PB:'Paraíba',
  PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul',
  RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
};
const REGIONS = {
  Norte: ['AC','AP','AM','PA','RO','RR','TO'],
  Nordeste: ['AL','BA','CE','MA','PB','PE','PI','RN','SE'],
  'Centro-Oeste': ['DF','GO','MT','MS'],
  Sudeste: ['ES','MG','RJ','SP'],
  Sul: ['PR','RS','SC'],
};

function normalize(value='') { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function displayName(candidate){return candidate?.nome_urna||candidate?.nome||'Candidato sem nome';}
function formatDate(value){if(!value)return'Aguardando atualização';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d);}
function initials(name=''){return name.split(/\s+/).filter(Boolean).slice(0,2).map((word)=>word[0]).join('').toUpperCase()||'?';}
function pageFile(page){return String(page).padStart(3,'0');}
function compareCandidates(a,b,sortBy){const byName=()=>displayName(a).localeCompare(displayName(b),'pt-BR',{sensitivity:'base'});if(sortBy==='numero')return String(a.numero||'').localeCompare(String(b.numero||''),'pt-BR',{numeric:true})||byName();if(sortBy==='partido')return String(a.partido||'').localeCompare(String(b.partido||''),'pt-BR',{sensitivity:'base'})||byName();return byName();}
async function fetchJson(url,signal){const response=await fetch(url,{cache:'no-cache',signal});if(!response.ok)throw new Error('Não foi possível carregar os dados estaduais.');return response.json();}

function ShareIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.7 15.7 8m-7.2 3.3 7.2 4.7M18 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM8 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>}
function Avatar({candidate}){const[failed,setFailed]=useState(false);const source=failed?'':candidate?.foto_url;return <div className="avatar" aria-hidden="true">{source?<img src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:initials(displayName(candidate))}</div>;}
function StateCandidateCard({candidate,onOpen,onShare,opening}){
  const situation=displayTseValue(candidate.situacao_candidatura);
  return <article className="candidate-card state-deputy-card"><button className="candidate-card-open" type="button" disabled={opening} onClick={(event)=>onOpen(candidate,event.currentTarget)} aria-label={`Abrir perfil de ${displayName(candidate)}`}><Avatar candidate={candidate}/><div className="candidate-main"><div className="candidate-topline"><span className="number">{candidate.numero||'—'}</span><span aria-hidden="true">·</span><span>{candidate.partido||'Partido não informado'}</span><span aria-hidden="true">·</span><span>{candidate.uf||'—'}</span></div><h3>{displayName(candidate)}</h3><p>{candidate.ocupacao||candidate.cargo||'Candidatura 2026'}</p><div className="candidate-card-meta">{situation&&<span className="candidate-status">{situation}</span>}</div></div><span className="candidate-profile-link" aria-hidden="true">{opening?'Abrindo…':'Ver perfil →'}</span></button><button className="candidate-share" type="button" onClick={()=>onShare(candidate)} aria-label={`Compartilhar perfil de ${displayName(candidate)}`}><ShareIcon/></button></article>;
}
function FilterChip({label,onRemove}){return <span className="filter-chip"><span>{label}</span><button type="button" onClick={onRemove} aria-label={`Remover filtro ${label}`}>×</button></span>;}
function UfGroupedOptions(){return <>{Object.entries(REGIONS).map(([region,ufs])=><optgroup key={region} label={region}>{ufs.map((item)=><option key={item} value={item}>{item} — {UF_NAMES[item]}</option>)}</optgroup>)}</>;}
function SkeletonState(){return <><div className="skeleton-strip" aria-hidden="true"/><div className="skeleton-list" aria-label="Carregando candidaturas estaduais">{Array.from({length:6},(_,i)=><div className="skeleton-card" key={i}/>)}</div></>;}

export default function StateDeputiesView({
  uf,setUf,query,setQuery,party,setParty,occupation,setOccupation,situation,setSituation,sortBy,setSortBy,profileId,onOpen,onShare,onProfileLoaded,onClearAll,
}){
  const[rootManifest,setRootManifest]=useState(null);
  const[manifest,setManifest]=useState(null);
  const[pages,setPages]=useState({});
  const[currentPage,setCurrentPage]=useState(0);
  const[index,setIndex]=useState(null);
  const[status,setStatus]=useState(uf?'loading':'needs-uf');
  const[indexStatus,setIndexStatus]=useState('idle');
  const[error,setError]=useState('');
  const[visibleCount,setVisibleCount]=useState(DEFAULT_BATCH);
  const[openingId,setOpeningId]=useState('');
  const[advancedOpen,setAdvancedOpen]=useState(Boolean(occupation||situation));
  const[searchFocused,setSearchFocused]=useState(false);
  const sentinelRef=useRef(null);
  const abortRef=useRef(null);
  const indexPromiseRef=useRef(null);
  const profileCacheRef=useRef(new Map());

  useEffect(()=>{const controller=new AbortController();fetchJson(`${BASE_URL}/manifest.json`,controller.signal).then(setRootManifest).catch(()=>{});return()=>controller.abort();},[]);

  useEffect(()=>{
    abortRef.current?.abort();indexPromiseRef.current=null;profileCacheRef.current.clear();setManifest(null);setPages({});setCurrentPage(0);setIndex(null);setIndexStatus('idle');setVisibleCount(DEFAULT_BATCH);setError('');
    if(!uf){setStatus('needs-uf');return undefined;}
    const controller=new AbortController();abortRef.current=controller;setStatus('loading');
    Promise.all([fetchJson(`${BASE_URL}/${uf}/manifest.json`,controller.signal),fetchJson(`${BASE_URL}/${uf}/cards/001.json`,controller.signal)]).then(([ufManifest,firstPage])=>{setManifest(ufManifest);setPages({1:firstPage});setCurrentPage(1);setStatus('ready');}).catch((fetchError)=>{if(fetchError.name!=='AbortError'){console.error(fetchError);setError('Não foi possível carregar os dados deste estado.');setStatus('error');}});
    return()=>controller.abort();
  },[uf]);

  const ensureIndex=useCallback(async()=>{
    if(!uf)return[];if(index)return index;if(indexPromiseRef.current)return indexPromiseRef.current;
    setIndexStatus('loading');const signal=abortRef.current?.signal;
    const promise=fetchJson(`${BASE_URL}/${uf}/search-index.json`,signal).then((payload)=>{setIndex(payload);setIndexStatus('ready');return payload;}).catch((fetchError)=>{if(fetchError.name!=='AbortError'){console.error(fetchError);setIndexStatus('error');setError('Não foi possível preparar a busca deste estado.');}throw fetchError;}).finally(()=>{indexPromiseRef.current=null;});
    indexPromiseRef.current=promise;return promise;
  },[uf,index]);

  const indexMode=Boolean(query.trim()||party||occupation||situation||sortBy!=='nome');
  useEffect(()=>{if(status==='ready'&&indexMode)ensureIndex().catch(()=>{});},[status,indexMode,ensureIndex]);
  useEffect(()=>setVisibleCount(DEFAULT_BATCH),[query,party,occupation,situation,sortBy,uf]);

  const filteredIndex=useMemo(()=>{
    if(!index)return[];const term=normalize(query.trim());
    return index.filter((candidate)=>{if(party&&candidate.partido!==party)return false;if(occupation&&candidate.ocupacao!==occupation)return false;if(situation&&displayTseValue(candidate.situacao_candidatura)!==situation)return false;if(!term)return true;return[candidate.nome,candidate.nome_urna,candidate.numero,candidate.partido,candidate.ocupacao].some((value)=>normalize(value).includes(term));}).sort((a,b)=>compareCandidates(a,b,sortBy));
  },[index,query,party,occupation,situation,sortBy]);
  const defaultCandidates=useMemo(()=>Object.keys(pages).map(Number).sort((a,b)=>a-b).flatMap((page)=>pages[page]||[]),[pages]);
  const visibleCandidates=indexMode?filteredIndex.slice(0,visibleCount):defaultCandidates;
  const totalResults=indexMode?(index?filteredIndex.length:manifest?.total||0):manifest?.total||0;
  const hasMore=indexMode?Boolean(index&&visibleCount<filteredIndex.length):Boolean(manifest&&currentPage<manifest.page_count);

  const loadNext=useCallback(async()=>{
    if(!hasMore||status!=='ready')return;
    if(indexMode){setVisibleCount((current)=>Math.min(current+DEFAULT_BATCH,filteredIndex.length));return;}
    const nextPage=currentPage+1;if(pages[nextPage]){setCurrentPage(nextPage);return;}
    try{const payload=await fetchJson(`${BASE_URL}/${uf}/cards/${pageFile(nextPage)}.json`,abortRef.current?.signal);setPages((current)=>({...current,[nextPage]:payload}));setCurrentPage(nextPage);}catch(fetchError){if(fetchError.name!=='AbortError'){console.error(fetchError);setError('Não foi possível carregar mais candidaturas.');}}
  },[hasMore,status,indexMode,filteredIndex.length,currentPage,pages,uf]);

  useEffect(()=>{if(!hasMore||typeof IntersectionObserver==='undefined')return undefined;const target=sentinelRef.current;if(!target)return undefined;const observer=new IntersectionObserver((entries)=>{if(entries[0]?.isIntersecting)loadNext();},{rootMargin:'650px 0px',threshold:.01});observer.observe(target);return()=>observer.disconnect();},[hasMore,loadNext]);

  const openFullProfile=useCallback(async(candidate,trigger,direct=false)=>{
    if(!candidate?.id_tse||!candidate?.pagina||!uf){if(direct)onProfileLoaded?.(candidate);else onOpen(candidate,trigger);return;}
    const cacheKey=`${uf}-${candidate.pagina}`;setOpeningId(String(candidate.id_tse));
    try{let chunk=profileCacheRef.current.get(cacheKey);if(!chunk){chunk=await fetchJson(`${BASE_URL}/${uf}/perfis/${pageFile(candidate.pagina)}.json`,abortRef.current?.signal);profileCacheRef.current.set(cacheKey,chunk);}const full=chunk.find((item)=>String(item.id_tse)===String(candidate.id_tse))||candidate;if(direct)onProfileLoaded?.(full);else onOpen(full,trigger);}catch(fetchError){if(fetchError.name!=='AbortError'){console.error(fetchError);if(direct)onProfileLoaded?.(candidate);else onOpen(candidate,trigger);}}finally{setOpeningId('');}
  },[uf,onOpen,onProfileLoaded]);

  useEffect(()=>{if(status!=='ready'||!uf||!profileId)return;let cancelled=false;ensureIndex().then((payload)=>{if(cancelled)return;const match=payload.find((item)=>String(item.id_tse)===String(profileId));if(match)openFullProfile(match,null,true);}).catch(()=>{});return()=>{cancelled=true;};},[status,uf,profileId,ensureIndex,openFullProfile]);

  const parties=manifest?.partidos||[];
  const occupations=manifest?.ocupacoes||[];
  const situations=useMemo(()=>[...new Set((index||defaultCandidates).map((item)=>displayTseValue(item.situacao_candidatura)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[index,defaultCandidates]);
  const suggestions=useMemo(()=>{const term=normalize(query.trim());if(term.length<2||!index)return[];return index.filter((item)=>normalize(displayName(item)).includes(term)||normalize(item.numero).includes(term)).slice(0,6);},[query,index]);
  const chips=[query.trim()?{key:'q',label:`Busca: ${query.trim()}`,remove:()=>setQuery('')}:null,uf?{key:'uf',label:uf,remove:()=>setUf('')}:null,party?{key:'party',label:party,remove:()=>setParty('')}:null,occupation?{key:'occupation',label:occupation,remove:()=>setOccupation('')}:null,situation?{key:'situation',label:situation,remove:()=>setSituation('')}:null].filter(Boolean);
  const summary=[query.trim()&&`“${query.trim()}”`,uf,party,occupation,situation].filter(Boolean).join(' · ');
  const selectedLabel=uf==='DF'?'Deputado Distrital':'Deputado Estadual';

  if(!uf){
    return <><div className="data-strip"><div className="data-strip-item"><strong>—</strong><span>candidaturas</span></div><div className="data-strip-item"><strong>Escolha uma UF</strong><span>circunscrição</span></div><div className="data-strip-item data-strip-update"><strong>Atualizado</strong><span>{formatDate(rootManifest?.generated_at_utc)}</span></div></div><section className="state-deputy-ux"><div className="state-uf-gate"><label><span>Estado</span><select value="" onChange={(event)=>setUf(event.target.value)}><option value="">Escolha uma UF</option><UfGroupedOptions/></select></label><p className="state-optimization-note"><strong>Escolha o estado para iniciar a consulta.</strong><br/>⚡ A plataforma carrega somente a base necessária para manter a navegação leve.</p></div></section></>;
  }

  return <>
    {status==='loading'?<SkeletonState/>:<div className="data-strip" aria-label="Resumo da consulta estadual"><div className="data-strip-item"><strong>{manifest?.total?.toLocaleString('pt-BR')||'—'}</strong><span>candidaturas</span></div><div className="data-strip-item"><strong>{uf}</strong><span>{UF_NAMES[uf]||'circunscrição'}</span></div><div className="data-strip-item"><strong>{parties.length.toLocaleString('pt-BR')}</strong><span>partidos</span></div><div className="data-strip-item data-strip-update"><strong>Atualizado</strong><span>{formatDate(manifest?.generated_at_utc||rootManifest?.generated_at_utc)}</span></div></div>}

    <section className="state-deputy-ux" aria-label="Busca e filtros estaduais">
      <div className="state-uf-gate"><label><span>Estado</span><select value={uf} onChange={(event)=>setUf(event.target.value)}><UfGroupedOptions/></select></label><p className="state-optimization-note"><strong>⚡ Consulta otimizada para grandes volumes.</strong><br/>Você pode trocar de estado sem carregar bases desnecessárias.</p></div>
      {status==='ready'&&<>
        <label className="primary-search-label" style={{marginTop:12}}><span>Buscar candidatura</span><div className="primary-search"><span className="primary-search-icon" aria-hidden="true">⌕</span><input type="search" value={query} placeholder="Nome, número, partido ou ocupação" autoComplete="off" role="combobox" aria-expanded={searchFocused&&suggestions.length>0} aria-controls="state-candidate-suggestions" onFocus={()=>{setSearchFocused(true);if(query.trim().length>=2)ensureIndex().catch(()=>{});}} onBlur={()=>setTimeout(()=>setSearchFocused(false),100)} onChange={(event)=>setQuery(event.target.value)}/>{query&&<button className="primary-search-clear" type="button" onClick={()=>setQuery('')} aria-label="Limpar busca">×</button>}{searchFocused&&suggestions.length>0&&<div id="state-candidate-suggestions" className="autocomplete-list" role="listbox">{suggestions.map((candidate)=><button key={candidate.id_tse} type="button" role="option" onMouseDown={(event)=>event.preventDefault()} onClick={()=>{setQuery(displayName(candidate));setSearchFocused(false);}}><strong>{displayName(candidate)}</strong><span>{candidate.numero||'—'} · {candidate.partido||'—'}</span></button>)}</div>}</div></label>
        <div className="filter-row"><label className="filter-field"><span>Partido</span><select value={party} onChange={(event)=>setParty(event.target.value)}><option value="">Todos</option>{parties.map((item)=><option key={item} value={item}>{item}</option>)}</select></label><button className="filter-more" type="button" aria-expanded={advancedOpen} aria-controls="state-advanced-filters" onClick={()=>{setAdvancedOpen((value)=>!value);if(!advancedOpen)ensureIndex().catch(()=>{});}}>+ Filtros{occupation||situation?' · ativo':''}</button><label className="filter-field filter-order"><span>Ordenação</span><select value={sortBy} onChange={(event)=>setSortBy(event.target.value)}><option value="nome">Nome A–Z</option><option value="numero">Número</option><option value="partido">Partido A–Z</option></select></label></div>
        {advancedOpen&&<div id="state-advanced-filters" className="advanced-filters"><label className="advanced-filter-field"><span>Ocupação</span><select value={occupation} onChange={(event)=>setOccupation(event.target.value)}><option value="">Todas</option>{occupations.map((item)=><option key={item} value={item}>{item}</option>)}</select></label><label className="advanced-filter-field"><span>Situação da candidatura</span><select value={situation} onChange={(event)=>setSituation(event.target.value)}><option value="">Todas</option>{situations.map((item)=><option key={item} value={item}>{item}</option>)}</select></label></div>}
        {chips.length>0&&<div className="filter-chips" aria-label="Filtros ativos">{chips.map((item)=><FilterChip key={item.key} label={item.label} onRemove={item.remove}/>)}<button className="clear-all-filters" type="button" onClick={onClearAll}>Limpar tudo</button></div>}
      </>}
    </section>

    {status==='error'&&<div className="state-shell"><div className="ux-state-card"><strong>Não foi possível carregar os dados deste estado.</strong><span>{error||'Tente novamente.'}</span><div className="ux-state-actions"><button className="primary" type="button" onClick={()=>window.location.reload()}>Tentar novamente</button></div></div></div>}
    {status==='ready'&&<><div className="results-heading"><div><span>RESULTADOS</span><h2>{selectedLabel}</h2></div><p>{totalResults.toLocaleString('pt-BR')} resultado(s){indexStatus==='loading'?' · preparando busca…':''}</p></div><section className="candidate-results" aria-live="polite">{indexMode&&indexStatus==='loading'?<div className="skeleton-list" style={{width:'100%',margin:'0 0 32px'}}>{Array.from({length:5},(_,i)=><div className="skeleton-card" key={i}/>)}</div>:visibleCandidates.length===0?<div className="ux-state-card"><strong>Nenhuma candidatura encontrada{summary?` para ${summary}`:''}.</strong><span>Remova um filtro ou limpe a consulta para ampliar os resultados.</span><div className="ux-state-actions">{party&&<button type="button" onClick={()=>setParty('')}>Remover partido</button>}{query&&<button type="button" onClick={()=>setQuery('')}>Remover busca</button>}<button className="primary" type="button" onClick={onClearAll}>Limpar todos os filtros</button></div></div>:<><div className="candidate-list">{visibleCandidates.map((candidate)=><StateCandidateCard key={candidate.id_tse} candidate={candidate} onOpen={openFullProfile} onShare={onShare} opening={openingId===String(candidate.id_tse)}/>)}</div><div ref={sentinelRef} aria-hidden="true" style={{height:1}}/>{hasMore&&typeof IntersectionObserver==='undefined'&&<div className="ux-state-actions" style={{marginTop:16}}><button type="button" onClick={loadNext}>Carregar mais</button></div>}</>}</section></>}
  </>;
}
