import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './photo.css';
import { ChamberActivity, chamberBasePhoto, displayTseValue } from './chamberProfile.jsx';
import StateDeputiesView from './stateDeputies.jsx';
import CampaignFinance from './campaignFinance.jsx';
import CandidateAssets from './candidateAssets.jsx';
import PlatformHeader from './PlatformHeader.jsx';

const REPOSITORY_URL = 'https://github.com/MSsanto/Elei-oes-2026';
const TSE_CANDIDATES_URL = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026';
const TSE_ACCOUNTS_URL = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026';
const CAMARA_URL = 'https://dadosabertos.camara.leg.br/';
const IDENTITY_URL = '/data/mappings/identidades.json';
const CHAMBER_HISTORY_URL = '/data/camara/historico_confirmados.json';
const RESULT_BATCH_SIZE = 60;

const UF_NAMES = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo',
  GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará', PB:'Paraíba',
  PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul',
  RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
};
const UFS = Object.keys(UF_NAMES);

export const CARGO_CONFIG = {
  presidente: {
    slug:'presidente', label:'Presidente', kicker:'CANDIDATURAS À PRESIDÊNCIA', scopeLabel:'Brasil', requiresUf:false, supportsUf:false, hasChamber:false,
    dataUrl:()=>'/data/candidatos/presidente/brasil.json', metaUrl:'/data/candidatos/presidente/manifest.json',
  },
  governador: {
    slug:'governador', label:'Governador', kicker:'CANDIDATURAS A GOVERNADOR', scopeLabel:'UF selecionada', requiresUf:true, supportsUf:true, hasChamber:false,
    dataUrl:(uf)=>`/data/candidatos/governador/${uf}.json`, metaUrl:'/data/candidatos/governador/manifest.json',
  },
  senador: {
    slug:'senador', label:'Senador', kicker:'CANDIDATURAS AO SENADO', scopeLabel:'UF selecionada', requiresUf:true, supportsUf:true, hasChamber:false,
    dataUrl:(uf)=>`/data/candidatos/senador/${uf}.json`, metaUrl:'/data/candidatos/senador/manifest.json',
  },
  'deputado-federal': {
    slug:'deputado-federal', label:'Deputado Federal', kicker:'CANDIDATURAS À CÂMARA', scopeLabel:'Brasil por UF', requiresUf:false, supportsUf:true, hasChamber:true,
    dataUrl:()=>'/data/deputados_federais.json', metaUrl:'/data/metadata.json',
  },
  'deputado-estadual': {
    slug:'deputado-estadual', label:'Deputado Estadual / Distrital', kicker:'CANDIDATURAS ÀS ASSEMBLEIAS E CLDF', scopeLabel:'UF selecionada', requiresUf:true, supportsUf:true, hasChamber:false, paged:true,
  },
};

function normalize(value='') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function displayName(candidate) { return candidate?.nome_urna || candidate?.nome || 'Candidato sem nome'; }
function uniqueSorted(items, field) {
  return [...new Set(items.map((item)=>item?.[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'}));
}
function formatDate(value) {
  if (!value) return 'Aguardando atualização';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(date);
}
function formatBirthDate(value) {
  if (!value) return '';
  const parts=String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(parts) return value;
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date);
}
function getProfileId() {
  const match = window.location.pathname.match(/^\/candidato\/([^/]+)\/?$/);
  if (match) return decodeURIComponent(match[1]);
  return new URLSearchParams(window.location.search).get('candidato') || '';
}
function readLocation() {
  const params = new URLSearchParams(window.location.search);
  const rawCargo = params.get('cargo') || 'deputado-federal';
  const cargo = CARGO_CONFIG[rawCargo] ? rawCargo : 'deputado-federal';
  return {
    cargo,
    query: params.get('q') || '',
    uf: params.get('uf') || '',
    party: params.get('partido') || '',
    occupation: params.get('ocupacao') || '',
    situation: params.get('situacao') || '',
    education: params.get('instrucao') || '',
    sortBy: params.get('ordenacao') || 'nome',
    tab: params.get('aba') || 'resumo',
    profileId: getProfileId(),
  };
}
function setSearchParam(url, key, value) {
  if (value === null || value === undefined || value === '' || (key === 'ordenacao' && value === 'nome')) url.searchParams.delete(key);
  else url.searchParams.set(key, String(value));
}
function buildListUrl(state) {
  const url = new URL('/', window.location.origin);
  setSearchParam(url,'cargo',state.cargo);
  setSearchParam(url,'q',state.query?.trim());
  setSearchParam(url,'uf',state.uf);
  setSearchParam(url,'partido',state.party);
  setSearchParam(url,'ocupacao',state.occupation);
  setSearchParam(url,'situacao',state.situation);
  setSearchParam(url,'instrucao',state.education);
  setSearchParam(url,'ordenacao',state.sortBy);
  return url;
}
function buildProfileUrl(candidate, state) {
  const url = buildListUrl(state);
  url.pathname = `/candidato/${encodeURIComponent(candidate.id_tse)}`;
  return url;
}
function updateMeta(title, description, canonicalUrl) {
  document.title = title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = description;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;
}
async function requiredJson(url, signal) {
  const response=await fetch(url,{cache:'no-cache',signal});
  if(!response.ok) throw new Error(`Falha ao carregar ${url}`);
  return response.json();
}
async function optionalJson(url, signal) {
  try {
    const response=await fetch(url,{cache:'no-cache',signal});
    return response.ok ? await response.json() : null;
  } catch(error) {
    if(error.name==='AbortError') throw error;
    return null;
  }
}
function attachOfficialSources(candidates, identityPayload, historyPayload) {
  const identityRecords=Array.isArray(identityPayload?.records)?identityPayload.records:[];
  const byTseId=new Map();
  identityRecords.forEach((item)=>(item.tse_sq_candidato||[]).forEach((id)=>byTseId.set(String(id),item)));
  const chamberHistory=historyPayload?.deputados||{};
  return candidates.map((candidate)=>{
    const identity=byTseId.get(String(candidate.id_tse))||null;
    const chamberId=identity?.correspondencia_status==='confirmada' ? identity.camara_id_deputado?.[0] : null;
    return {...candidate,cargo:candidate.cargo||'Deputado Federal',identidade_camara:identity,camara_base:chamberId?chamberHistory[String(chamberId)]||null:null};
  });
}
async function loadCargo(cargo, uf, signal) {
  const config=CARGO_CONFIG[cargo];
  if(config.requiresUf && !uf) return {candidates:[],metadata:await optionalJson(config.metaUrl,signal),needsUf:true};
  if(config.hasChamber) {
    const [raw,metadata,identity,history]=await Promise.all([
      requiredJson(config.dataUrl(uf),signal), optionalJson(config.metaUrl,signal), optionalJson(IDENTITY_URL,signal), optionalJson(CHAMBER_HISTORY_URL,signal),
    ]);
    return {candidates:attachOfficialSources(Array.isArray(raw)?raw:[],identity,history),metadata,needsUf:false};
  }
  const [raw,metadata]=await Promise.all([requiredJson(config.dataUrl(uf),signal),optionalJson(config.metaUrl,signal)]);
  return {candidates:(Array.isArray(raw)?raw:[]).map((item)=>({...item,cargo:item.cargo||config.label})),metadata,needsUf:false};
}

function ShareIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.7 15.7 8m-7.2 3.3 7.2 4.7M18 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM8 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>}
function initials(name=''){return name.split(/\s+/).filter(Boolean).slice(0,2).map((word)=>word[0]).join('').toUpperCase()||'?';}

export function CandidateAvatar({candidate,large=false}){
  const sources=[candidate?.foto_url,chamberBasePhoto(candidate)].filter(Boolean);
  const [index,setIndex]=useState(0);
  const source=sources[index];
  return (
    <div className={`avatar${large?' avatar-large':''}`} aria-hidden="true">
      {source?<img src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setIndex((value)=>value+1)}/>:initials(displayName(candidate))}
    </div>
  );
}

function CandidateCard({candidate,config,onOpen,onShare}){
  const situation=displayTseValue(candidate.situacao_candidatura);
  const hasHistory=candidate.identidade_camara?.historico_camara_localizado===true;
  return (
    <article className={`candidate-card${hasHistory?' has-chamber-history':''}`}>
      <button className="candidate-card-open" type="button" onClick={(event)=>onOpen(candidate,event.currentTarget)} aria-label={`Abrir perfil de ${displayName(candidate)}`}>
        <CandidateAvatar candidate={candidate}/>
        <div className="candidate-main">
          <div className="candidate-topline"><span className="number">{candidate.numero||'—'}</span><span aria-hidden="true">·</span><span className="party">{candidate.partido||'Partido não informado'}</span><span aria-hidden="true">·</span><span className="uf">{candidate.uf||(config.slug==='presidente'?'BR':'—')}</span></div>
          <h3>{displayName(candidate)}</h3>
          <p>{candidate.ocupacao || (candidate.nome&&candidate.nome!==candidate.nome_urna?candidate.nome:(candidate.cargo||config.label))}</p>
          <div className="candidate-card-meta">
            {situation&&<span className="candidate-status">{situation}</span>}
            {hasHistory&&<span className="candidate-history">✓ Histórico parlamentar</span>}
          </div>
        </div>
        <span className="candidate-profile-link" aria-hidden="true">Ver perfil →</span>
      </button>
      <button className="candidate-share" type="button" onClick={()=>onShare(candidate)} aria-label={`Compartilhar perfil de ${displayName(candidate)}`}><ShareIcon/></button>
    </article>
  );
}

function SkeletonResults() {
  return <><div className="skeleton-strip" aria-hidden="true"/><div className="skeleton-list" aria-label="Carregando resultados">{Array.from({length:6},(_,i)=><div className="skeleton-card" key={i}/>)}</div></>;
}

function DataStrip({count,scope,parties,updated,loading=false}) {
  if (loading) return <div className="skeleton-strip" aria-hidden="true"/>;
  return (
    <div className="data-strip" aria-label="Resumo da consulta">
      <div className="data-strip-item"><strong>{Number(count||0).toLocaleString('pt-BR')}</strong><span>candidaturas</span></div>
      <div className="data-strip-item"><strong>{scope}</strong><span>circunscrição</span></div>
      <div className="data-strip-item"><strong>{Number(parties||0).toLocaleString('pt-BR')}</strong><span>partidos</span></div>
      <div className="data-strip-item data-strip-update"><strong>Atualizado</strong><span>{formatDate(updated)}</span></div>
    </div>
  );
}

function CandidateProfile({candidate,config,onClose,onShare,returnFocusRef}) {
  const initialTab = new URLSearchParams(window.location.search).get('aba') || 'resumo';
  const identity=candidate?.identidade_camara;
  const confirmed=config.hasChamber&&identity?.correspondencia_status==='confirmada';
  const availableTabs = useMemo(()=>[
    {id:'resumo',label:'Resumo'},
    {id:'patrimonio',label:'Patrimônio'},
    {id:'financas',label:'Finanças'},
    ...(confirmed?[{id:'camara',label:'Atuação parlamentar'}]:[]),
  ],[confirmed]);
  const [tab,setTab]=useState(availableTabs.some((item)=>item.id===initialTab)?initialTab:'resumo');
  const dialogRef=useRef(null);
  const closeRef=useRef(null);
  const tabRefs=useRef([]);

  useEffect(()=>{
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    requestAnimationFrame(()=>closeRef.current?.focus());
    function onKey(event){
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab') return;
      const focusable=[...dialogRef.current?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')||[]].filter((node)=>!node.hasAttribute('hidden'));
      if(!focusable.length)return;
      const first=focusable[0]; const last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    window.addEventListener('keydown',onKey);
    return()=>{
      window.removeEventListener('keydown',onKey);
      document.body.style.overflow=previousOverflow;
      requestAnimationFrame(()=>returnFocusRef.current?.focus?.());
    };
  },[onClose,returnFocusRef]);

  useEffect(()=>{
    const url=new URL(window.location.href);
    setSearchParam(url,'aba',tab==='resumo'?'':tab);
    window.history.replaceState(window.history.state,'',url);
  },[tab]);

  useEffect(()=>{
    updateMeta(
      `${displayName(candidate)} | Eleições 2026`,
      `Perfil de candidatura de ${displayName(candidate)} com dados públicos organizados e fontes identificadas.`,
      window.location.href,
    );
  },[candidate]);

  function onTabsKeyDown(event,index){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    let next=index;
    if(event.key==='ArrowRight')next=(index+1)%availableTabs.length;
    if(event.key==='ArrowLeft')next=(index-1+availableTabs.length)%availableTabs.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=availableTabs.length-1;
    setTab(availableTabs[next].id);
    requestAnimationFrame(()=>tabRefs.current[next]?.focus());
  }

  const status=displayTseValue(candidate.situacao_candidatura);
  const humanRows=[
    ['Situação da candidatura',status],['Partido',candidate.partido],['Número',candidate.numero],['Ocupação',candidate.ocupacao],['Escolaridade',candidate.grau_instrucao],['Data de nascimento',formatBirthDate(candidate.data_nascimento)],['UF',candidate.uf],['Nome completo',candidate.nome],['Nome de urna',candidate.nome_urna],['Gênero',candidate.genero],['Cor/raça declarada',candidate.cor_raca],
  ].filter(([,value])=>value!==null&&value!==undefined&&value!=='');

  return (
    <div className="profile-route" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}>
      <section ref={dialogRef} className="profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="profile-top-actions">
          <button className="profile-back" type="button" onClick={onClose}>‹ Voltar para {config.label}</button>
          <button ref={closeRef} className="profile-close" type="button" onClick={onClose} aria-label="Fechar perfil">×</button>
        </div>
        <nav className="profile-breadcrumb" aria-label="Breadcrumb"><a href="/">Início</a><span aria-hidden="true">›</span><a href={buildListUrl({...readLocation(),cargo:config.slug}).toString()}>{config.label}</a><span aria-hidden="true">›</span><strong>{displayName(candidate)}</strong></nav>
        <header className="profile-header">
          <CandidateAvatar candidate={candidate} large/>
          <div>
            <div className="candidate-topline"><span className="number">{candidate.numero||'—'}</span><span aria-hidden="true">·</span><span>{candidate.partido||'—'}</span><span aria-hidden="true">·</span><span>{candidate.uf||(config.slug==='presidente'?'BR':'—')}</span></div>
            <h2 id="profile-title">{displayName(candidate)}</h2>
            <p>{candidate.cargo||config.label} · candidatura 2026</p>
            <div className="profile-head-status">{status&&<span>{status}</span>}{confirmed&&<span className="confirmed">✓ Vínculo parlamentar confirmado</span>}{candidate.ultima_atualizacao_tse&&<span>Fonte eleitoral: {candidate.ultima_atualizacao_tse}</span>}</div>
          </div>
          <button className="profile-share-button" type="button" onClick={()=>onShare(candidate)}><ShareIcon/> Compartilhar</button>
        </header>

        <div className="profile-tabs-new" role="tablist" aria-label="Seções do perfil">
          {availableTabs.map((item,index)=><button key={item.id} ref={(node)=>{tabRefs.current[index]=node;}} id={`tab-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls={`panel-${item.id}`} tabIndex={tab===item.id?0:-1} onKeyDown={(event)=>onTabsKeyDown(event,index)} onClick={()=>setTab(item.id)}>{item.label}</button>)}
        </div>

        {tab==='resumo'&&(
          <section id="panel-resumo" className="profile-tabpanel" role="tabpanel" aria-labelledby="tab-resumo" tabIndex={0}>
            <dl className="profile-summary-grid">{humanRows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <div className="profile-method-card">
              <strong>Fonte e atualização</strong>
              <p>Dados de candidatura são apresentados conforme a carga pública identificada pelo projeto. Informações patrimoniais usam o arquivo de bens de candidatos e informações financeiras usam a prestação de contas eleitoral. Dados parlamentares só aparecem quando a correspondência entre fontes atende aos critérios documentados.</p>
              <div className="profile-method-links"><a href={TSE_CANDIDATES_URL} target="_blank" rel="noreferrer">Candidaturas e bens — TSE ↗</a><a href={TSE_ACCOUNTS_URL} target="_blank" rel="noreferrer">Prestação de contas — TSE ↗</a>{confirmed&&<a href={CAMARA_URL} target="_blank" rel="noreferrer">Dados Abertos — Câmara ↗</a>}<a href="/metodologia">Como tratamos esses dados?</a></div>
            </div>
            <details className="profile-technical-details">
              <summary>Identificadores e campos técnicos</summary>
              <div className="profile-technical-body"><div><span>Identificador TSE</span><code>{candidate.id_tse||'—'}</code></div>{identity?.correspondencia_status&&<div><span>Status de associação com Câmara</span><code>{identity.correspondencia_status}</code></div>}{identity?.camara_id_deputado?.[0]&&<div><span>ID Câmara</span><code>{identity.camara_id_deputado[0]}</code></div>}</div>
            </details>
          </section>
        )}
        {tab==='patrimonio'&&<section id="panel-patrimonio" className="profile-tabpanel" role="tabpanel" aria-labelledby="tab-patrimonio" tabIndex={0}><CandidateAssets candidate={candidate}/></section>}
        {tab==='financas'&&<section id="panel-financas" className="profile-tabpanel" role="tabpanel" aria-labelledby="tab-financas" tabIndex={0}><CampaignFinance candidate={candidate}/></section>}
        {tab==='camara'&&confirmed&&<section id="panel-camara" className="profile-tabpanel" role="tabpanel" aria-labelledby="tab-camara" tabIndex={0}><ChamberActivity candidate={candidate} identity={identity}/></section>}
      </section>
    </div>
  );
}

function FilterChip({label,onRemove}) {
  return <span className="filter-chip"><span>{label}</span><button type="button" onClick={onRemove} aria-label={`Remover filtro ${label}`}>×</button></span>;
}

function SearchControl({value,onChange,disabled,candidates}) {
  const [focused,setFocused]=useState(false);
  const suggestions=useMemo(()=>{
    const term=normalize(value.trim());
    if(term.length<2)return[];
    return candidates.filter((candidate)=>normalize(displayName(candidate)).includes(term)||normalize(candidate.numero).includes(term)).slice(0,6);
  },[value,candidates]);
  return (
    <label className="primary-search-label">
      <span>Buscar candidatura</span>
      <div className="primary-search">
        <span className="primary-search-icon" aria-hidden="true">⌕</span>
        <input type="search" value={value} disabled={disabled} placeholder="Nome, número, partido ou ocupação" autoComplete="off" role="combobox" aria-expanded={focused&&suggestions.length>0} aria-controls="candidate-suggestions" onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),100)} onChange={(event)=>onChange(event.target.value)}/>
        {value&&<button className="primary-search-clear" type="button" onClick={()=>onChange('')} aria-label="Limpar busca">×</button>}
        {focused&&suggestions.length>0&&<div id="candidate-suggestions" className="autocomplete-list" role="listbox">{suggestions.map((candidate)=><button key={candidate.id_tse} type="button" role="option" onMouseDown={(event)=>event.preventDefault()} onClick={()=>{onChange(displayName(candidate));setFocused(false);}}><strong>{displayName(candidate)}</strong><span>{candidate.numero||'—'} · {candidate.partido||'—'}{candidate.uf?` · ${candidate.uf}`:''}</span></button>)}</div>}
      </div>
    </label>
  );
}

function UfOptions({includeAll=true}) {
  return <>{includeAll&&<option value="">Todas as UFs</option>}{UFS.map((item)=><option key={item} value={item}>{item} — {UF_NAMES[item]}</option>)}</>;
}

function compareCandidates(a,b,sortBy){
  const byName=()=>displayName(a).localeCompare(displayName(b),'pt-BR',{sensitivity:'base'});
  if(sortBy==='numero')return String(a.numero||'').localeCompare(String(b.numero||''),'pt-BR',{numeric:true})||byName();
  if(sortBy==='partido')return String(a.partido||'').localeCompare(String(b.partido||''),'pt-BR',{sensitivity:'base'})||byName();
  return byName();
}

export default function ConsultationApp(){
  const initial=useMemo(()=>readLocation(),[]);
  const [cargo,setCargo]=useState(initial.cargo);
  const [query,setQuery]=useState(initial.query);
  const [uf,setUf]=useState(initial.uf);
  const [party,setParty]=useState(initial.party);
  const [occupation,setOccupation]=useState(initial.occupation);
  const [situation,setSituation]=useState(initial.situation);
  const [education,setEducation]=useState(initial.education);
  const [sortBy,setSortBy]=useState(initial.sortBy);
  const [profileId,setProfileId]=useState(initial.profileId);
  const [advancedOpen,setAdvancedOpen]=useState(Boolean(initial.occupation||initial.situation||initial.education));
  const [candidates,setCandidates]=useState([]);
  const [metadata,setMetadata]=useState(null);
  const [status,setStatus]=useState(CARGO_CONFIG[initial.cargo].paged?'custom':'loading');
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [visibleCount,setVisibleCount]=useState(RESULT_BATCH_SIZE);
  const [shareNotice,setShareNotice]=useState('');
  const lastTriggerRef=useRef(null);
  const config=CARGO_CONFIG[cargo];

  const locationState=useCallback(()=>({cargo,query,uf,party,occupation,situation,education,sortBy}),[cargo,query,uf,party,occupation,situation,education,sortBy]);

  useEffect(()=>{
    const title=`${config.label} | Eleições 2026`;
    updateMeta(title,`Consulta pública de candidaturas a ${config.label} com dados e fontes identificadas.`,buildListUrl(locationState()).toString());
  },[config.label,locationState]);

  useEffect(()=>{
    function syncFromHistory(event){
      const next=readLocation();
      setCargo(next.cargo); setQuery(next.query); setUf(next.uf); setParty(next.party); setOccupation(next.occupation); setSituation(next.situation); setEducation(next.education); setSortBy(next.sortBy); setProfileId(next.profileId);
      setAdvancedOpen(Boolean(next.occupation||next.situation||next.education));
      if(!next.profileId)setSelected(null);
      if(!next.profileId&&Number.isFinite(event.state?.listScrollY))requestAnimationFrame(()=>window.scrollTo({top:event.state.listScrollY,behavior:'auto'}));
    }
    window.addEventListener('popstate',syncFromHistory);
    return()=>window.removeEventListener('popstate',syncFromHistory);
  },[]);

  useEffect(()=>{
    const url=new URL(window.location.href);
    setSearchParam(url,'cargo',cargo); setSearchParam(url,'q',query.trim()); setSearchParam(url,'uf',uf); setSearchParam(url,'partido',party); setSearchParam(url,'ocupacao',occupation); setSearchParam(url,'situacao',situation); setSearchParam(url,'instrucao',education); setSearchParam(url,'ordenacao',sortBy);
    window.history.replaceState(window.history.state,'',url);
  },[cargo,query,uf,party,occupation,situation,education,sortBy]);

  useEffect(()=>{
    if(config.paged){setCandidates([]);setMetadata(null);setStatus('custom');setError('');return undefined;}
    const controller=new AbortController();
    setCandidates([]);setMetadata(null);setSelected(null);setVisibleCount(RESULT_BATCH_SIZE);setError('');
    if(config.requiresUf&&!uf){setStatus('needs-uf');optionalJson(config.metaUrl,controller.signal).then(setMetadata).catch(()=>{});return()=>controller.abort();}
    setStatus('loading');
    loadCargo(cargo,uf,controller.signal).then((payload)=>{setCandidates(payload.candidates);setMetadata(payload.metadata);setStatus(payload.needsUf?'needs-uf':'ready');}).catch((loadError)=>{if(loadError.name!=='AbortError'){console.error(loadError);setError('Não foi possível carregar os dados desta consulta.');setStatus('error');}});
    return()=>controller.abort();
  },[cargo,uf,config]);

  useEffect(()=>{
    if(config.paged||status!=='ready'||!profileId)return;
    const match=candidates.find((candidate)=>String(candidate.id_tse)===String(profileId));
    setSelected(match||null);
  },[config.paged,status,profileId,candidates]);

  useEffect(()=>setVisibleCount(RESULT_BATCH_SIZE),[cargo,uf,party,occupation,situation,education,query,sortBy]);

  const parties=useMemo(()=>uniqueSorted(candidates,'partido'),[candidates]);
  const occupations=useMemo(()=>uniqueSorted(candidates,'ocupacao'),[candidates]);
  const situations=useMemo(()=>[...new Set(candidates.map((item)=>displayTseValue(item.situacao_candidatura)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[candidates]);
  const educations=useMemo(()=>uniqueSorted(candidates,'grau_instrucao'),[candidates]);
  const filtered=useMemo(()=>{
    const term=normalize(query.trim());
    return candidates.filter((candidate)=>{
      if(cargo==='deputado-federal'&&uf&&candidate.uf!==uf)return false;
      if(party&&candidate.partido!==party)return false;
      if(occupation&&candidate.ocupacao!==occupation)return false;
      if(situation&&displayTseValue(candidate.situacao_candidatura)!==situation)return false;
      if(education&&candidate.grau_instrucao!==education)return false;
      if(!term)return true;
      return[candidate.nome,candidate.nome_urna,candidate.numero,candidate.partido,candidate.ocupacao].some((value)=>normalize(value).includes(term));
    }).sort((a,b)=>compareCandidates(a,b,sortBy));
  },[candidates,cargo,uf,party,occupation,situation,education,query,sortBy]);
  const visible=filtered.slice(0,visibleCount);
  const hasMore=visibleCount<filtered.length;
  const recordCount=metadata?.records??metadata?.total??candidates.length;
  const updated=metadata?.generated_at_utc||metadata?.gerado_em_utc||metadata?.updated_at;

  function changeCargo(next){
    if(!CARGO_CONFIG[next]||next===cargo)return;
    const nextConfig=CARGO_CONFIG[next];
    const nextState={cargo:next,query:'',uf:nextConfig.supportsUf?uf:'',party:'',occupation:'',situation:'',education:'',sortBy:'nome'};
    window.history.pushState({listScrollY:0},'',buildListUrl(nextState));
    setCargo(next);setQuery('');setParty('');setOccupation('');setSituation('');setEducation('');setSortBy('nome');setSelected(null);setProfileId('');setAdvancedOpen(false);
    if(!nextConfig.supportsUf)setUf('');
    window.scrollTo({top:0,behavior:'auto'});
  }

  function openCandidate(candidate,trigger){
    if(trigger)lastTriggerRef.current=trigger;
    window.history.replaceState({...window.history.state,listScrollY:window.scrollY},'',window.location.href);
    const url=buildProfileUrl(candidate,locationState());
    window.history.pushState({profileFromList:true},'',url);
    setProfileId(String(candidate.id_tse));
    setSelected(candidate);
  }
  function closeCandidate(){
    if(window.history.state?.profileFromList){window.history.back();return;}
    const url=buildListUrl(locationState());
    window.history.pushState({listScrollY:0},'',url);
    setProfileId('');setSelected(null);
    requestAnimationFrame(()=>lastTriggerRef.current?.focus?.());
  }
  async function shareCandidate(candidate){
    const url=buildProfileUrl(candidate,locationState()).toString();
    const shareData={title:`${displayName(candidate)} — Eleições 2026`,text:`${displayName(candidate)} — ${candidate.cargo||config.label}${candidate.partido?` · ${candidate.partido}`:''}.`,url};
    if(navigator.share){try{await navigator.share(shareData);return;}catch(shareError){if(shareError?.name==='AbortError')return;}}
    try{await navigator.clipboard.writeText(url);setShareNotice('Link do perfil copiado.');setTimeout(()=>setShareNotice(''),2200);}catch{window.open(`https://wa.me/?text=${encodeURIComponent(`${shareData.text}\n${url}`)}`,'_blank','noopener,noreferrer');}
  }
  function clearAll(){setQuery('');setUf('');setParty('');setOccupation('');setSituation('');setEducation('');setSortBy('nome');}

  const filterChips=[
    query.trim()?{key:'q',label:`Busca: ${query.trim()}`,remove:()=>setQuery('')}:null,
    uf?{key:'uf',label:uf,remove:()=>setUf('')}:null,
    party?{key:'party',label:party,remove:()=>setParty('')}:null,
    occupation?{key:'occupation',label:occupation,remove:()=>setOccupation('')}:null,
    situation?{key:'situation',label:situation,remove:()=>setSituation('')}:null,
    education?{key:'education',label:education,remove:()=>setEducation('')}:null,
  ].filter(Boolean);
  const activeFilterSummary=[query.trim()&&`“${query.trim()}”`,uf,party,occupation,situation,education].filter(Boolean).join(' · ');

  return (
    <div className="consult-shell">
      <PlatformHeader current="consultar" />
      <main className="consult-main">
        <section className="consult-hero">
          <div className="consult-hero-inner">
            <div className="consult-breadcrumb"><a href="/">Início</a><span aria-hidden="true">›</span><strong>{config.label}</strong></div>
            <nav className="cargo-tabs-desktop" aria-label="Escolher cargo">{Object.values(CARGO_CONFIG).map((item)=><a key={item.slug} className={`cargo-tab${cargo===item.slug?' active':''}`} href={`/?cargo=${item.slug}`} aria-current={cargo===item.slug?'page':undefined} onClick={(event)=>{event.preventDefault();changeCargo(item.slug);}}>{item.label}</a>)}</nav>
            <div className="cargo-mobile-picker"><label><span>Cargo</span><select value={cargo} onChange={(event)=>changeCargo(event.target.value)}>{Object.values(CARGO_CONFIG).map((item)=><option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label></div>
            <div className="consult-title-row">
              <div><p className="consult-kicker">{config.kicker}</p><h1>{config.label}</h1><p>Candidaturas às Eleições 2026</p></div>
              <span className="consult-source-note">Fonte principal: TSE · dados organizados para consulta</span>
            </div>
          </div>
        </section>

        {config.paged ? (
          <StateDeputiesView
            uf={uf} setUf={setUf} query={query} setQuery={setQuery} party={party} setParty={setParty} occupation={occupation} setOccupation={setOccupation}
            situation={situation} setSituation={setSituation} sortBy={sortBy} setSortBy={setSortBy} profileId={profileId}
            onOpen={openCandidate} onShare={shareCandidate} onProfileLoaded={(candidate)=>{if(profileId)setSelected(candidate);}} onClearAll={clearAll}
          />
        ) : (
          <>
            {status==='loading'&&<SkeletonResults/>}
            {status!=='loading'&&<DataStrip count={status==='ready'?recordCount:0} scope={uf||config.scopeLabel} parties={status==='ready'?parties.length:0} updated={updated}/>} 

            <section className="consult-tools" aria-label="Busca e filtros">
              {config.requiresUf&&!uf ? (
                <div className="state-uf-gate">
                  <label><span>Estado</span><select value={uf} onChange={(event)=>setUf(event.target.value)}><option value="">Escolha uma UF</option><UfOptions includeAll={false}/></select></label>
                  <p className="state-optimization-note"><strong>Escolha o estado para iniciar.</strong><br/>A base correspondente será carregada antes da busca e dos demais filtros.</p>
                </div>
              ) : (
                <>
                  <SearchControl value={query} onChange={setQuery} disabled={status!=='ready'} candidates={candidates}/>
                  <div className="filter-row">
                    {config.supportsUf&&<label className="filter-field"><span>UF</span><select value={uf} onChange={(event)=>setUf(event.target.value)}><UfOptions includeAll={!config.requiresUf}/></select></label>}
                    <label className="filter-field"><span>Partido</span><select value={party} disabled={status!=='ready'} onChange={(event)=>setParty(event.target.value)}><option value="">Todos</option>{parties.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
                    <button className="filter-more" type="button" aria-expanded={advancedOpen} aria-controls="advanced-filters" onClick={()=>setAdvancedOpen((value)=>!value)}>+ Filtros{occupation||situation||education?' · ativo':''}</button>
                    <label className="filter-field filter-order"><span>Ordenação</span><select value={sortBy} disabled={status!=='ready'} onChange={(event)=>setSortBy(event.target.value)}><option value="nome">Nome A–Z</option><option value="numero">Número</option><option value="partido">Partido A–Z</option></select></label>
                  </div>
                  {advancedOpen&&<div id="advanced-filters" className="advanced-filters"><label className="advanced-filter-field"><span>Ocupação</span><select value={occupation} onChange={(event)=>setOccupation(event.target.value)}><option value="">Todas</option>{occupations.map((item)=><option key={item} value={item}>{item}</option>)}</select></label><label className="advanced-filter-field"><span>Situação da candidatura</span><select value={situation} onChange={(event)=>setSituation(event.target.value)}><option value="">Todas</option>{situations.map((item)=><option key={item} value={item}>{item}</option>)}</select></label><label className="advanced-filter-field"><span>Grau de instrução</span><select value={education} onChange={(event)=>setEducation(event.target.value)}><option value="">Todos</option>{educations.map((item)=><option key={item} value={item}>{item}</option>)}</select></label></div>}
                  {filterChips.length>0&&<div className="filter-chips" aria-label="Filtros ativos">{filterChips.map((item)=><FilterChip key={item.key} label={item.label} onRemove={item.remove}/>)}<button className="clear-all-filters" type="button" onClick={clearAll}>Limpar tudo</button></div>}
                </>
              )}
            </section>

            {status==='error'&&<div className="state-shell"><div className="ux-state-card"><strong>Não foi possível carregar os dados desta consulta.</strong><span>Verifique sua conexão e tente novamente.</span><div className="ux-state-actions"><button className="primary" type="button" onClick={()=>window.location.reload()}>Tentar novamente</button></div></div></div>}
            {status==='ready'&&(
              <>
                <div className="results-heading"><div><span>RESULTADOS</span><h2>{config.label}</h2></div><p>{filtered.length.toLocaleString('pt-BR')} resultado(s)</p></div>
                <section className="candidate-results" aria-live="polite">
                  {filtered.length===0?(
                    <div className="ux-state-card"><strong>Nenhuma candidatura encontrada{activeFilterSummary?` para ${activeFilterSummary}`:''}.</strong><span>Remova um filtro ou limpe a consulta para ampliar os resultados.</span><div className="ux-state-actions">{party&&<button type="button" onClick={()=>setParty('')}>Remover partido</button>}{query&&<button type="button" onClick={()=>setQuery('')}>Remover busca</button>}<button className="primary" type="button" onClick={clearAll}>Limpar todos os filtros</button></div></div>
                  ):(
                    <><div className="candidate-list">{visible.map((candidate)=><CandidateCard key={candidate.id_tse} candidate={candidate} config={config} onOpen={openCandidate} onShare={shareCandidate}/>)}</div>{hasMore&&<div className="ux-state-actions" style={{marginTop:16}}><button type="button" onClick={()=>setVisibleCount((count)=>count+RESULT_BATCH_SIZE)}>Carregar mais</button></div>}</>
                  )}
                </section>
              </>
            )}
          </>
        )}

        <aside className="profile-method-card" style={{width:'min(1180px, calc(100% - 40px))',margin:'0 auto 54px'}}>
          <strong>Origem e metodologia</strong>
          <p>Dados eleitorais e patrimoniais: TSE. Quando houver associação confirmada de histórico parlamentar, a fonte correspondente é indicada no perfil. A plataforma não cria ranking ou recomendação.</p>
          <div className="profile-method-links"><a href={TSE_CANDIDATES_URL} target="_blank" rel="noreferrer">Fonte eleitoral e bens ↗</a><a href={TSE_ACCOUNTS_URL} target="_blank" rel="noreferrer">Prestação de contas ↗</a>{config.hasChamber&&<a href={CAMARA_URL} target="_blank" rel="noreferrer">Câmara ↗</a>}<a href="/metodologia">Como tratamos esses dados?</a><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">Código ↗</a></div>
        </aside>
      </main>

      {selected&&<CandidateProfile candidate={selected} config={config} onClose={closeCandidate} onShare={shareCandidate} returnFocusRef={lastTriggerRef}/>} 
      {profileId&&!config.paged&&status==='ready'&&!selected&&<div className="profile-route"><section className="profile-panel"><div className="profile-top-actions"><button className="profile-back" type="button" onClick={closeCandidate}>‹ Voltar para {config.label}</button></div><div className="ux-state-card"><strong>Perfil não localizado nesta base.</strong><span>O identificador informado não foi encontrado na carga atualmente selecionada.</span><div className="ux-state-actions"><button className="primary" type="button" onClick={closeCandidate}>Voltar à consulta</button></div></div></section></div>}
      {shareNotice&&<div role="status" style={{position:'fixed',right:18,bottom:18,zIndex:200,padding:'11px 14px',borderRadius:10,background:'#0b1f33',color:'#fff',fontSize:12}}>{shareNotice}</div>}
    </div>
  );
}
