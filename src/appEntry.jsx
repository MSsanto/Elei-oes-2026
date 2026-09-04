import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeView, { CARGOS } from './homeView.jsx';
import ConsultationApp from './consultationApp.jsx';
import './editorialTrust.js';
import './runtime.css';

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
      <div className="project-home">
        <header className="home-site-header">
          <nav className="home-topbar" aria-label="Navegação principal">
            <a className="home-brand" href="/"><span className="home-brand-mark">E26</span><span><strong>Eleições 2026</strong><small>Transparência Eleitoral</small></span></a>
          </nav>
        </header>
        <section className="home-hero">
          <div className="home-hero-content">
            <div className="home-eyebrow">ERRO DE INTERFACE</div>
            <h1 style={{ fontSize: 'clamp(34px,5vw,54px)' }}>A consulta não conseguiu iniciar.</h1>
            <p className="home-lead">A página encontrou um erro de execução. Recarregue a consulta ou volte à página inicial.</p>
            <p style={{ marginTop: 22 }}><button type="button" onClick={() => window.location.reload()} style={{ padding: '12px 16px', border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Tentar novamente</button><a href="/" style={{ marginLeft: 14, color: '#dbe5f2' }}>Voltar à home</a></p>
          </div>
        </section>
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
  if (changed) window.history.replaceState({}, '', url);
}

normalizeUrl();
const params = new URLSearchParams(window.location.search);
const consultation = CARGOS.some((item) => item.slug === params.get('cargo')) || Boolean(params.get('candidato'));
const rootElement = document.getElementById('root');

if (!rootElement) throw new Error('Elemento #root não encontrado.');

createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {consultation ? <ConsultationApp /> : <HomeView />}
    </AppErrorBoundary>
  </React.StrictMode>,
);
