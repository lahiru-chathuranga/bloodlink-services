import type { OtpPurpose } from "@prisma/client";

function baseLayout(body: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #B91C1C;">BloodLink</h1>
      ${body}
      <p style="color: #888; font-size: 12px; margin-top: 32px;">This is an automated message from BloodLink.</p>
    </div>
  `;
}

const COPY: Record<OtpPurpose, { subject: string; intro: string }> = {
  register: {
    subject: "Verify your BloodLink account",
    intro: "Welcome! Use this code to verify your email:",
  },
  reset_password: {
    subject: "Reset your BloodLink password",
    intro: "Use this code to reset your password. If this wasn't you, ignore this email.",
  },
  staff_invite: {
    subject: "Activate your BloodLink staff account",
    intro: "Your hospital staff account is ready. Use this code to log in for the first time.",
  },
};

export function otpEmail(purpose: OtpPurpose, code: string): { subject: string; html: string } {
  const copy = COPY[purpose];
  return {
    subject: copy.subject,
    html: baseLayout(`<p>${copy.intro}</p><h2 style="letter-spacing: 4px;">${code}</h2><p>This code expires in 10 minutes.</p>`),
  };
}
