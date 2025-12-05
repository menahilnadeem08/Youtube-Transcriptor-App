# Stripe Integration - Credentials Checklist

Use this checklist to request the necessary credentials from your team lead to complete the Stripe payment integration.

## Required Credentials

### 1. Stripe API Keys

**For Development/Testing:**
- [ ] **Stripe Test Secret Key** (`sk_test_...`)
  - Location: Stripe Dashboard → Developers → API keys → Test mode
  - Used for: Creating checkout sessions and verifying payments in development
  - **Environment Variable:** `STRIPE_SECRET_KEY`

- [ ] **Stripe Test Publishable Key** (`pk_test_...`) *(Optional - for future frontend integration)*
  - Location: Stripe Dashboard → Developers → API keys → Test mode
  - Used for: Client-side Stripe integration (if needed)

**For Production:**
- [ ] **Stripe Live Secret Key** (`sk_live_...`)
  - Location: Stripe Dashboard → Developers → API keys → Live mode
  - Used for: Production payment processing
  - **Environment Variable:** `STRIPE_SECRET_KEY` (production)

- [ ] **Stripe Live Publishable Key** (`pk_live_...`) *(Optional)*
  - Location: Stripe Dashboard → Developers → API keys → Live mode

---

### 2. Stripe Webhook Configuration (Production Only)

- [ ] **Webhook Signing Secret** (`whsec_...`)
  - Location: Stripe Dashboard → Developers → Webhooks → [Your Webhook Endpoint] → Signing secret
  - Used for: Verifying webhook events are from Stripe
  - **Environment Variable:** `STRIPE_WEBHOOK_SECRET`
  - **Note:** This is created after setting up the webhook endpoint

- [ ] **Webhook Endpoint URL** (to be configured)
  - Format: `https://your-domain.com/api/webhook`
  - Action Required: Team lead needs to add this endpoint in Stripe Dashboard
  - Events to listen for: `checkout.session.completed`

---

### 3. Stripe Price IDs (Optional - Recommended for Production)

If your team lead wants to use Stripe Price IDs instead of dynamic pricing:

- [ ] **Basic Plan Price ID** (`price_...`)
  - For: $5.00 Basic Plan
  - **Environment Variable:** `STRIPE_PRICE_ID_BASIC`
  - **Note:** Create a product/price in Stripe Dashboard, then use the Price ID

- [ ] **Premium Plan Price ID** (`price_...`)
  - For: $10.00 Premium Plan
  - **Environment Variable:** `STRIPE_PRICE_ID_PREMIUM`
  - **Note:** Create a product/price in Stripe Dashboard, then use the Price ID

**Alternative:** If Price IDs are not provided, the system will use dynamic pricing ($5 and $10) configured in code.

---

### 4. Application URLs

- [ ] **Frontend URL** (Development)
  - Example: `http://localhost:5173`
  - **Environment Variable:** `FRONTEND_URL`
  - Used for: Payment success/cancel redirects

- [ ] **Frontend URL** (Production)
  - Example: `https://your-domain.com`
  - **Environment Variable:** `FRONTEND_URL` (production)
  - Used for: Payment success/cancel redirects

- [ ] **Backend URL** (Production)
  - Example: `https://api.your-domain.com` or `https://your-domain.com/api`
  - Used for: Webhook endpoint configuration

---

## Environment Variables Summary

Add these to your `backend/.env` file:

```bash
# Stripe Configuration (Required)
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production

# Payment Settings
PAYMENT_REQUIRED=true           # Set to 'false' to disable payments during development

# Frontend URL (Required)
FRONTEND_URL=http://localhost:5173  # Development
# FRONTEND_URL=https://your-domain.com  # Production

# Webhook Secret (Required for production)
STRIPE_WEBHOOK_SECRET=whsec_...  # Only needed in production

# Optional: Stripe Price IDs (if using Stripe Dashboard products)
STRIPE_PRICE_ID_BASIC=price_...   # For $5 plan
STRIPE_PRICE_ID_PREMIUM=price_... # For $10 plan
```

---

## Setup Steps for Team Lead

### Step 1: Create Stripe Account (if not already created)
1. Go to https://stripe.com
2. Sign up or log in
3. Complete account verification

### Step 2: Get API Keys
1. Navigate to: Dashboard → Developers → API keys
2. Copy the **Secret key** (starts with `sk_test_` for testing)
3. Share with development team

### Step 3: Create Products/Prices (Optional but Recommended)
1. Navigate to: Dashboard → Products
2. Create two products:
   - **Basic Plan** - $5.00
   - **Premium Plan** - $10.00
3. Copy the Price IDs (starts with `price_`)
4. Share with development team

### Step 4: Set Up Webhook (Production Only)
1. Navigate to: Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter endpoint URL: `https://your-backend-domain.com/api/webhook`
4. Select event: `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Share with development team

---

## Testing Credentials

For testing, you can use Stripe's test mode:

**Test Card Numbers:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Use any future expiry date (e.g., 12/25)
- Use any 3-digit CVC (e.g., 123)

**Test Mode:**
- All test transactions appear in Stripe Dashboard → Payments (Test mode)
- No real charges are made
- Perfect for development and QA testing

---

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit API keys to Git** - Always use `.env` files (already in `.gitignore`)
2. **Secret keys are sensitive** - Only share via secure channels (not email/Slack)
3. **Use test keys for development** - Never use live keys in development
4. **Rotate keys if compromised** - Can be done in Stripe Dashboard
5. **Webhook secrets** - Required for production to verify webhook authenticity

---

## Quick Request Template

Copy and send this to your team lead:

```
Hi [Team Lead],

I need the following Stripe credentials to complete the payment integration:

1. Stripe Test Secret Key (sk_test_...) - for development
2. Stripe Live Secret Key (sk_live_...) - for production
3. Frontend URL for payment redirects
4. (Optional) Stripe Price IDs for Basic ($5) and Premium ($10) plans
5. (Production) Webhook signing secret after webhook endpoint is configured

The webhook endpoint will be: https://[backend-domain]/api/webhook
Event needed: checkout.session.completed

Please share these via [secure method] when available.

Thanks!
```

---

## Verification Checklist

After receiving credentials, verify:

- [ ] Test Secret Key works (create a test checkout session)
- [ ] Frontend URL redirects work correctly
- [ ] Payment flow completes successfully
- [ ] Webhook receives events (production)
- [ ] Test payments appear in Stripe Dashboard
- [ ] Environment variables are set correctly
- [ ] `.env` file is in `.gitignore` (already configured)

---

## Support Resources

- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Documentation: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
- Stripe Support: https://support.stripe.com

---

**Last Updated:** Based on current integration implementation
**Integration Status:** Ready for credentials

