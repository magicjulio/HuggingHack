import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css'; // designer's palette + fonts (copied from handoff/design-to-app)
import './styles/base.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
