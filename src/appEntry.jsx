import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeView, { CARGOS } from './homeView.jsx';
import ConsultationApp from './consultationApp.jsx';
import InstitutionalPage from './institutionalPages.jsx';
import PlatformHeader from './PlatformHeader.jsx';
import { MoneyPage, RadarPage, SupplierPage } from './editorialPhase2.jsx';
import './editorialTrust.js';
import './runtime.css';
import './designSystem.css';
import './uxPolish.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Falha de renderização da aplicação.', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="info-page">
        <PlatformHeader />
        <main className="info-main">
          <span className="info-kicker">ERRO DE INTERFACE</span>
          <h1>A consulta não conseguiu iniciar.</h1>
          <p className="info-lead">A página encontrou um erro de execução. Você pode tentar novamente ou voltar à página inicial.</p>
          <section className="info-section">
            <div className="ux-state-actions">
              <button className="primary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button>
              <button type="button" onClick={() => window.location.assign('/')}>Voltar à Home</button>
            </div>
          </section>
        </main>
      </div>
    );
  }
}

function normalizeUrl() {
  const url = new URL(window.location.href);
  let changed = false;
  if (url.searchParams.has('q') && !String(url.searchParams.get('q') || '').trim()) {
    url.searchParams.delete('q');
    changed = true;
  }
  const cargo = url.searchParams.get('cargo');
  if (cargo && !CARGOS.some((item) => item.slug === cargo)) {
    url.searchParams.delete('cargo');
    changed = true;
  }
  if (changed) window.history.replaceState(window.history.state, '', url);
}

function routeForLocation() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/metodologia') return <InstitutionalPage kind="metodologia" />;
  if (pathname === '/fontes') return <InstitutionalPage kind="fontes" />;
  if (pathname === '/sobre') return <InstitutionalPage kind="sobre" />;
  if (pathname === '/radar') return <RadarPage />;
  if (pathname === '/siga-o-dinheiro') return <MoneyPage />;
  if (/^\/fornecedor\/[a-f0-9]{16}(?:-[^/]+)?$/i.test(pathname)) return <SupplierPage />;

  const params = new URLSearchParams(window.location.search);
  const isProfile = /^\/candidato\/[^/]+$/.test(pathname);
  const consultation = isProfile || CARGOS.some((item) => item.slug === params.get('cargo')) || Boolean(params.get('candidato'));
  return consultation ? <ConsultationApp /> : <HomeView />;
}

normalizeUrl();
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado.');

createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>{routeForLocation()}</AppErrorBoundary>
  </React.StrictMode>,
);
