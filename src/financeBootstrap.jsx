import React from 'react';
import { createRoot } from 'react-dom/client';
import './multiCargoMain.jsx';
import CampaignFinance from './campaignFinance.jsx';

const mounted = new WeakMap();

function currentCandidateId() {
  return new URLSearchParams(window.location.search).get('candidato') || '';
}

function mountFinancePanel(modal) {
  if (!modal || mounted.has(modal)) return;
  const candidateId = currentCandidateId();
  if (!candidateId) return;

  const anchor = [...modal.querySelectorAll('.profile-section-title')]
    .find((item) => item.textContent?.trim() === 'Candidatura 2026');
  if (!anchor) return;

  const host = document.createElement('div');
  host.className = 'campaign-finance-host';
  modal.insertBefore(host, anchor);
  const root = createRoot(host);
  root.render(<CampaignFinance candidateId={candidateId} />);
  mounted.set(modal, root);
}

function scan() {
  document.querySelectorAll('.modal').forEach(mountFinancePanel);
}

const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });
scan();
