import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for GrahmOS Maps: the same Vite build runs inside iOS/Android so Bluetooth beacon
 * scanning and BLE relay connections work on real phones (Web Bluetooth doesn't exist on iOS, and its
 * scanning API is behind a flag on Android). Everything is bundled: no server URL, fully offline.
 */
const config: CapacitorConfig = {
  appId: 'com.grahmos.maps',
  appName: 'GrahmOS Maps',
  webDir: 'dist',
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Looking for GrahmOS relay nodes…',
        cancel: 'Cancel',
        availableDevices: 'Relay nodes nearby',
        noDeviceFound: 'No relay node found',
      },
    },
  },
}

export default config
