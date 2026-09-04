import React, { useEffect, useMemo, useState } from 'react';
import './styles.css';
import './photo.css';
import './autocomplete.css';
import './uxEnhancements.css';
import './multiCargo.css';
import './profileTabs.css';
import './uxRefresh.css';
import { ChamberActivity, chamberBasePhoto, displayTseValue } from './chamberProfile.jsx';
import StateDeputiesView from './stateDeputies.jsx';
import CampaignFinance from './campaignFinance.jsx';

const REPOSITORY_URL = 'https://github.com/MSsanto/Elei-oes-2026';
const IDENTITY_URL = '/data/mappings/identidades.json';
const CHAMBER_HISTORY_URL = '/data/camara/historico_confirmados.json';
const RESULT_BATCH_SIZE = 60;
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const CARGO_CONFIG = {
  presidente: { slug:'presidente', label:'Presidente', kicker:'PRESIDÊNCIA DA REPÚBLICA', scopeLabel:'Brasil', requiresUf:false, supportsUf:false, hasChamber:false, dataUrl:()=>'/data/candidatos/presidente/brasil.json', metaUrl:'/data/candidatos/presidente/manifest.json' },
  governador: { slug:'governador', label:'Governador', kicker:'GOVERNOS ESTADUAIS', scopeLabel:'UF selecionada', requiresUf:true, supportsUf:true, hasChamber:false, dataUrl:(uf)=>`/data/candidatos/governador/${uf}.json`, metaUrl:'/data/candidatos/governador/manifest.json' },
  senador: { slug:'senador', label:'Senador', kicker:'SENADO FEDERAL', scopeLabel:'UF selecionada', requiresUf:true, supportsUf:true, hasChamber:false, dataUrl:(uf)=>`/data/candidatos/senador/${uf}.json`, metaUrl:'/data/candidatos/senador/manifest.json' },
  'deputado-federal': { slug:'deputado-federal', label:'Deputado Federal', kicker:'CÂMARA DOS DEPUTADOS', scopeLabel:'Brasil por UF', requiresUf:false, supportsUf:true, hasChamber:true, dataUrl:()=>'/data/deputados_federais.json', metaUrl:'/data/metadata.json' },
  'deputado-estadual': { slug:'deputado-estadual', label:'Deputado Estadual', kicker:'ASSEMBLEIAS LEGISLATIVAS E CÂMARA LEGISLATIVA DO DF', scopeLabel:'UF selecionada', requiresUf:true, supportsUf:true, hasChamber:false, paged:true },
};

function param(name, fallback='') { return new URLSearchParams(window.location.search).get(name) || fallback; }
function initialCargo() { const value = param('cargo','deputado-federal'); return CARGO_CONFIG[value] ? value : 'deputado-federal'; }
function normalize(value='') { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function displayName(candidate) { return candidate?.nome_urna || candidate?.nome || 'Candidato sem nome'; }
function uniqueSorted(items, field) { return [...new Set(items.map((item)=>item[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'})); }
function formatDate(value) { if (!value) return 'Aguardando coleta'; try { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)); } catch { return String(value); } }
function formatBirthDate(value) { if (!value) return ''; const parts=String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(parts) return value; const date=new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date); }

function setUrlState(values, push=false) {
  const url = new URL(window.location.href);
  Object.entries(values).forEach(([key,value])=>{ if(value===null || value===undefined || value==='') url.searchParams.delete(key); else url.searchParams.set(key,String(value)); });
  if (push) window.history.pushState({},'',url); else window.history.replaceState({},'',url);
}

async function requiredJson(url, signal) { const response=await fetch(url,{cache:'no-cache',signal}); if(!response.ok) throw new Error(`${response.status} ${response.statusText}`); return response.json(); }
async function optionalJson(url, signal) { try { const response=await fetch(url,{cache:'no-cache',signal}); return response.ok ? await response.json() : null; } catch(error) { if(error.name==='AbortError') throw error; return null; } }

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
    const [raw,metadata,identity,history]=await Promise.all([requiredJson(config.dataUrl(uf),signal),optionalJson(config.metaUrl,signal),optionalJson(IDENTITY_URL,signal),optionalJson(CHAMBER_HISTORY_URL,signal)]);
    return {candidates:attachOfficialSources(Array.isArray(raw)?raw:[],identity,history),metadata,needsUf:false};
  }
  const [raw,metadata]=await Promise.all([requiredJson(config.dataUrl(uf),signal),optionalJson(config.metaUrl,signal)]);
  return {candidates:(Array.isArray(raw)?raw:[]).map((item)=>({...item,cargo:item.cargo||config.label})),metadata,needsUf:false};
}

function GitHubIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7A11.3 11.3 0 0 0 8.4 22.8c.6.1.8-.2.8-.5v-2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z"/></svg>}
function ShareIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.7 15.7 8m-7.2 3.3 7.2 4.7M18 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM8 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>}
function initials(name=''){return name.split(/\s+/).filter(Boolean).slice(0,2).map((word)=>word[0]).join('').toUpperCase()||'?';}

function CandidateAvatar({candidate,large=false}){
  const sources=[candidate?.foto_url,chamberBasePhoto(candidate)].filter(Boolean);
  const [index,setIndex]=useState(0); const source=sources[index];
  return <div className={`avatar${large?' avatar-large':''}`} aria-hidden="true">{source?<img src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setIndex((value)=>value+1)}/>:initials(displayName(candidate))}</div>;
}

function CandidateCard({candidate,config,onOpen,onShare}){
  const situation=displayTseValue(candidate.situacao_candidatura);
  const hasHistory=candidate.identidade_camara?.historico_camara_localizado===true;
  return <article className={`candidate-card${hasHistory?' has-chamber-history':''}`}>
    <button className="candidate-card-open" type="button" onClick={()=>onOpen(candidate)} aria-label={`Abrir perfil de ${displayName(candidate)}`}>
      <CandidateAvatar candidate={candidate}/><div className="candidate-main"><div className="candidate-topline"><span className="number">{candidate.numero||'—'}</span><span className="party">{candidate.partido||'Sem partido informado'}</span><span className="uf">{candidate.uf||(config.slug==='presidente'?'BR':'—')}</span></div><h3>{displayName(candidate)}</h3><p>{candidate.nome&&candidate.nome!==candidate.nome_urna?candidate.nome:(candidate.cargo||config.label)}</p><div className="tags">{situation&&<span>{situation}</span>}{candidate.ocupacao&&<span>{candidate.ocupacao}</span>}{hasHistory&&<span className="history-badge">Histórico na Câmara</span>}</div></div>
    </button>
    <button className="candidate-share" type="button" onClick={()=>onShare(candidate)} aria-label={`Compartilhar perfil de ${displayName(candidate)}`}><ShareIcon/></button>
  </article>;
}

function CandidateModal({candidate,config,onClose,onShare}){
  const [tab,setTab]=useState('resumo');
  useEffect(()=>setTab('resumo'),[candidate?.id_tse]);
  useEffect(()=>{ const handler=(event)=>{if(event.key==='Escape')onClose();}; window.addEventListener('keydown',handler); return()=>window.removeEventListener('keydown',handler);},[onClose]);
  if(!candidate)return null;
  const identity=candidate.identidade_camara;
  const confirmed=config.hasChamber&&identity?.correspondencia_status==='confirmada';
  const rows=[['Cargo',candidate.cargo||config.label],['Nome completo',candidate.nome],['Nome de urna',candidate.nome_urna],['Número',candidate.numero],['Partido',candidate.partido],['UF',candidate.uf],['Situação da candidatura',displayTseValue(candidate.situacao_candidatura)],['Situação na urna',displayTseValue(candidate.situacao_urna)],['Ocupação',candidate.ocupacao],['Grau de instrução',candidate.grau_instrucao],['Gênero',candidate.genero],['Cor/raça declarada',candidate.cor_raca],['Data de nascimento',formatBirthDate(candidate.data_nascimento)],['Identificador TSE',candidate.id_tse]].filter(([,value])=>value!==null&&value!==undefined&&value!=='');
  return <div className="modal-backdrop" onMouseDown={onClose} role="presentation"><section className="modal profile-tabs-enabled" role="dialog" aria-modal="true" aria-labelledby="candidate-title" onMouseDown={(event)=>event.stopPropagation()}>
    <button className="close-button" onClick={onClose} type="button" aria-label="Fechar">×</button>
    <div className="modal-heading"><CandidateAvatar candidate={candidate} large/><div className="modal-heading-copy"><div className="candidate-topline"><span className="number">{candidate.numero||'—'}</span><span className="party">{candidate.partido||'—'}</span><span className="uf">{candidate.uf||'—'}</span></div><h2 id="candidate-title">{displayName(candidate)}</h2><p>{candidate.cargo||config.label} · dados oficiais consolidados por fonte</p></div><button className="modal-share-button" onClick={()=>onShare(candidate)} type="button"><ShareIcon/> Compartilhar</button></div>
    <div className="profile-tabs" role="tablist" aria-label="Seções do perfil"><button className="profile-tab" role="tab" aria-selected={tab==='resumo'} onClick={()=>setTab('resumo')}>Resumo</button><button className="profile-tab" role="tab" aria-selected={tab==='financas'} onClick={()=>setTab('financas')}>Finanças</button>{config.hasChamber&&<button className="profile-tab" role="tab" aria-selected={tab==='camara'} onClick={()=>setTab('camara')}>Câmara</button>}</div>
    {tab==='resumo'&&<><div className="profile-section-title">Candidatura 2026</div><dl className="detail-grid">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}
    {tab==='financas'&&<CampaignFinance candidate={candidate}/>} 
    {tab==='camara'&&config.hasChamber&&(confirmed?<ChamberActivity candidate={candidate} identity={identity}/>:<div className="coming-soon"><strong>Histórico parlamentar não confirmado.</strong> O projeto só associa uma candidatura à Câmara quando a correspondência entre as fontes oficiais atende aos critérios publicados.</div>)}
  </section></div>;
}

function compareCandidates(a,b,sortBy){const byName=()=>displayName(a).localeCompare(displayName(b),'pt-BR',{sensitivity:'base'}); if(sortBy==='numero')return String(a.numero||'').localeCompare(String(b.numero||''),'pt-BR',{numeric:true})||byName(); if(sortBy==='partido')return String(a.partido||'').localeCompare(String(b.partido||''),'pt-BR',{sensitivity:'base'})||byName(); return byName();}

export default function ConsultationApp(){
  const [cargo,setCargo]=useState(initialCargo); const config=CARGO_CONFIG[cargo];
  const [query,setQuery]=useState(()=>param('q')); const [uf,setUf]=useState(()=>param('uf')); const [party,setParty]=useState(()=>param('partido')); const [occupation,setOccupation]=useState(()=>param('ocupacao')); const [sortBy,setSortBy]=useState(()=>param('ordenacao','nome'));
  const [candidates,setCandidates]=useState([]); const [metadata,setMetadata]=useState(null); const [status,setStatus]=useState(config.paged?'custom':'loading'); const [error,setError]=useState(''); const [selected,setSelected]=useState(null); const [visibleCount,setVisibleCount]=useState(RESULT_BATCH_SIZE);

  useEffect(()=>{ document.title=`${config.label} | Eleições 2026`; },[config.label]);
  useEffect(()=>{
    if(config.paged){setCandidates([]);setMetadata(null);setStatus('custom');setError('');return undefined;}
    const controller=new AbortController(); setCandidates([]);setMetadata(null);setSelected(null);setVisibleCount(RESULT_BATCH_SIZE);setError('');
    if(config.requiresUf&&!uf){setStatus('needs-uf'); optionalJson(config.metaUrl,controller.signal).then(setMetadata).catch(()=>{}); return()=>controller.abort();}
    setStatus('loading');
    loadCargo(cargo,uf,controller.signal).then(({candidates:loaded,metadata:meta,needsUf})=>{setCandidates(loaded);setMetadata(meta);setStatus(needsUf?'needs-uf':'ready');}).catch((loadError)=>{if(loadError.name!=='AbortError'){setError(loadError.message);setStatus('error');}});
    return()=>controller.abort();
  },[cargo,uf,config.paged,config.requiresUf,config.metaUrl]);

  useEffect(()=>{setUrlState({cargo,uf:config.supportsUf?uf:'',partido:party,ocupacao:occupation,q:query.trim(),ordenacao:sortBy==='nome'?'':sortBy});},[cargo,uf,party,occupation,query,sortBy,config.supportsUf]);
  useEffect(()=>{if(status!=='ready'||!candidates.length)return; const id=param('candidato'); if(!id)return; const match=candidates.find((item)=>String(item.id_tse)===id); if(match)setSelected(match);},[status,candidates]);

  const parties=useMemo(()=>uniqueSorted(candidates,'partido'),[candidates]); const occupations=useMemo(()=>uniqueSorted(candidates,'ocupacao'),[candidates]); const ufs=useMemo(()=>cargo==='deputado-federal'?uniqueSorted(candidates,'uf'):UFS,[cargo,candidates]);
  const filtered=useMemo(()=>{const term=normalize(query.trim()); return candidates.filter((candidate)=>{if(cargo==='deputado-federal'&&uf&&candidate.uf!==uf)return false;if(party&&candidate.partido!==party)return false;if(occupation&&candidate.ocupacao!==occupation)return false;if(!term)return true;return[candidate.nome,candidate.nome_urna,candidate.numero,candidate.partido,candidate.ocupacao].some((value)=>normalize(value).includes(term));}).sort((a,b)=>compareCandidates(a,b,sortBy));},[candidates,cargo,uf,party,occupation,query,sortBy]);
  useEffect(()=>setVisibleCount(RESULT_BATCH_SIZE),[cargo,uf,party,occupation,query,sortBy]);
  const visible=filtered.slice(0,visibleCount); const hasMore=visibleCount<filtered.length; const hasFilters=Boolean(query.trim()||party||occupation||(config.supportsUf&&uf));

  function changeCargo(next){if(next===cargo)return;setCargo(next);setQuery('');setParty('');setOccupation('');setSelected(null);if(!CARGO_CONFIG[next].supportsUf)setUf('');setUrlState({cargo:next,q:'',partido:'',ocupacao:'',candidato:'',uf:CARGO_CONFIG[next].supportsUf?uf:''},true);}
  function openCandidate(candidate){setSelected(candidate);setUrlState({candidato:candidate.id_tse});}
  function closeCandidate(){setSelected(null);setUrlState({candidato:'',aba:''});}
  async function shareCandidate(candidate){const url=new URL(window.location.href);url.searchParams.set('candidato',String(candidate.id_tse));const text=`${displayName(candidate)} — ${candidate.cargo||config.label}${candidate.partido?` · ${candidate.partido}`:''}.`;if(navigator.share){try{await navigator.share({title:`${displayName(candidate)} — Eleições 2026`,text,url:url.toString()});return;}catch(errorShare){if(errorShare?.name==='AbortError')return;}}window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,'_blank','noopener,noreferrer');}
  function clearFilters(){setQuery('');setParty('');setOccupation('');if(!config.requiresUf)setUf('');setSortBy('nome');}

  const recordCount=metadata?.records??metadata?.total??candidates.length; const updated=metadata?.generated_at_utc||metadata?.gerado_em_utc||metadata?.updated_at;

  return <>
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">E26</span><span><strong>Eleições 2026</strong><small>Transparência Eleitoral</small></span></a><nav className="consult-nav" aria-label="Atalhos do projeto"><a href="#consulta">Consultar</a><a href="/#metodologia">Metodologia</a><a href="/#fontes">Fontes</a><a href="/#sobre">Sobre</a></nav><a className="github-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer"><GitHubIcon/><span>GitHub</span><span aria-hidden="true">↗</span></a></header>
    <main>
      <section className="hero multi-cargo-hero"><div className="hero-content"><div className="consult-breadcrumb"><a href="/">Início</a><span aria-hidden="true">›</span><strong>{config.label}</strong></div><div className="cargo-tabs" role="tablist" aria-label="Cargo eleitoral">{Object.keys(CARGO_CONFIG).map((slug)=><a key={slug} href={`/?cargo=${slug}`} role="tab" aria-selected={cargo===slug} className={cargo===slug?'active':''} onClick={(event)=>{event.preventDefault();changeCargo(slug);}}>{CARGO_CONFIG[slug].label}</a>)}</div><div className="eyebrow">{config.kicker}</div><h1>{config.label}<br/><span>dados oficiais em consulta.</span></h1><p className="hero-copy">Consulta pública organizada por cargo, com filtros explícitos e fontes rastreáveis.</p><div className="trust-row"><span>Fonte eleitoral: TSE</span>{config.hasChamber&&<span>Atividade parlamentar: Câmara</span>}<span>Sem ranking ou recomendação</span></div></div></section>

      {config.paged ? <StateDeputiesView uf={uf} setUf={setUf} query={query} setQuery={setQuery} party={party} setParty={setParty} occupation={occupation} setOccupation={setOccupation} sortBy={sortBy} setSortBy={setSortBy} onOpen={openCandidate} onShare={shareCandidate}/> : <>
        <section className="stats-wrap" aria-label="Resumo da consulta"><div className="stat-card"><strong>{status==='ready'?Number(recordCount||0).toLocaleString('pt-BR'):'—'}</strong><span>candidaturas na carga</span></div><div className="stat-card"><strong>{config.supportsUf?(uf||config.scopeLabel):config.scopeLabel}</strong><span>circunscrição</span></div><div className="stat-card"><strong>{status==='ready'?parties.length.toLocaleString('pt-BR'):'—'}</strong><span>partidos na carga</span></div><div className="stat-card stat-update"><strong>Atualização</strong><span>{formatDate(updated)}</span></div></section>
        <section className="content-section" id="consulta"><div className="section-heading"><div><span className="section-kicker">CANDIDATURAS 2026</span><h2>{config.label}</h2></div><p>{status==='ready'?`${filtered.length.toLocaleString('pt-BR')} resultado(s)`:'Consulta por dados publicados'}</p></div>
          <div className={`filters filters-enhanced multi-cargo-filters${!config.supportsUf?' without-uf':''}`}><label className="search-box"><span>⌕</span><input type="search" placeholder="Nome, número, partido ou ocupação..." value={query} disabled={status!=='ready'} onChange={(event)=>setQuery(event.target.value)}/></label>{config.supportsUf&&<select value={uf} onChange={(event)=>setUf(event.target.value)} aria-label={config.requiresUf?'Escolha obrigatória da UF':'Filtrar por UF'}><option value="">{config.requiresUf?'Escolha uma UF':'Todas as UFs'}</option>{ufs.map((item)=><option key={item} value={item}>{item}</option>)}</select>}<select value={party} onChange={(event)=>setParty(event.target.value)} aria-label="Filtrar por partido" disabled={status!=='ready'}><option value="">Todos os partidos</option>{parties.map((item)=><option key={item} value={item}>{item}</option>)}</select><select value={occupation} onChange={(event)=>setOccupation(event.target.value)} aria-label="Filtrar por ocupação ou profissão" disabled={status!=='ready'}><option value="">Todas as ocupações</option>{occupations.map((item)=><option key={item} value={item}>{item}</option>)}</select><select value={sortBy} onChange={(event)=>setSortBy(event.target.value)} aria-label="Ordenar resultados" disabled={status!=='ready'}><option value="nome">Nome A–Z</option><option value="numero">Número do candidato</option><option value="partido">Partido A–Z</option></select>{hasFilters&&<button className="clear-button" onClick={clearFilters} type="button">Limpar</button>}</div>
          {status==='loading'&&<div className="state-card"><div className="loader"/>Carregando base pública...</div>}
          {status==='needs-uf'&&<div className="state-card governor-empty-state"><div className="empty-state-icon" aria-hidden="true">⌖</div><strong>Escolha uma UF para consultar {config.label}</strong><span>A carga é feita somente para o estado selecionado.</span></div>}
          {status==='error'&&<div className="state-card waiting"><strong>Não foi possível carregar esta consulta.</strong><span>{error}</span><button className="empty-clear-button" type="button" onClick={()=>window.location.reload()}>Tentar novamente</button></div>}
          {status==='ready'&&filtered.length===0&&<div className="state-card search-empty-state"><strong>Nenhuma candidatura encontrada</strong><span>Revise os filtros aplicados.</span>{hasFilters&&<button className="empty-clear-button" onClick={clearFilters} type="button">Limpar filtros</button>}</div>}
          {visible.length>0&&<div className="candidate-list">{visible.map((candidate)=><CandidateCard key={candidate.id_tse} candidate={candidate} config={config} onOpen={openCandidate} onShare={shareCandidate}/>)}</div>}
          {hasMore&&<button className="clear-button result-limit" type="button" onClick={()=>setVisibleCount((value)=>Math.min(value+RESULT_BATCH_SIZE,filtered.length))}>Mostrando {visible.length.toLocaleString('pt-BR')} de {filtered.length.toLocaleString('pt-BR')} · carregar mais</button>}
        </section>
      </>}
      <section className="method-section"><div><span className="section-kicker">COMO FUNCIONA</span><h2>Da fonte oficial à consulta pública</h2></div><div className="method-grid"><article><span>01</span><h3>Coleta</h3><p>Arquivos oficiais são processados e publicados em estruturas adequadas a cada cargo.</p></article><article><span>02</span><h3>Consulta objetiva</h3><p>Filtros e abas reproduzem escolhas explícitas do usuário, sem ranking ou prioridade política.</p></article><article><span>03</span><h3>Publicação</h3><p>Dados processados ficam versionados e a interface mantém fonte e data da carga.</p></article></div></section>
    </main>
    <footer><div className="footer-project"><strong>Eleições 2026</strong><span>Projeto independente de transparência pública.</span><a className="footer-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer"><GitHubIcon/>Repositório no GitHub<span aria-hidden="true">↗</span></a></div><p>Dados provenientes de fontes públicas oficiais. Ausência de vínculo ou informação significa apenas que o dado não foi confirmado/localizado pela metodologia aplicada.</p></footer>
    <CandidateModal candidate={selected} config={config} onClose={closeCandidate} onShare={shareCandidate}/>
  </>;
}
