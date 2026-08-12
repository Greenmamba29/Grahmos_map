import { Workbox } from 'workbox-window';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    return;
  }

  const workbox = new Workbox('/sw.js');
  void workbox.register();
}
