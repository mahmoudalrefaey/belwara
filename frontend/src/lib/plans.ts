/** Monthly plan limits shown on the landing page. Mirrors PLAN_LIMITS in app/config.py. */
export const PLANS = {
  free: { receipts: 30, chat: 50 },
  pro: { receipts: 500, chat: 2000 },
} as const;
