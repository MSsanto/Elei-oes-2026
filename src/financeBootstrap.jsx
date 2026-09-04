import React from 'react';
import { createRoot } from 'react-dom/client';
import './multiCargoMain.jsx';
import './profileTabs.css';
import CampaignFinance from './campaignFinance.jsx';

const mounted = new WeakMap();
const VALID_TABS = new Set(['resumo', 'financas', 'camara']);

function params() {
  return new URLSearchParams(window.location.search);
}

function currentCandidateId() {
  return params().get('candidato') || '';
}

function requestedTab(hasChamber) {
  const value = params().get('aba') || 'resumo';
  if (!VALID_TABS.has(value)) return 'resumo';
  if (value === 'camara' && !hasChamber) return 'resumo';
  return value;
}

function setTabParam(tab) {
  const url = new URL(window.location.href);
  if (tab === 'resumo') url.searchParams.delete('aba');
  else url.searchParams.set('aba', tab);
  window.history.replaceState({}, '', url);
}

function makeTabButton(tab, label, selectTab) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'profile-tab';
  button.setAttribute('role', 'tab');
  button.dataset.tab = tab;
  button.textContent = label;
  button.addEventListener('click', () => selectTab(tab, true));
  return button;
}

function enhanceModal(modal) {
  if (!modal || mounted.has(modal)) return;
  const candidateId = currentCandidateId();
  if (!candidateId) return;

  const heading = modal.querySelector('.modal-heading');
  const anchor = [...modal.querySelectorAll(':scope > .profile-section-title')]
    .find((item) => item.textContent?.trim() === 'Candidatura 2026');
  if (!heading || !anchor) return;

  const financeHost = document.createElement('div');
  financeHost.className = 'campaign-finance-host';
  modal.insertBefore(financeHost, anchor);
  const root = createRoot(financeHost);
  root.render(<CampaignFinance candidateId={candidateId} />);

  const hasChamber = Boolean(
    modal.querySelector(':scope > .chamber-module') || modal.querySelector(':scope > .coming-soon'),
  );

  const nav = document.createElement('div');
  nav.className = 'profile-tabs';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Seções do perfil do candidato');

  const buttons = [
    makeTabButton('resumo', 'Resumo', selectTab),
    makeTabButton('financas', 'Finanças', selectTab),
  ];
  if (hasChamber) buttons.push(makeTabButton('camara', 'Câmara', selectTab));
  buttons.forEach((button) => nav.appendChild(button));
  heading.insertAdjacentElement('afterend', nav);

  modal.classList.add('profile-tabs-enabled');

  function selectTab(tab, updateUrl = false) {
    const resolved = tab === 'camara' && !hasChamber ? 'resumo' : tab;
    modal.dataset.profileTab = resolved;
    buttons.forEach((button) => {
      const active = button.dataset.tab === resolved;
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    if (updateUrl) setTabParam(resolved);
  }

  nav.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true');
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    buttons[next].focus();
    buttons[next].click();
  });

  selectTab(requestedTab(hasChamber), false);
  mounted.set(modal, { root, nav });
}

function clearOrphanTabParam() {
  if (document.querySelector('.modal')) return;
  if (currentCandidateId()) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('aba')) return;
  url.searchParams.delete('aba');
  window.history.replaceState({}, '', url);
}

function scan() {
  document.querySelectorAll('.modal').forEach(enhanceModal);
  clearOrphanTabParam();
}

const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });
scan();
