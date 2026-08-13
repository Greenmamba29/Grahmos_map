let cached: boolean | null = null;

/** MapLibre needs WebGL; some locked-down/headless browsers refuse it. */
export function isWebglSupported(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    cached = Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    cached = false;
  }
  return cached;
}
