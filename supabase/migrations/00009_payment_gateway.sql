
-- ═══════════════════════════════════════════════════════════════════════════
-- Payment Gateway Settings + UPI Configuration
-- ═══════════════════════════════════════════════════════════════════════════

-- Payments table: stores all payment records
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('beginner', 'daily', 'pro')),
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  method text NOT NULL CHECK (method IN ('upi', 'card', 'netbanking', 'wallet', 'manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'expired')),
  transaction_id text,
  upi_id text,
  upi_transaction_ref text,
  payment_gateway text DEFAULT 'manual',
  metadata jsonb DEFAULT '{}',
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can read their own payments
CREATE POLICY "payments_select_own" ON payments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own payments (initiate)
CREATE POLICY "payments_insert_own" ON payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only service role can update payment status (webhook/callback)
-- Admin can update via service role

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- Payment Gateway Platform Settings
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO platform_settings (key, value, description) VALUES
  -- UPI Configuration
  ('payment_upi_enabled', 'true', 'Enable UPI payments'),
  ('payment_upi_id', '"berinjohn@upi"', 'Primary UPI ID for receiving payments'),
  ('payment_upi_name', '"Faceless Platform"', 'Name shown on UPI payment screen'),
  ('payment_upi_qr_enabled', 'true', 'Show QR code for UPI payments'),
  ('payment_upi_merchant_code', '""', 'UPI merchant code (optional)'),

  -- General Payment Settings
  ('payment_enabled', 'true', 'Master switch for all payments'),
  ('payment_currency', '"INR"', 'Default payment currency'),
  ('payment_currency_symbol', '"₹"', 'Currency symbol for display'),
  ('payment_gateway', '"manual"', 'Active payment gateway (manual, razorpay, stripe, cashfree)'),

  -- Razorpay (optional)
  ('payment_razorpay_enabled', 'false', 'Enable Razorpay gateway'),
  ('payment_razorpay_key_id', '""', 'Razorpay Key ID'),
  ('payment_razorpay_key_secret', '""', 'Razorpay Key Secret'),

  -- Stripe (optional)
  ('payment_stripe_enabled', 'false', 'Enable Stripe gateway'),
  ('payment_stripe_publishable_key', '""', 'Stripe Publishable Key'),
  ('payment_stripe_secret_key', '""', 'Stripe Secret Key'),

  -- Cashfree (optional)
  ('payment_cashfree_enabled', 'false', 'Enable Cashfree gateway'),
  ('payment_cashfree_app_id', '""', 'Cashfree App ID'),
  ('payment_cashfree_secret_key', '""', 'Cashfree Secret Key'),

  -- Payment Behavior
  ('payment_expiry_minutes', '30', 'Payment link/expiry time in minutes'),
  ('payment_retry_allowed', 'true', 'Allow retrying failed payments'),
  ('payment_auto_activate', 'true', 'Auto-activate plan after successful payment'),
  ('payment_receipt_enabled', 'true', 'Generate payment receipts'),
  ('payment_success_redirect', '"/dashboard"', 'Redirect URL after successful payment'),
  ('payment_failed_redirect', '"/settings"', 'Redirect URL after failed payment'),

  -- Subscription Settings
  ('subscription_expiry_enabled', 'true', 'Expire subscriptions at period end'),
  ('subscription_grace_period_days', '3', 'Grace period after subscription expiry'),
  ('subscription_auto_renew_reminder', 'true', 'Send reminder before renewal'),

  -- Tax & Compliance
  ('payment_gst_enabled', 'false', 'Apply GST on payments'),
  ('payment_gst_rate', '18', 'GST rate in percentage'),
  ('payment_gst_number', '""', 'GSTIN number'),
  ('payment_invoice_prefix', '"FVL-"', 'Invoice number prefix'),
  ('payment_invoice_start', '1001', 'Starting invoice number')

ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;
