import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';

// index.html provides the empty #root element. React puts the whole App inside it.
createRoot(document.getElementById('root')).render(<App />);
