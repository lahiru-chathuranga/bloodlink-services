import { randomBytes } from "crypto";

// The stored identifier string is what the mobile app renders on-device via
// react-native-qrcode-svg (decisions-log G1) — this backend only needs to
// generate a unique, unguessable identifier once, at first profile completion.
export function generateQrIdentifier(): string {
  return `bl_${randomBytes(16).toString("hex")}`;
}
