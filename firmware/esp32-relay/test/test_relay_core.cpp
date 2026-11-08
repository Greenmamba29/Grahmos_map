// Host unit test for relay_core.h: g++ -std=c++17 -I../include test_relay_core.cpp && ./a.out
#include <cassert>
#include <cstdio>
#include <cstring>
#include <vector>
#include "relay_core.h"

using relay::Route;

int main() {
  relay::RecentPackets<4> recent;
  const uint8_t a[] = {1, 2, 3};
  const uint8_t b[] = {1, 2, 4};

  // First sighting floods; the same bytes again (an ESP-NOW echo) are dropped.
  assert(relay::route(recent, a, sizeof a) == Route::kPhonesAndAir);
  assert(relay::route(recent, a, sizeof a) == Route::kDrop);
  assert(relay::route(recent, b, sizeof b) == Route::kPhonesAndAir);

  // Empty and oversized packets are dropped.
  assert(relay::route(recent, a, 0) == Route::kDrop);
  std::vector<uint8_t> huge(relay::kMaxPacket + 1, 7);
  assert(relay::route(recent, huge.data(), huge.size()) == Route::kDrop);

  // Too big for ESP-NOW but valid over BLE: phones on this relay only.
  std::vector<uint8_t> big(300, 9);
  assert(relay::route(recent, big.data(), big.size()) == Route::kPhonesOnly);

  // The ring forgets after N entries, so a packet can travel again much later.
  relay::RecentPackets<2> small;
  const uint8_t c[] = {5}, d[] = {6}, e[] = {7};
  assert(!small.seenOrAdd(c, 1));
  assert(!small.seenOrAdd(d, 1));
  assert(!small.seenOrAdd(e, 1));
  assert(!small.seenOrAdd(c, 1));  // evicted, so new again
  assert(small.size() == 2);

  // Same bytes, different length prefix: distinct hashes.
  const uint8_t f[] = {0, 0};
  relay::RecentPackets<4> r2;
  assert(!r2.seenOrAdd(f, 1));
  assert(!r2.seenOrAdd(f, 2));

  std::puts("relay_core: all tests passed");
  return 0;
}
