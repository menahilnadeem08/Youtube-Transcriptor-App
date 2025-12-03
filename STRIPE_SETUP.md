# Stripe Payment Integration Guide

This guide explains how to set up and use Stripe payments in the YouTube Transcript Generator.

## Overview

The application now supports Stripe payments for transcript generation. Users must complete payment before generating transcripts.

## Setup Instructions

> **📋 Need credentials?** See [CREDENTIALS_CHECKLIST.md](./CREDENTIALS_CHECKLIST.md) for a complete list of credentials to request from your team lead.

### 1. Create a Stripe Account

1. Go to [https://stripe.com](https://stripe.com) and create an account
2. Complete the account setup and verification process
3. Navigate to the Dashboard to get your API keys

### 2. Get Your Stripe API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy your **Secret key** (starts with `sk_`)
   - For testing, use the **Test mode** keys (`sk_test_...`)
   - For production, use the **Live mode** keys (`sk_live_...`)
3. **Note:** Publishable key is optional for this integration (not currently used)

### 3. Set Up Webhook (Production Only)

For production deployments, you need to set up a webhook endpoint:

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://your-domain.com/api/webhook`
4. Select the event: `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`)

### 4. Configure Environment Variables

Add the following variables to your `backend/.env` file:

```bash
# Stripe Configuration (Required)
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key (get from team lead)

# Payment Settings
PAYMENT_REQUIRED=true          # Set to 'false' to disable payments (default: true)

# Pricing Plans (configured in code - $5 Basic, $10 Premium)
# Optional: Override with Stripe Price IDs from Dashboard
STRIPE_PRICE_ID_BASIC=price_...    # Optional: Stripe Price ID for $5 plan
STRIPE_PRICE_ID_PREMIUM=price_...  # Optional: Stripe Price ID for $10 plan

# Frontend URL (Required for payment redirects)
FRONTEND_URL=http://localhost:5173  # For development
# FRONTEND_URL=https://your-domain.com  # For production

# Webhook Secret (Required for production)
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook signing secret (get from team lead)
```

### 5. Frontend Configuration (Optional)

If your frontend is on a different domain, update the frontend `.env` file:

```bash
VITE_API_URL=http://localhost:3000/api  # Backend API URL
```

## Payment Flow

1. **User enters video URL and selects language**
2. **User clicks "Pay & Generate Transcript"**
3. **User is redirected to Stripe Checkout**
4. **User completes payment**
5. **User is redirected back to the app**
6. **Transcript generation starts automatically**

## Testing with Stripe Test Mode

1. Use Stripe test API keys (start with `sk_test_` and `pk_test_`)
2. Use Stripe test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Use any future expiry date and any 3-digit CVC
3. Test the complete flow in your application

## Production Deployment

### Important Notes:

1. **Use Live Mode Keys**: Switch to production API keys (`sk_live_` and `pk_live_`)
2. **Set Up Webhook**: Configure the webhook endpoint in Stripe Dashboard
3. **HTTPS Required**: Stripe requires HTTPS for production
4. **Update Frontend URL**: Set `FRONTEND_URL` to your production domain
5. **Webhook Security**: Always verify webhook signatures in production

### Webhook Endpoint

The webhook endpoint is at: `POST /api/webhook`

It handles the `checkout.session.completed` event to mark payments as verified.

## Disabling Payments (Development)

To disable payments during development, set in `backend/.env`:

```bash
PAYMENT_REQUIRED=false
```

This allows transcript generation without payment verification.

## Pricing Plans

The application supports two pricing plans:

1. **Basic Plan** - $5.00
   - Standard transcript and translation
   - Plan ID: `basic`

2. **Premium Plan** - $10.00
   - Enhanced transcript and translation with priority processing
   - Plan ID: `premium`

### Pricing Configuration

**Default:** Plans are configured in code with fixed prices ($5 and $10).

**Optional:** Use Stripe Price IDs from Stripe Dashboard:
```bash
STRIPE_PRICE_ID_BASIC=price_...    # For $5 plan
STRIPE_PRICE_ID_PREMIUM=price_...  # For $10 plan
```

To create Price IDs in Stripe Dashboard:
1. Go to **Products** → **Add product**
2. Create "Basic Plan" with price $5.00
3. Create "Premium Plan" with price $10.00
4. Copy the Price IDs and add to `.env`

## Troubleshooting

### Payment Not Working

1. **Check API Keys**: Ensure `STRIPE_SECRET_KEY` is set correctly
2. **Check Frontend URL**: Ensure `FRONTEND_URL` matches your frontend domain
3. **Check Console**: Look for errors in browser console and server logs
4. **Test Mode**: Make sure you're using test keys in development

### Webhook Not Receiving Events

1. **Check Webhook URL**: Ensure it's publicly accessible
2. **Check Webhook Secret**: Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
3. **Check Logs**: Review server logs for webhook errors
4. **Test Locally**: Use Stripe CLI for local webhook testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```

### Payment Verification Failing

1. **Check Session Storage**: Payments are stored in-memory (use database in production)
2. **Check Session ID**: Ensure session ID is passed correctly from frontend
3. **Check Webhook**: Ensure webhook is processing `checkout.session.completed` events

## Security Considerations

1. **Never expose secret keys**: Keep `STRIPE_SECRET_KEY` in `.env` only
2. **Verify webhooks**: Always verify webhook signatures in production
3. **Use HTTPS**: Required for production Stripe integration
4. **Rate limiting**: Consider adding rate limiting to payment endpoints
5. **Database storage**: In production, use a database instead of in-memory storage

## Next Steps

For production, consider:
- Using a database to store payment sessions
- Implementing user accounts and payment history
- Adding subscription plans
- Implementing usage limits per payment
- Adding analytics and reporting

## Support

For Stripe-specific issues, refer to:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Support](https://support.stripe.com)

