import { Capacitor } from '@capacitor/core'

/** True inside the Capacitor iOS/Android shell, false in a browser (including the installed PWA). */
export function isNativeShell() {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}
