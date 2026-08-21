import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import '../main.css';
import App from './App';
import './index.css';
import { TrpcProvider } from './TrpcProvider';

window.addEventListener('DOMContentLoaded', () => {
  createRoot(document.getElementById('root')).render(
    <TrpcProvider>
      <App />
    </TrpcProvider>,
  );
});
