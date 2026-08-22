import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import '../main.css';
import App from './App';
import './index.css';
import { TrpcProvider } from './TrpcProvider';

window.addEventListener('DOMContentLoaded', () => {
  // dark-theme(旧 preload から移設)
  const updateTheme = () => {
    document.documentElement.dataset.bsTheme = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches
      ? 'dark'
      : 'light';
  };
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateTheme);
  updateTheme();

  const container = document.getElementById('root');
  if (!container) throw new Error('#root is not found.');
  createRoot(container).render(
    <TrpcProvider>
      <App />
    </TrpcProvider>,
  );
});
