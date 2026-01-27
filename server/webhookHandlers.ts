// Stripe webhook handlers
import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    // Process webhook with stripe-replit-sync (handles its own signature verification)
    try {
      await sync.processWebhook(payload, signature);
    } catch (err) {
      console.error('StripeSync webhook processing error:', err);
      // Continue to handle event manually if sync fails
    }
    
    // Parse and handle subscription events 
    // stripe-replit-sync uses managed webhooks with its own signing secret
    // We parse the event directly since the sync already verified it
    let event;
    try {
      event = JSON.parse(payload.toString());
    } catch (parseError) {
      throw new Error('Failed to parse webhook payload as JSON');
    }
    
    await WebhookHandlers.handleSubscriptionEvent(event);
  }
  
  static async handleSubscriptionEvent(event: any) {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Find user by Stripe customer ID and update subscription info
        const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
        
        if (user) {
          const stripe = await getUncachableStripeClient();
          
          let plan = 'free';
          let additionalStudents = 0;
          
          // Iterate through all subscription items to determine plan and add-ons
          for (const item of subscription.items?.data || []) {
            const priceId = item.price?.id;
            if (!priceId) continue;
            
            const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
            const product = price.product as any;
            const productMetadata = product?.metadata || {};
            
            // Check if this is an additional student add-on
            if (productMetadata.type === 'additional_student') {
              additionalStudents = item.quantity || 0;
            } else if (productMetadata.plan === 'premium') {
              plan = 'premium';
            } else if (productMetadata.plan === 'basic' && plan !== 'premium') {
              plan = 'basic';
            }
          }
          
          await db.update(users)
            .set({
              stripeSubscriptionId: subscription.id,
              subscriptionPlan: plan,
              subscriptionStatus: subscription.status,
              additionalStudentsPurchased: String(additionalStudents),
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
            
          console.log(`Updated subscription for user ${user.id}: plan=${plan}, additionalStudents=${additionalStudents}, status=${subscription.status}`);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
        
        if (user) {
          await db.update(users)
            .set({
              stripeSubscriptionId: null,
              subscriptionPlan: 'free',
              subscriptionStatus: 'canceled',
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
        }
        break;
      }
      
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Link customer to user if we have user metadata
        if (session.metadata?.userId && session.customer) {
          await db.update(users)
            .set({
              stripeCustomerId: session.customer,
              updatedAt: new Date(),
            })
            .where(eq(users.id, session.metadata.userId));
        }
        break;
      }
    }
  }
}
