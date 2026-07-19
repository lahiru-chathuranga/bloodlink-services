import type { BloodType } from "../constants/blood-type";

// Standard ABO/Rh donor compatibility, keyed by recipient type -> the donor
// types that can safely give to them. O- is the universal donor (can give to
// everyone); AB+ is the universal recipient (can receive from everyone) but
// can only donate to other AB+ patients.
const COMPATIBLE_DONORS: Record<BloodType, readonly BloodType[]> = {
  "A+": ["A+", "A-", "O+", "O-"],
  "A-": ["A-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  "AB-": ["A-", "B-", "AB-", "O-"],
  "O+": ["O+", "O-"],
  "O-": ["O-"],
};

// Both params come in as plain strings (already decrypted / user-supplied at
// the call sites) rather than BloodType, since not every caller has narrowed
// the type yet — an unrecognized recipientBloodType just matches nobody.
export function isCompatibleDonor(donorBloodType: string, recipientBloodType: string): boolean {
  const donors = COMPATIBLE_DONORS[recipientBloodType as BloodType] as readonly string[] | undefined;
  return donors ? donors.includes(donorBloodType) : false;
}
