export interface AlertDto {
  id: string;
  userId: string;
  type: "booking_cancelled" | "waitlist_opening";
  driveId: string | null;
  requestId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}
