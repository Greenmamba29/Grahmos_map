import BitFoundation
import Foundation

// One fixture in (stdin), one result out (stdout). Bytes travel as lowercase hex; UInt64 as decimal strings.

func hex(_ d: Data) -> String { d.hexEncodedString() }
func bytes(_ s: String?) -> Data? { s.flatMap { Data(hexString: $0) } }

func packetFrom(_ j: [String: Any]) -> BitchatPacket {
    let route = (j["route"] as? [String])?.compactMap { Data(hexString: $0) }
    return BitchatPacket(
        type: UInt8(j["type"] as? Int ?? 0),
        senderID: bytes(j["senderID"] as? String) ?? Data(),
        recipientID: bytes(j["recipientID"] as? String),
        timestamp: UInt64(j["timestamp"] as? String ?? "0") ?? 0,
        payload: bytes(j["payload"] as? String) ?? Data(),
        signature: bytes(j["signature"] as? String),
        ttl: UInt8(j["ttl"] as? Int ?? 0),
        version: UInt8(j["version"] as? Int ?? 1),
        route: route,
        isRSR: j["isRSR"] as? Bool ?? false
    )
}

func packetJSON(_ p: BitchatPacket) -> [String: Any] {
    var o: [String: Any] = [
        "version": Int(p.version), "type": Int(p.type), "ttl": Int(p.ttl),
        "timestamp": String(p.timestamp), "senderID": hex(p.senderID), "payload": hex(p.payload),
        "isRSR": p.isRSR,
    ]
    o["recipientID"] = p.recipientID.map(hex) ?? NSNull()
    o["signature"] = p.signature.map(hex) ?? NSNull()
    o["route"] = p.route.map { $0.map(hex) } ?? NSNull()
    return o
}

func run(_ input: [String: Any]) -> Any {
    let op = input["op"] as? String ?? ""
    switch op {
    case "encode":
        let p = packetFrom(input["packet"] as? [String: Any] ?? [:])
        let padding = input["padding"] as? Bool ?? true
        return p.toBinaryData(padding: padding).map(hex) ?? NSNull()
    case "decode":
        guard let d = bytes(input["hex"] as? String) else { return NSNull() }
        return BinaryProtocol.decode(d).map(packetJSON) ?? NSNull()
    case "signingBytes":
        let p = packetFrom(input["packet"] as? [String: Any] ?? [:])
        return p.toBinaryDataForSigning().map(hex) ?? NSNull()
    case "packetId":
        return hex(PacketIdUtil.computeId(packetFrom(input["packet"] as? [String: Any] ?? [:])))
    case "gcsBuild":
        let ids = (input["ids"] as? [String] ?? []).compactMap { Data(hexString: $0) }
        let params = GCSFilter.buildFilter(
            ids: ids,
            maxBytes: input["maxBytes"] as? Int ?? 400,
            targetFpr: input["targetFpr"] as? Double ?? 0.01
        )
        let sorted = GCSFilter.decodeToSortedSet(p: params.p, m: params.m, data: params.data)
        let membership = ids.map { GCSFilter.contains(sortedValues: sorted, candidate: GCSFilter.bucket(for: $0, modulus: params.m)) }
        return ["p": params.p, "m": Int(params.m), "data": hex(params.data), "includedCount": params.includedCount,
                "decoded": sorted.map { String($0) }, "membership": membership] as [String: Any]
    case "gcsDecode":
        let values = GCSFilter.decodeToSortedSet(
            p: input["p"] as? Int ?? 1, m: UInt32(input["m"] as? Int ?? 1), data: bytes(input["data"] as? String) ?? Data())
        return values.map { String($0) }
    case "gcsBucket":
        return String(GCSFilter.bucket(for: bytes(input["id"] as? String) ?? Data(), modulus: UInt32(input["m"] as? Int ?? 1)))
    case "fragmentPlan":
        let p = packetFrom(input["packet"] as? [String: Any] ?? [:])
        let directed: PeerID? = (input["directedPeer"] as? String).map { (s: String) -> PeerID in PeerID(str: s) }
        let request = BLEOutboundFragmentTransferRequest(
            packet: p, pad: input["pad"] as? Bool ?? false, maxChunk: input["maxChunk"] as? Int, directedPeer: directed)
        guard let plan = BLEOutboundFragmentPlanner.makePlan(
            for: request,
            defaultChunkSize: input["defaultChunkSize"] as? Int ?? 469,
            bleMaxMTU: input["bleMaxMTU"] as? Int ?? 512,
            fragmentID: bytes(input["fragmentID"] as? String) ?? Data(repeating: 0, count: 8)
        ) else { return NSNull() }
        return [
            "chunkSize": plan.chunkSize, "fragmentVersion": Int(plan.fragmentVersion), "spacingMs": plan.spacingMs,
            "fragments": plan.fragmentPackets.map(packetJSON),
        ] as [String: Any]
    case "reassemble":
        var buffer = BLEFragmentAssemblyBuffer()
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        var results: [[String: Any]] = []
        for f in input["fragments"] as? [[String: Any]] ?? [] {
            guard let header = BLEFragmentHeader(packet: packetFrom(f)) else {
                results.append(["result": "invalid"])
                continue
            }
            switch buffer.append(header, maxInFlightAssemblies: input["maxInFlight"] as? Int ?? 128, now: now) {
            case let .stored(_, started):
                results.append(["result": "stored", "started": started])
            case let .complete(h, data, started):
                results.append(["result": "complete", "started": started, "originalType": Int(h.originalType), "data": hex(data)])
            case let .oversized(_, projected, limit, started):
                results.append(["result": "oversized", "started": started, "projectedSize": projected, "limit": limit])
            }
        }
        return results
    default:
        return ["error": "unknown op \(op)"]
    }
}

let raw = FileHandle.standardInput.readDataToEndOfFile()
let input = (try? JSONSerialization.jsonObject(with: raw)) as? [String: Any] ?? [:]
let output = run(input)
let data = try JSONSerialization.data(withJSONObject: ["out": output], options: [.sortedKeys])
FileHandle.standardOutput.write(data)
