import React, { useEffect, useRef, useState } from 'react';

const REPOSITORY_URL = 'https://github.com/MSsanto/Elei-oes-2026';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 .7A11.3 11.3 0 0 0 8.4 22.8c.6.1.8-.2.8-.5v-2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}

const LINKS = [
  { href: '/?cargo=deputado-federal', label: 'Consultar', key: 'consultar' },
  { href: '/radar', label: 'Radar', key: 'radar' },
  { href: '/siga-o-dinheiro', label: 'Siga o Dinheiro', key: 'dinheiro' },
  { href: '/metodologia', label: 'Metodologia', key: 'metodologia' },
  { href: '/fontes', label: 'Fontes', key: 'fontes' },
  { href: '/expediente', label: 'Expediente', key: 'expediente' },
  { href: '/sobre', label: 'Sobre', key: 'sobre' },
];

export default function PlatformHeader({ current = '', compact = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    function onPointer(event) {
      if (!menuRef.current?.contains(event.target) && !menuButtonRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="topbar platform-header">
        <a className="platform-brand" href="/" aria-label="Eleições 2026 — página inicial">
          <span className="platform-brand-mark">E26</span>
          <span className="platform-brand-copy"><strong>Eleições 2026</strong>{!compact && <small>Transparência Eleitoral</small>}</span>
        </a>
        <nav className="platform-nav" aria-label="Navegação principal">
          {LINKS.map((item) => <a key={item.key} href={item.href} aria-current={current === item.key ? 'page' : undefined}>{item.label}</a>)}
        </nav>
        <a className="platform-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          <GitHubIcon /><span>GitHub</span><span aria-hidden="true">↗</span>
        </a>
        <button
          ref={menuButtonRef}
          className="platform-menu-button"
          type="button"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="platform-mobile-menu"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? '×' : '☰'}
        </button>
      </header>
      {menuOpen && (
        <nav ref={menuRef} id="platform-mobile-menu" className="platform-mobile-menu" aria-label="Menu móvel">
          {LINKS.map((item) => <a key={item.key} href={item.href} aria-current={current === item.key ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
          <a href="/correcoes" onClick={() => setMenuOpen(false)}>Correções</a>
          <a href="/situacao-candidatura" onClick={() => setMenuOpen(false)}>Situação da candidatura</a>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
        </nav>
      )}
    </>
  );
}
