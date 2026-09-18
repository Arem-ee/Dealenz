// Revenue-share accounting (Phase 3) — deterministic 80/20, auditable
// Credits never become cash. Service_orders amount is professional-service money, separate ledger.

export function calculateRevenueShare(amountMinor: number): { platformFeeMinor: number; lawyerPayoutMinor: number } {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new Error("Invalid amount")
  const platformFeeMinor = Math.floor(amountMinor * 0.2) // 20% deterministic
  const lawyerPayoutMinor = amountMinor - platformFeeMinor
  return { platformFeeMinor, lawyerPayoutMinor }
}

export function verifyRevenueAccounting(payment: { amountMinor: number; platformFeeMinor: number; lawyerPayoutMinor: number }): boolean {
  return payment.platformFeeMinor + payment.lawyerPayoutMinor === payment.amountMinor
}
