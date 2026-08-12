import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { registerPmtilesProtocol } from '@/lib/pmtiles';
import { buildMapStyle, getDefaultCenter, getDefaultZoom } from '@/lib/mapStyle';
import { useLayers } from '@/context/LayersContext';
import type { Facility } from '@/types/facility';
import { CATEGORY_ICONS, STATUS_COLORS } from '@/types/facility';

interface MapViewProps {
  facilities?: Facility[];
  onFacilityClick?: (facility: Facility) => void;
  center?: [number, number];
  zoom?: number;
  onMapReady?: (map: maplibregl.Map) => void;
}

const FACILITIES_SOURCE = 'facilities';
const FACILITIES_LAYER = 'facilities-circles';

export function MapView({
  facilities = [],
  onFacilityClick,
  center,
  zoom,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { layers } = useLayers();

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;

    registerPmtilesProtocol();

    const usePmtiles = false; // Enable when PMTiles file is available
    const style = buildMapStyle(usePmtiles, layers.satellite, layers.terrain);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: center ?? getDefaultCenter(),
      zoom: zoom ?? getDefaultZoom(),
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      map.addSource(FACILITIES_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: FACILITIES_LAYER,
        type: 'circle',
        source: FACILITIES_SOURCE,
        paint: {
          'circle-radius': 10,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      onMapReady?.(map);
    });

    map.on('click', FACILITIES_LAYER, (e) => {
      const feature = e.features?.[0];
      if (!feature?.properties) return;
      const facility = facilities.find((f) => f.id === feature.properties?.id);
      if (facility) onFacilityClick?.(facility);
    });

    map.on('mouseenter', FACILITIES_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', FACILITIES_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const usePmtiles = false;
    const style = buildMapStyle(usePmtiles, layers.satellite, layers.terrain);
    map.setStyle(style);
  }, [layers.satellite, layers.terrain]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(FACILITIES_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const categoryVisibility: Record<string, boolean> = {
      hospital: layers.showHospitals,
      school: layers.showSchools,
      shelter: layers.showShelters,
      water: layers.showWater,
      power: layers.showPower,
      comms: layers.showComms,
    };

    const visible = facilities.filter((f) => categoryVisibility[f.category] !== false);

    source.setData({
      type: 'FeatureCollection',
      features: visible.map((f) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [f.lng, f.lat],
        },
        properties: {
          id: f.id,
          name: f.name,
          category: f.category,
          color: STATUS_COLORS[f.status],
          icon: CATEGORY_ICONS[f.category],
        },
      })),
    });
  }, [facilities, layers]);

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full" />
  );
}
