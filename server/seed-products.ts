// Seed script to create Stripe products and prices
// Run with: npx tsx server/seed-products.ts

import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Creating Sunwoven Homeschool subscription products...');

  // Check if products already exist
  const existingProducts = await stripe.products.search({ 
    query: "metadata['app']:'sunwoven'" 
  });
  
  if (existingProducts.data.length > 0) {
    console.log('Products already exist:');
    for (const product of existingProducts.data) {
      console.log(`  - ${product.name} (${product.id})`);
    }
    console.log('Skipping creation. Delete existing products in Stripe Dashboard to recreate.');
    return;
  }

  // Create Basic Plan product
  const basicProduct = await stripe.products.create({
    name: 'Sunwoven Basic Plan',
    description: 'Full access to scheduling, reporting, and portfolio features for homeschool management. Includes up to 3 students.',
    metadata: {
      app: 'sunwoven',
      plan: 'basic',
      maxStudents: '3',
    },
  });
  console.log(`Created Basic Plan product: ${basicProduct.id}`);

  // Create Basic Plan monthly price ($29/month)
  const basicPrice = await stripe.prices.create({
    product: basicProduct.id,
    unit_amount: 2900, // $29.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      plan: 'basic',
    },
  });
  console.log(`Created Basic Plan price: ${basicPrice.id} ($29/month)`);

  // Create Premium Plan product
  const premiumProduct = await stripe.products.create({
    name: 'Sunwoven Premium Plan',
    description: 'Everything in Basic, plus Library, AI Curriculum tools, Study Helper, Math Facts Practice, Grammar Practice, and Copywork Generator.',
    metadata: {
      app: 'sunwoven',
      plan: 'premium',
      maxStudents: '3',
    },
  });
  console.log(`Created Premium Plan product: ${premiumProduct.id}`);

  // Create Premium Plan monthly price ($49/month)
  const premiumPrice = await stripe.prices.create({
    product: premiumProduct.id,
    unit_amount: 4900, // $49.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      plan: 'premium',
    },
  });
  console.log(`Created Premium Plan price: ${premiumPrice.id} ($49/month)`);

  // Create Additional Student add-on product
  const additionalStudentProduct = await stripe.products.create({
    name: 'Additional Student',
    description: 'Add one more student to your homeschool account (beyond the included 3 students).',
    metadata: {
      app: 'sunwoven',
      plan: 'addon',
      type: 'additional_student',
    },
  });
  console.log(`Created Additional Student product: ${additionalStudentProduct.id}`);

  // Create Additional Student price ($10/month per student)
  const additionalStudentPrice = await stripe.prices.create({
    product: additionalStudentProduct.id,
    unit_amount: 1000, // $10.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      type: 'additional_student',
    },
  });
  console.log(`Created Additional Student price: ${additionalStudentPrice.id} ($10/month)`);

  console.log('\n✅ All products created successfully!');
  console.log('\nProduct IDs (save these for reference):');
  console.log(`  BASIC_PRODUCT_ID: ${basicProduct.id}`);
  console.log(`  BASIC_PRICE_ID: ${basicPrice.id}`);
  console.log(`  PREMIUM_PRODUCT_ID: ${premiumProduct.id}`);
  console.log(`  PREMIUM_PRICE_ID: ${premiumPrice.id}`);
  console.log(`  ADDITIONAL_STUDENT_PRODUCT_ID: ${additionalStudentProduct.id}`);
  console.log(`  ADDITIONAL_STUDENT_PRICE_ID: ${additionalStudentPrice.id}`);
}

createProducts().catch(console.error);
