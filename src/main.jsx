import React from 'react';
import { createRoot } from 'react-dom/client';
import AccountGate from './AccountGate.jsx';
// Bundled, offline OpenDyslexic (OFL licence). Browsers only download it once the setting uses it.
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-700.css';
import './style.css';

// index.html provides the empty #root element. AccountGate shows log-in, then the App.
createRoot(document.getElementById('root')).render(<AccountGate />);
