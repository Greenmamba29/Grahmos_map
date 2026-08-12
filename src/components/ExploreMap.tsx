import clsx from 'clsx';
import * as maplibregl from 'maplibre-gl';
import type { LngLatLike, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { Navigation, Phone, ShieldAlert } from 'lucide-react';
import { Protocol } from 'pmtiles';
import { useEffect, useMemo, useRef, useState } from 'react';

import { categoryChips } from '../data/categories';
import { demoFacilities } from '../data/demoFacilities';
import { getDefaultCenter, getDefaultZoom, getMapStyle } from '../lib/mapStyle';
import type { Facility, FacilityCategory, FacilityStatus, LayerState } from '../types';

type ExploreMapProps = {
  query: string;
  layers: LayerState;
};

const statusLabels: Record<FacilityStatus, string> = {
  operational: 'Operational',
  limited: 'Limited',
  closed: 'Closed',
  unknown: 'Unverified'
};

const statusStyles: Record<FacilityStatus, string> = {
  operational: 'bg-emerald-50 text-emerald-700',
  limited: 'bg-amber-50 text-amber-700',
  closed: 'bg-rose-50 text-rose-700',
  unknown: 'bg-slate-100 text-slate-600'
};

let pmtilesProtocolRegistered = false;

export function ExploreMap({ query, layers }: ExploreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(demoFacilities[0]);

  const visibleFacilities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return demoFacilities.filter((facility) => {
      const categoryVisible = layers.categories[facility.category];
      const matchesSearch =
        normalizedQuery.length === 0 ||
        facility.name.toLowerCase().includes(normalizedQuery) ||
        facility.address.toLowerCase().includes(normalizedQuery);

      return categoryVisible && matchesSearch;
    });
  }, [layers.categories, query]);

  const displayedSelectedFacility =
    selectedFacility && visibleFacilities.some((facility) => facility.id === selectedFacility.id)
      ? selectedFacility
      : (visibleFacilities[0] ?? null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    if (!pmtilesProtocolRegistered) {
      const protocol = new Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);
      pmtilesProtocolRegistered = true;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapStyle(),
      center: getDefaultCenter() as LngLatLike,
      zoom: getDefaultZoom(),
      attributionControl: false
    });

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true
      }),
      'bottom-left'
    );

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const syncLayers = () => {
      setLayerVisibility(map, 'terrain-contours', layers.terrain);
      setLayerVisibility(map, 'critical-infrastructure', true);
    };

    if (map.isStyleLoaded()) {
      syncLayers();
    } else {
      map.once('load', syncLayers);
    }
  }, [layers.terrain]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = visibleFacilities.map((facility) => {
      const markerElement = createFacilityMarker(facility);
      markerElement.addEventListener('click', () => {
        setSelectedFacility(facility);
        map.flyTo({ center: facility.coordinates, zoom: Math.max(map.getZoom(), 12.4), speed: 0.9 });
      });

      return new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat(facility.coordinates)
        .addTo(map);
    });
  }, [visibleFacilities]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-200">
      <div ref={mapContainerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.1),transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.18),transparent_26%,rgba(15,23,42,0.08))]" />

      {layers.offlineRegions ? (
        <div className="pointer-events-none absolute left-[18%] top-[34%] h-48 w-64 rounded-[2rem] border-2 border-dashed border-[#1A73E8] bg-blue-500/10 shadow-[0_0_0_999px_rgba(26,115,232,0.02)]" />
      ) : null}

      <div className="absolute left-4 top-52 z-10 rounded-2xl bg-white/92 px-3 py-2 text-xs font-semibold text-slate-600 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        {visibleFacilities.length} visible facilities
      </div>

      {displayedSelectedFacility ? <SelectedFacilityCard facility={displayedSelectedFacility} /> : null}
    </div>
  );
}

function setLayerVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

function createFacilityMarker(facility: Facility) {
  const category = categoryChips.find((chip) => chip.id === facility.category);
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'facility-marker';
  element.dataset.status = facility.status;
  element.style.backgroundColor = category?.accent ?? '#1A73E8';
  element.setAttribute('aria-label', facility.name);
  element.innerText = getCategoryAbbreviation(facility.category);
  return element;
}

function getCategoryAbbreviation(category: FacilityCategory) {
  const abbreviations: Record<FacilityCategory, string> = {
    hospital: 'H',
    school: 'S',
    shelter: 'Sh',
    water: 'W',
    power: 'P',
    comms: 'C'
  };

  return abbreviations[category];
}

function SelectedFacilityCard({ facility }: { facility: Facility }) {
  const category = categoryChips.find((chip) => chip.id === facility.category);
  const Icon = category?.icon ?? ShieldAlert;

  return (
    <article className="absolute inset-x-4 bottom-28 z-20 rounded-3xl bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,0.24)] ring-1 ring-slate-200 md:left-auto md:w-[380px]">
      <div className="flex gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ backgroundColor: category?.accent ?? '#1A73E8' }}
        >
          <Icon aria-hidden="true" className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="truncate text-base font-bold text-slate-950">{facility.name}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{facility.address}</p>
            </div>
            <span
              className={clsx(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                statusStyles[facility.status]
              )}
            >
              {statusLabels[facility.status]}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{facility.capacity ? `${facility.capacity} capacity` : 'Capacity unlisted'}</span>
            <span aria-hidden="true">&middot;</span>
            <span>Updated {facility.lastUpdated}</span>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full bg-[#1A73E8] px-4 py-2 text-sm font-bold text-white shadow-sm"
            >
              <Navigation aria-hidden="true" className="h-4 w-4" />
              Directions
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              Call
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
