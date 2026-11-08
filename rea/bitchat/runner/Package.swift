// swift-tools-version: 5.9
// REA reference runner: drives UNMODIFIED bitchat (third_party/bitchat @ pinned SHA) through the parity
// protocol: one JSON fixture on stdin, one JSON result on stdout.
import PackageDescription

let package = Package(
    name: "BitchatReference",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(path: "../../../third_party/bitchat/localPackages/BitFoundation"),
    ],
    targets: [
        .executableTarget(
            name: "bitchat-ref",
            dependencies: [.product(name: "BitFoundation", package: "BitFoundation")],
            path: "Sources/bitchat-ref"
        ),
    ]
)
