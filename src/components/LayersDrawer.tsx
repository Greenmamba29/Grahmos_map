import clsx from 'clsx';
import { Check, Layers, Satellite, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { categoryChips } from '../data/categories';
import type { FacilityCategory, LayerState } from '../types';

type LayersDrawerProps = {
  isOpen: boolean;
  layers: LayerState;
  onClose: () => void;
  onToggleCategory: (category: FacilityCategory) => void;
  onToggleLayer: (layer: keyof Omit<LayerState, 'categories'>) => void;
};

export function LayersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-4 top-28 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition hover:bg-slate-50"
      aria-label="Open map layers"
    >
      <Layers aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

export function LayersDrawer({
  isOpen,
  layers,
  onClose,
  onToggleCategory,
  onToggleLayer
}: LayersDrawerProps) {
  return (
    <>
      <div
        className={clsx(
          'absolute inset-0 z-30 bg-slate-900/20 transition-opacity',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={clsx(
          'absolute right-3 top-20 z-40 w-[min(360px,calc(100%-1.5rem))] rounded-3xl bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.28)] ring-1 ring-slate-200 transition duration-200',
          isOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-5 opacity-0'
        )}
        aria-label="Map layers"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1A73E8]">
              Map layers
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Terrain-aware offline map</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close layers drawer"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <LayerCard
            label="Terrain"
            description="Contours and slope"
            checked={layers.terrain}
            onClick={() => onToggleLayer('terrain')}
          />
          <LayerCard
            label="Satellite"
            description="Imagery overlay"
            checked={layers.satellite}
            icon={<Satellite aria-hidden="true" className="h-4 w-4" />}
            onClick={() => onToggleLayer('satellite')}
          />
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-slate-900">Facilities</p>
          <div className="mt-2 grid gap-2">
            {categoryChips.map((category) => {
              const Icon = category.icon;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onToggleCategory(category.id)}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: category.accent }}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    {category.label}
                  </span>
                  <ToggleDot checked={layers.categories[category.id]} />
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleLayer('offlineRegions')}
          className="mt-5 flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-bold text-slate-900">Downloaded regions</span>
            <span className="block text-xs text-slate-500">Show offline coverage overlay</span>
          </span>
          <ToggleDot checked={layers.offlineRegions} />
        </button>
      </aside>
    </>
  );
}

function LayerCard({
  label,
  description,
  checked,
  icon,
  onClick
}: {
  label: string;
  description: string;
  checked: boolean;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-2xl border p-3 text-left transition',
        checked ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      )}
    >
      <span className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        {icon ?? <Layers aria-hidden="true" className="h-4 w-4 text-[#1A73E8]" />}
      </span>
      <span className="mt-1 block text-xs text-slate-500">{description}</span>
    </button>
  );
}

function ToggleDot({ checked }: { checked: boolean }) {
  return (
    <span
      className={clsx(
        'flex h-6 w-6 items-center justify-center rounded-full border transition',
        checked ? 'border-[#1A73E8] bg-[#1A73E8] text-white' : 'border-slate-300 bg-white'
      )}
    >
      {checked ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
    </span>
  );
}
