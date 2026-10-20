import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './lib/api'; // installs the Bearer-token fetch interceptor before any request runs
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
