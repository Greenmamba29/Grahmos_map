export interface MapLayerState {
  terrain: boolean;
  satellite: boolean;
  showHospitals: boolean;
  showSchools: boolean;
  showShelters: boolean;
  showWater: boolean;
  showPower: boolean;
  showComms: boolean;
  showOfflineRegions: boolean;
}

export const DEFAULT_LAYER_STATE: MapLayerState = {
  terrain: true,
  satellite: false,
  showHospitals: true,
  showSchools: true,
  showShelters: true,
  showWater: true,
  showPower: true,
  showComms: true,
  showOfflineRegions: false,
};

export interface LayerOption {
  key: keyof MapLayerState;
  label: string;
  group: 'basemap' | 'facilities' | 'offline';
}

export const LAYER_OPTIONS: LayerOption[] = [
  { key: 'terrain', label: 'Terrain', group: 'basemap' },
  { key: 'satellite', label: 'Satellite', group: 'basemap' },
  { key: 'showHospitals', label: 'Hospitals', group: 'facilities' },
  { key: 'showSchools', label: 'Schools', group: 'facilities' },
  { key: 'showShelters', label: 'Shelters', group: 'facilities' },
  { key: 'showWater', label: 'Water sources', group: 'facilities' },
  { key: 'showPower', label: 'Power', group: 'facilities' },
  { key: 'showComms', label: 'Comms towers', group: 'facilities' },
  { key: 'showOfflineRegions', label: 'Downloaded regions', group: 'offline' },
];
