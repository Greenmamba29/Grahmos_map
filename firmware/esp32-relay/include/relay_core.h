// Pure relay logic (no Arduino/ESP-IDF): dedupe and forwarding decisions, unit-tested on the host
// (test/test_relay_core.cpp) and used by src/main.cpp on the ESP32.
//
// Packets are opaque bitchat-framed GrahmOS envelopes (or bitchat fragments): the relay never parses them.
// Phones enforce signatures, TTL and envelope dedupe; the relay only needs to stop its OWN radio loops
// (ESP-NOW floods between relays), which a ring of recent packet hashes does.
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace relay {

// ESP-NOW v1 payload limit. bitchat fragments for 180-byte links are well under it.
constexpr size_t kEspNowMaxPayload = 250;
// Largest packet accepted from a phone (one BLE write; long writes allow 512).
constexpr size_t kMaxPacket = 512;

inline uint32_t fnv1a(const uint8_t* data, size_t len) {
  uint32_t h = 2166136261u;
  for (size_t i = 0; i < len; i++) {
    h ^= data[i];
    h *= 16777619u;
  }
  return h;
}

// Remembers the last N packet hashes. seenOrAdd() returns true for a packet already relayed recently.
template <size_t N>
class RecentPackets {
 public:
  bool seenOrAdd(const uint8_t* data, size_t len) {
    const uint32_t h = fnv1a(data, len) ^ static_cast<uint32_t>(len) * 0x9E3779B1u;
    for (size_t i = 0; i < count_; i++) {
      if (ring_[i] == h) return true;
    }
    ring_[next_] = h;
    next_ = (next_ + 1) % N;
    if (count_ < N) count_++;
    return false;
  }
  size_t size() const { return count_; }

 private:
  uint32_t ring_[N] = {};
  size_t next_ = 0;
  size_t count_ = 0;
};

enum class Route : uint8_t {
  kDrop = 0,           // empty, oversized, or a loop
  kPhonesOnly = 1,     // too big for ESP-NOW: other phones on this relay only
  kPhonesAndAir = 2,   // other phones + flood to neighbouring relays
};

// Decision for a packet that arrived from a phone (BLE write) or from another relay (ESP-NOW).
template <size_t N>
Route route(RecentPackets<N>& recent, const uint8_t* data, size_t len) {
  if (len == 0 || len > kMaxPacket) return Route::kDrop;
  if (recent.seenOrAdd(data, len)) return Route::kDrop;
  return len <= kEspNowMaxPayload ? Route::kPhonesAndAir : Route::kPhonesOnly;
}

}  // namespace relay
