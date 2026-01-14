import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupPage } from './pages/PopupPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('popup-root')!).render(
  <React.StrictMode>
    <PopupPage />
  </React.StrictMode>
);
