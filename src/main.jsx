import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Bundled, offline OpenDyslexic (OFL licence). Browsers only download it once the setting uses it.
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-700.css';
import './style.css';

// index.html provides the empty #root element. React puts the whole App inside it.
createRoot(document.getElementById('root')).render(<App />);
