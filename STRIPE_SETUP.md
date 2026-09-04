# Stripe Setup for IconBuilds

IconBuilds uses GitHub Pages for the public website and Vercel for the serverless API. Stripe secrets must only live in Vercel environment variables.

## 1. Rotate Any Exposed Live Keys

If a live Stripe secret key was pasted into chat, GitHub, Discord, or any public place, revoke it in Stripe and create a new restricted/live secret key.

Do not put secret keys in:

- `config.js`
- frontend JavaScript
- HTML files
- GitHub commits
- screenshots or support messages

## 2. Add Vercel Environment Variables

In Vercel, open the IconBuilds API project, then go to:

`Project Settings -> Environment Variables`

Add these to Production:

```env
STRIPE_SECRET_KEY=your_rotated_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
ALLOWED_ORIGINS=https://minestore.org,https://icon-builds.vercel.app
```

The publishable Stripe key is not required by the current checkout flow because Vercel creates the Checkout Session and returns Stripe's hosted checkout URL.

IconBuilds sends a Stripe product tax code automatically for paid resources so Checkout works with Stripe Managed Payments. Defaults are configured in `config.js`:

- Plugins, Skripts, configurations, server setups, and Discord bot setups use downloadable software.
- Builds plus textures and models use digital finished artwork.

If Stripe tells you a different eligible code is required, add this optional Vercel variable:

```env
STRIPE_PRODUCT_TAX_CODE=your_tax_code_from_stripe
```

Optional donations on free resources use the donation tax code configured in `config.js`. If Stripe tells you to use a different eligible code for donations, add:

```env
STRIPE_DONATION_TAX_CODE=your_tax_code_from_stripe
```

Only use this fallback if you intentionally want Checkout Sessions to disable Managed Payments:

```env
STRIPE_MANAGED_PAYMENTS_ENABLED=false
```

## 3. Redeploy Vercel

Vercel environment variable changes only apply to new deployments. Redeploy the API project after saving the variables.

## 4. Create The Stripe Webhook

In Stripe, create a webhook endpoint:

```text
https://icon-builds.vercel.app/api/stripe-webhook
```

Listen for this event:

```text
checkout.session.completed
```

Copy the webhook signing secret from Stripe and save it as `STRIPE_WEBHOOK_SECRET` in Vercel.

## 5. Checkout Flow

The flow is:

1. User clicks `Purchase` on `https://minestore.org`.
2. GitHub Pages calls `https://icon-builds.vercel.app/api?action=createCheckout`.
3. Vercel uses `STRIPE_SECRET_KEY` to create a Stripe Checkout Session with the resource name, price, image, and product tax code.
4. User pays on Stripe Checkout.
5. Stripe redirects back to `https://minestore.org/checkout/success/`.
6. The success page asks Vercel to verify the Stripe session.
7. The webhook also grants access when Stripe confirms `checkout.session.completed`.

Never trust purchase status from frontend code.
