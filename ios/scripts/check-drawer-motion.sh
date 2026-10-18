#!/bin/bash
# Records the in-app drawer demo (-NorthstarDrawerDemo YES, Debug builds) on a booted simulator and prints the
# drawer's position in every captured frame. A correct release continues from the finger position; a frame that
# jumps back toward the previous resting height is the bug this guards against.
# Usage: scripts/check-drawer-motion.sh <simulator-udid>   (the app must already be signed in on that simulator)
set -euo pipefail
SIM=$1
cd "$(dirname "$0")/.."
xcodebuild -project Northstar.xcodeproj -scheme Northstar -destination "id=$SIM" -derivedDataPath /tmp/ns-drawer-dd build -quiet
xcrun simctl install "$SIM" /tmp/ns-drawer-dd/Build/Products/Debug-iphonesimulator/Northstar.app
xcrun simctl terminate "$SIM" com.morrison.northstar 2>/dev/null || true
xcrun simctl io "$SIM" recordVideo --codec h264 --force /tmp/ns-drawer-demo.mp4 >/dev/null 2>&1 & REC=$!
sleep 1
xcrun simctl launch "$SIM" com.morrison.northstar -NorthstarDrawerDemo YES >/dev/null
sleep 22
kill -INT $REC; sleep 2
python3 scripts/track_drawer.py /tmp/ns-drawer-demo.mp4
