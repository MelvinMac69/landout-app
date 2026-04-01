import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      // TODO: Update user membership in Supabase
      console.log('Checkout completed:', event.data.object);
      break;

    case 'customer.subscription.updated':
      // TODO: Handle subscription updates
      console.log('Subscription updated:', event.data.object);
      break;

    case 'customer.subscription.deleted':
      // TODO: Downgrade user to free tier
      console.log('Subscription deleted:', event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
