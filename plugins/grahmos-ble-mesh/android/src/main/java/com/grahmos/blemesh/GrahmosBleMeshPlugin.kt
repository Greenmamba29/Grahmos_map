package com.grahmos.blemesh

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.ParcelUuid
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Phone-to-phone BLE mesh link (dual role, after bitchat's design, Unlicense):
 * GATT server + advertiser (peripheral) and scanner + GATT clients (central) at the same time.
 * Packets are opaque bytes (bitchat-framed GrahmOS envelopes); the JS mesh layer dedupes and verifies.
 */
@CapacitorPlugin(
    name = "GrahmosBleMesh",
    permissions = [
        Permission(
            alias = "bluetooth",
            strings = [
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE,
            ],
        ),
        Permission(alias = "location", strings = [Manifest.permission.ACCESS_FINE_LOCATION]),
    ],
)
class GrahmosBleMeshPlugin : Plugin() {
    companion object {
        val SERVICE_UUID: UUID = UUID.fromString("6c1a4e8e-7b2f-4c1e-9a3d-5f2b8c7d9e01")
        val CHARACTERISTIC_UUID: UUID = UUID.fromString("6c1a4e8e-7b2f-4c1e-9a3d-5f2b8c7d9e02")
        val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        const val MAX_CENTRAL_LINKS = 7
    }

    private var gattServer: BluetoothGattServer? = null
    private var serverCharacteristic: BluetoothGattCharacteristic? = null
    private val subscribedDevices = ConcurrentHashMap<String, BluetoothDevice>()
    private val clientGatts = ConcurrentHashMap<String, BluetoothGatt>()
    private val clientCharacteristics = ConcurrentHashMap<String, BluetoothGattCharacteristic>()
    private var running = false

    private val manager: BluetoothManager?
        get() = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

    @PluginMethod
    fun start(call: PluginCall) {
        val alias = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) "bluetooth" else "location"
        if (getPermissionState(alias) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias, call, "permissionsCallback")
            return
        }
        startMesh(call)
    }

    @PermissionCallback
    private fun permissionsCallback(call: PluginCall) {
        val alias = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) "bluetooth" else "location"
        if (getPermissionState(alias) == PermissionState.GRANTED) startMesh(call) else call.reject("Bluetooth permission denied")
    }

    @SuppressLint("MissingPermission")
    private fun startMesh(call: PluginCall) {
        val adapter = manager?.adapter
        if (adapter == null || !adapter.isEnabled) {
            call.reject("Bluetooth is off or unavailable")
            return
        }
        running = true
        openGattServer()
        adapter.bluetoothLeAdvertiser?.startAdvertising(
            AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
                .setConnectable(true)
                .build(),
            AdvertiseData.Builder().addServiceUuid(ParcelUuid(SERVICE_UUID)).setIncludeDeviceName(false).build(),
            advertiseCallback,
        )
        adapter.bluetoothLeScanner?.startScan(
            listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build()),
            ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_BALANCED).build(),
            scanCallback,
        )
        call.resolve()
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    fun stop(call: PluginCall) {
        running = false
        val adapter = manager?.adapter
        adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
        adapter?.bluetoothLeScanner?.stopScan(scanCallback)
        for (g in clientGatts.values) g.close()
        clientGatts.clear()
        clientCharacteristics.clear()
        subscribedDevices.clear()
        gattServer?.close()
        gattServer = null
        emitPeers()
        call.resolve()
    }

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(JSObject().put("running", running).put("links", linkCount()))
    }

    /** Sends one packet (base64) to every linked phone, in both roles. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    fun send(call: PluginCall) {
        val b64 = call.getString("data") ?: return call.reject("data must be base64")
        val data = Base64.decode(b64, Base64.NO_WRAP)
        val server = gattServer
        val ch = serverCharacteristic
        if (server != null && ch != null) {
            for (device in subscribedDevices.values) {
                if (Build.VERSION.SDK_INT >= 33) {
                    server.notifyCharacteristicChanged(device, ch, false, data)
                } else {
                    @Suppress("DEPRECATION")
                    ch.value = data
                    @Suppress("DEPRECATION")
                    server.notifyCharacteristicChanged(device, ch, false)
                }
            }
        }
        for ((address, gatt) in clientGatts) {
            val remote = clientCharacteristics[address] ?: continue
            if (Build.VERSION.SDK_INT >= 33) {
                gatt.writeCharacteristic(remote, data, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE)
            } else {
                @Suppress("DEPRECATION")
                remote.value = data
                remote.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                @Suppress("DEPRECATION")
                gatt.writeCharacteristic(remote)
            }
        }
        call.resolve()
    }

    private fun linkCount(): Int = (subscribedDevices.keys + clientCharacteristics.keys).toSet().size

    private fun emitPeers() {
        notifyListeners("peers", JSObject().put("links", linkCount()))
    }

    private fun emitPacket(data: ByteArray, from: String) {
        notifyListeners("packet", JSObject().put("data", Base64.encodeToString(data, Base64.NO_WRAP)).put("from", from))
    }

    // ---- Peripheral role

    @SuppressLint("MissingPermission")
    private fun openGattServer() {
        if (gattServer != null) return
        val server = manager?.openGattServer(context, serverCallback) ?: return
        val ch = BluetoothGattCharacteristic(
            CHARACTERISTIC_UUID,
            BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_WRITE or
                BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE,
        )
        ch.addDescriptor(
            BluetoothGattDescriptor(CCCD_UUID, BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE),
        )
        val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        service.addCharacteristic(ch)
        server.addService(service)
        serverCharacteristic = ch
        gattServer = server
    }

    private val serverCallback = object : BluetoothGattServerCallback() {
        @SuppressLint("MissingPermission")
        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?,
        ) {
            if (value != null && characteristic.uuid == CHARACTERISTIC_UUID) emitPacket(value, device.address)
            if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
        }

        @SuppressLint("MissingPermission")
        override fun onDescriptorWriteRequest(
            device: BluetoothDevice, requestId: Int, descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?,
        ) {
            if (descriptor.uuid == CCCD_UUID) {
                if (value != null && value.contentEquals(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)) {
                    subscribedDevices[device.address] = device
                } else {
                    subscribedDevices.remove(device.address)
                }
                emitPeers()
            }
            if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
        }

        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                subscribedDevices.remove(device.address)
                emitPeers()
            }
        }
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartFailure(errorCode: Int) {
            notifyListeners("error", JSObject().put("message", "advertising failed: $errorCode"))
        }
    }

    // ---- Central role

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            if (!running || clientGatts.containsKey(device.address) || clientGatts.size >= MAX_CENTRAL_LINKS) return
            val gatt = device.connectGatt(context, false, clientCallback, BluetoothDevice.TRANSPORT_LE) ?: return
            clientGatts[device.address] = gatt
        }
    }

    private val clientCallback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                gatt.requestMtu(517)
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                clientGatts.remove(gatt.device.address)
                clientCharacteristics.remove(gatt.device.address)
                gatt.close()
                emitPeers()
            }
        }

        @SuppressLint("MissingPermission")
        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            gatt.discoverServices()
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            val ch = gatt.getService(SERVICE_UUID)?.getCharacteristic(CHARACTERISTIC_UUID) ?: return
            clientCharacteristics[gatt.device.address] = ch
            gatt.setCharacteristicNotification(ch, true)
            val cccd = ch.getDescriptor(CCCD_UUID)
            if (cccd != null) {
                if (Build.VERSION.SDK_INT >= 33) {
                    gatt.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                } else {
                    @Suppress("DEPRECATION")
                    cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    @Suppress("DEPRECATION")
                    gatt.writeDescriptor(cccd)
                }
            }
            emitPeers()
        }

        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            emitPacket(value, gatt.device.address)
        }

        @Deprecated("Android 12 and older deliver notifications here")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION")
            val value = characteristic.value ?: return
            emitPacket(value, gatt.device.address)
        }
    }
}
