import BitFoundation

// REA shim (runner scaffolding, not upstream code). Upstream declares this struct in
// BLEOutboundFragmentTransferScheduler.swift next to the BLE scheduling machinery; the planner only reads
// these four fields, so the runner declares just those instead of compiling the scheduler.
struct BLEOutboundFragmentTransferRequest {
    let packet: BitchatPacket
    let pad: Bool
    let maxChunk: Int?
    let directedPeer: PeerID?
}
