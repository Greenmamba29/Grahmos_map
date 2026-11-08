export type Pins = Record<string, Set<string>>;
export function bunLockPins(text: string, into?: Pins): Pins;
export function npmLockPins(text: string, into?: Pins): Pins;
export function trackedLockfiles(root: string): string[];
export function allPins(root: string): { pins: Pins; files: string[] };
