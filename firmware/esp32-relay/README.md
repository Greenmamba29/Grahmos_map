# GrahmOS mesh relay (ESP32)

A ~$5 ESP32 board that extends the GrahmOS Maps mesh beyond Bluetooth range of a single phone.

- **Phones** connect to it over BLE (Nordic UART Service) from GrahmOS Maps → Mesh → *Connect relay node*.
- **Every packet** a phone writes is sent to every other phone on the relay and flooded over **ESP-NOW** to
  other relays nearby (~200 m line of sight, no Wi-Fi network or internet), which pass it on.
- Packets are bitchat-framed, Ed25519-signed GrahmOS envelopes. The relay never parses or alters them;
  phones verify signatures and drop duplicates. The relay only stops its own ESP-NOW loops.

```bash
pip install platformio
pio run                  # build for esp32dev (pio run -e esp32-s3 for S3 boards)
pio run -t upload        # flash over USB
pio device monitor       # stats every 30 s
```

Host unit test for the forwarding logic (no board needed):
`g++ -std=c++17 -Iinclude test/test_relay_core.cpp && ./a.out`

Limits: 4 phones per relay (raise `CONFIG_BT_NIMBLE_MAX_CONNECTIONS`, up to 9 on ESP32), ESP-NOW frames up
to 250 bytes (bitchat fragments for 180-byte links fit; bigger packets stay on the local relay), all relays
on ESP-NOW channel 1. For kilometre range, pair a relay with a MeshCore LoRa radio (see INSTALLATION_GUIDE.md).
