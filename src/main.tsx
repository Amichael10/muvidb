import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';

console.log("main.tsx: Starting render...");

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
} else {
  console.error("Root not found");
}
