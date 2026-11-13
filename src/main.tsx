import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // Offline service worker registration is non-blocking in dev/iframe environments
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
