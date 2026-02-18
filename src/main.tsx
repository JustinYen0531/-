import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ConnectionProvider } from './network/ConnectionProvider';
import ConnectionDebugPanel from './components/ConnectionDebugPanel';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ConnectionProvider>
      <App />
      {import.meta.env.DEV ? <ConnectionDebugPanel /> : null}
    </ConnectionProvider>
  </React.StrictMode>
);
