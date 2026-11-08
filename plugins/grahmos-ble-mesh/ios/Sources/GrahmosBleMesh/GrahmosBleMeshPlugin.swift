import Capacitor
import CoreBluetooth
import Foundation

/// Phone-to-phone BLE mesh link (dual role, after bitchat's BLEService design, Unlicense):
/// - Peripheral: advertises the GrahmOS mesh service with one characteristic (write + notify).
/// - Central: scans for the same service, connects to every phone found, subscribes to its notifications.
/// Packets are opaque bytes (bitchat-framed GrahmOS envelopes); the JS mesh layer dedupes and verifies.
@objc(GrahmosBleMeshPlugin)
public class GrahmosBleMeshPlugin: CAPPlugin, CAPBridgedPlugin, CBPeripheralManagerDelegate, CBCentralManagerDelegate, CBPeripheralDelegate {
    public let identifier = "GrahmosBleMeshPlugin"
    public let jsName = "GrahmosBleMesh"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    static let serviceUUID = CBUUID(string: "6C1A4E8E-7B2F-4C1E-9A3D-5F2B8C7D9E01")
    static let characteristicUUID = CBUUID(string: "6C1A4E8E-7B2F-4C1E-9A3D-5F2B8C7D9E02")
    static let maxCentralLinks = 7

    private var peripheralManager: CBPeripheralManager?
    private var centralManager: CBCentralManager?
    private var meshCharacteristic: CBMutableCharacteristic?
    private var subscribedCentrals: [UUID: CBCentral] = [:]
    private var connectedPeripherals: [UUID: CBPeripheral] = [:]
    private var remoteCharacteristics: [UUID: CBCharacteristic] = [:]
    /// Notifications the stack refused (queue full); flushed on peripheralManagerIsReady.
    private var pendingNotifications: [Data] = []
    private var running = false
    private let queue = DispatchQueue(label: "com.grahmos.blemesh")

    @objc func start(_ call: CAPPluginCall) {
        queue.async {
            self.running = true
            if self.peripheralManager == nil {
                self.peripheralManager = CBPeripheralManager(delegate: self, queue: self.queue)
            }
            if self.centralManager == nil {
                self.centralManager = CBCentralManager(delegate: self, queue: self.queue)
            }
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        queue.async {
            self.running = false
            self.peripheralManager?.stopAdvertising()
            self.peripheralManager?.removeAllServices()
            self.centralManager?.stopScan()
            for p in self.connectedPeripherals.values { self.centralManager?.cancelPeripheralConnection(p) }
            self.connectedPeripherals.removeAll()
            self.remoteCharacteristics.removeAll()
            self.subscribedCentrals.removeAll()
            self.pendingNotifications.removeAll()
            self.emitPeers()
            call.resolve()
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        queue.async {
            call.resolve(["running": self.running, "links": self.linkCount()])
        }
    }

    /// Sends one packet (base64) to every linked phone, in both roles.
    @objc func send(_ call: CAPPluginCall) {
        guard let b64 = call.getString("data"), let data = Data(base64Encoded: b64) else {
            call.reject("data must be base64")
            return
        }
        queue.async {
            // As peripheral: notify subscribed centrals.
            if let ch = self.meshCharacteristic, !self.subscribedCentrals.isEmpty {
                if self.peripheralManager?.updateValue(data, for: ch, onSubscribedCentrals: nil) != true {
                    self.pendingNotifications.append(data)
                }
            }
            // As central: write to every connected phone's characteristic.
            for (id, peripheral) in self.connectedPeripherals {
                guard let ch = self.remoteCharacteristics[id] else { continue }
                let max = peripheral.maximumWriteValueLength(for: .withoutResponse)
                let type: CBCharacteristicWriteType = data.count <= max ? .withoutResponse : .withResponse
                peripheral.writeValue(data, for: ch, type: type)
            }
            call.resolve()
        }
    }

    private func linkCount() -> Int {
        Set(subscribedCentrals.keys).union(remoteCharacteristics.keys).count
    }

    private func emitPeers() {
        notifyListeners("peers", data: ["links": linkCount()])
    }

    private func emitPacket(_ data: Data, from: UUID) {
        notifyListeners("packet", data: ["data": data.base64EncodedString(), "from": from.uuidString])
    }

    // MARK: - Peripheral role

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard peripheral.state == .poweredOn, running else { return }
        let ch = CBMutableCharacteristic(
            type: Self.characteristicUUID,
            properties: [.notify, .write, .writeWithoutResponse],
            value: nil,
            permissions: [.writeable]
        )
        let service = CBMutableService(type: Self.serviceUUID, primary: true)
        service.characteristics = [ch]
        meshCharacteristic = ch
        peripheral.removeAllServices()
        peripheral.add(service)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        guard error == nil, running else { return }
        peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [Self.serviceUUID]])
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        subscribedCentrals[central.identifier] = central
        emitPeers()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        subscribedCentrals.removeValue(forKey: central.identifier)
        emitPeers()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            if let value = request.value { emitPacket(value, from: request.central.identifier) }
        }
        if let first = requests.first { peripheral.respond(to: first, withResult: .success) }
    }

    public func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
        guard let ch = meshCharacteristic else { return }
        while let next = pendingNotifications.first {
            if peripheral.updateValue(next, for: ch, onSubscribedCentrals: nil) {
                pendingNotifications.removeFirst()
            } else {
                return
            }
        }
    }

    // MARK: - Central role

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state == .poweredOn, running else { return }
        central.scanForPeripherals(withServices: [Self.serviceUUID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard running, connectedPeripherals[peripheral.identifier] == nil, connectedPeripherals.count < Self.maxCentralLinks else { return }
        connectedPeripherals[peripheral.identifier] = peripheral
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices([Self.serviceUUID])
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connectedPeripherals.removeValue(forKey: peripheral.identifier)
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        connectedPeripherals.removeValue(forKey: peripheral.identifier)
        remoteCharacteristics.removeValue(forKey: peripheral.identifier)
        emitPeers()
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let service = peripheral.services?.first(where: { $0.uuid == Self.serviceUUID }) else { return }
        peripheral.discoverCharacteristics([Self.characteristicUUID], for: service)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let ch = service.characteristics?.first(where: { $0.uuid == Self.characteristicUUID }) else { return }
        remoteCharacteristics[peripheral.identifier] = ch
        peripheral.setNotifyValue(true, for: ch)
        emitPeers()
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, let value = characteristic.value else { return }
        emitPacket(value, from: peripheral.identifier)
    }
}
