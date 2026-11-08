// GrahmOS mesh relay for ESP32.
//
// Phones (GrahmOS Maps, "Connect relay node") connect over BLE to the Nordic UART Service and write
// bitchat-framed packets to RX. The relay:
//   1. notifies every OTHER connected phone on TX (phones in range of one relay can talk), and
//   2. floods the packet over ESP-NOW to neighbouring relays, which do the same (multi-hop, no Wi-Fi network).
// Packets are never parsed: phones verify Ed25519 signatures, TTL and envelope dedupe. The relay only stops
// its own ESP-NOW loops with a ring of recent packet hashes (include/relay_core.h, unit-tested on the host).
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#include "relay_core.h"

namespace {

constexpr char kServiceUuid[] = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char kRxUuid[] = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";  // phone -> relay (write)
constexpr char kTxUuid[] = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";  // relay -> phone (notify)
constexpr uint16_t kFromAir = 0xFFFF;
constexpr uint8_t kBroadcast[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
constexpr uint8_t kEspNowChannel = 1;

struct Packet {
  uint16_t len;
  uint16_t from;  // BLE connection handle, or kFromAir
  uint8_t data[relay::kMaxPacket];
};

QueueHandle_t inbox;
NimBLEServer* server = nullptr;
NimBLECharacteristic* tx = nullptr;
relay::RecentPackets<256> recent;
uint32_t forwardedBle = 0, forwardedAir = 0, dropped = 0;

void enqueue(const uint8_t* data, size_t len, uint16_t from) {
  if (len == 0 || len > relay::kMaxPacket) {
    dropped++;
    return;
  }
  Packet p;
  p.len = static_cast<uint16_t>(len);
  p.from = from;
  memcpy(p.data, data, len);
  if (xQueueSend(inbox, &p, 0) != pdTRUE) dropped++;  // full: drop rather than block a radio task
}

class RxCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo& info) override {
    NimBLEAttValue v = c->getValue();
    enqueue(v.data(), v.size(), info.getConnHandle());
  }
};

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* s, NimBLEConnInfo& info) override {
    Serial.printf("phone connected (%u linked)\n", s->getConnectedCount());
    // Keep advertising so more phones can join, up to CONFIG_BT_NIMBLE_MAX_CONNECTIONS.
    NimBLEDevice::startAdvertising();
  }
  void onDisconnect(NimBLEServer* s, NimBLEConnInfo& info, int reason) override {
    Serial.printf("phone disconnected (reason %d)\n", reason);
  }
};

#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onEspNowReceive(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
#else
void onEspNowReceive(const uint8_t* mac, const uint8_t* data, int len) {
#endif
  if (len > 0) enqueue(data, static_cast<size_t>(len), kFromAir);
}

void startEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(kEspNowChannel, WIFI_SECOND_CHAN_NONE);
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed: relaying between phones on this relay only");
    return;
  }
  esp_now_register_recv_cb(onEspNowReceive);
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, kBroadcast, 6);
  peer.channel = kEspNowChannel;
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

void startBle() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char name[24];
  snprintf(name, sizeof name, "GrahmOS Relay %02X%02X", mac[4], mac[5]);
  NimBLEDevice::init(name);
  NimBLEDevice::setMTU(517);
  server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  server->advertiseOnDisconnect(true);
  NimBLEService* service = server->createService(kServiceUuid);
  NimBLECharacteristic* rx = service->createCharacteristic(kRxUuid, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  rx->setCallbacks(new RxCallbacks());
  tx = service->createCharacteristic(kTxUuid, NIMBLE_PROPERTY::NOTIFY);
  service->start();
  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(kServiceUuid);
  NimBLEAdvertisementData scanResponse;
  scanResponse.setName(name);
  adv->setScanResponseData(scanResponse);
  adv->start();
  Serial.printf("%s advertising\n", name);
}

void forward(const Packet& p) {
  const relay::Route route = relay::route(recent, p.data, p.len);
  if (route == relay::Route::kDrop) {
    dropped++;
    return;
  }
  for (uint16_t conn : server->getPeerDevices()) {
    if (conn == p.from) continue;
    if (tx->notify(p.data, p.len, conn)) forwardedBle++;
  }
  if (route == relay::Route::kPhonesAndAir) {
    if (esp_now_send(kBroadcast, p.data, p.len) == ESP_OK) forwardedAir++;
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  inbox = xQueueCreate(16, sizeof(Packet));
  startEspNow();
  startBle();
}

void loop() {
  Packet p;
  while (xQueueReceive(inbox, &p, pdMS_TO_TICKS(50)) == pdTRUE) forward(p);
  static uint32_t lastReport = 0;
  if (millis() - lastReport > 30000) {
    lastReport = millis();
    Serial.printf("relay: %u phones, %u to phones, %u over air, %u dropped\n", server->getConnectedCount(), forwardedBle, forwardedAir, dropped);
  }
}
