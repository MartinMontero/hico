import { render } from 'preact';
import { App } from './App.tsx';
import { registerServiceWorker } from './pwa.ts';
import { captureScanLabel } from './scan.ts';

// Before anything renders: a labelled QR link is read and its fragment removed from the address bar.
captureScanLabel();

const root = document.getElementById('app');
if (root) render(<App />, root);
registerServiceWorker();
