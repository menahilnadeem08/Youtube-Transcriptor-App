### Step 1: Go to Stripe Dashboard
1. Login to https://dashboard.stripe.com
2. Click **Developers** → **Webhooks**

### Step 2: Add Endpoint
1. Click **Add endpoint**
2. Enter your URL: `https://yourdomain.com/api/webhook`

### Step 3: Select Events
Select these events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Step 4: Copy Signing Secret
1. Click on your webhook
2. Click **Reveal** under "Signing secret"
3. Copy the secret (starts with `whsec_`)

### Step 5: Add to Production .env
```env
STRIPE_WEBHOOK_SECRET=whsec_your_production_secret_here
```

Done! Your production webhooks are ready.

---

## Test Webhook

Create a test subscription:
```bash
curl -X POST http://localhost:3000/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"videoUrl":"https://youtube.com/watch?v=test","planId":"basic","targetLanguage":"Spanish"}'
```

Check your terminal - you should see webhook events logged.

## Troubleshooting

