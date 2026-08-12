export type TabId = 'explore' | 'routes' | 'saved' | 'offline' | 'alerts';

export interface TabItem {
  id: TabId;
  label: string;
  icon: 'compass' | 'route' | 'bookmark' | 'download' | 'bell';
}

export const TABS: TabItem[] = [
  { id: 'explore', label: 'Explore', icon: 'compass' },
  { id: 'routes', label: 'Routes', icon: 'route' },
  { id: 'saved', label: 'Saved', icon: 'bookmark' },
  { id: 'offline', label: 'Offline', icon: 'download' },
  { id: 'alerts', label: 'Alerts', icon: 'bell' },
];
