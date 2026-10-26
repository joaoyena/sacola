import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Não foi possível registar o service worker da aplicação:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
