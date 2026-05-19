import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Stripe with your secret key (optional - only if configured)
// IMPORTANT: Set this in Firebase Functions config or environment variables
// DO NOT hardcode the secret key in your code
let stripe: Stripe | null = null;
try {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key;
  if (stripeSecretKey) {
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }
} catch (error) {
  console.warn('Stripe not configured. Stripe functions will not work.');
}

/**
 * Create a Stripe Customer and attach a payment method
 * Called when user adds their first payment method
 */
export const createStripeCustomer = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  if (!stripe) {
    throw new functions.https.HttpsError('failed-precondition', 'Stripe is not configured');
  }
  const userId = context.auth.uid;
  const { paymentMethodId, email } = data;
  if (!paymentMethodId) {
    throw new functions.https.HttpsError('invalid-argument', 'Payment method ID is required');
  }
  try {
    // Check if user already has a Stripe customer ID
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    let customerId = userDoc.data()?.stripeCustomerId;
    
    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || context.auth.token.email,
        metadata: {
          firebaseUID: userId,
        },
      });
      customerId = customer.id;
      // Save customer ID to Firestore
      await admin.firestore().collection('users').doc(userId).update({
        stripeCustomerId: customerId,
      });
    }
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    return {
      success: true,
      customerId,
    };
  } catch (error: any) {
    console.error('Error creating Stripe customer:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Create a Payment Intent for processing a payment
 * Called when user places an order
 */
export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  if (!stripe) {
    throw new functions.https.HttpsError('failed-precondition', 'Stripe is not configured');
  }
  const userId = context.auth.uid;
  const { amount, currency = 'eur' } = data;
  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid amount');
  }
  try {
    // Get user's Stripe customer ID or create one if it doesn't exist
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    let customerId = userData?.stripeCustomerId;
    
    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: context.auth.token.email || userData?.email,
        metadata: {
          firebaseUID: userId,
        },
      });
      customerId = customer.id;
      // Save customer ID to Firestore
      await admin.firestore().collection('users').doc(userId).update({
        stripeCustomerId: customerId,
      });
    }
    
    // Create payment intent (without confirm: true for PaymentSheet)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        firebaseUID: userId,
      },
    });
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Detach a payment method from customer
 * Called when user deletes a saved payment method
 */
export const detachPaymentMethod = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  if (!stripe) {
    throw new functions.https.HttpsError('failed-precondition', 'Stripe is not configured');
  }
  const { paymentMethodId } = data;
  if (!paymentMethodId) {
    throw new functions.https.HttpsError('invalid-argument', 'Payment method ID is required');
  }
  try {
    // Detach payment method
    await stripe.paymentMethods.detach(paymentMethodId);
    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error detaching payment method:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Webhook handler for Stripe events
 * Handles payment confirmation and other events
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (!stripe) {
    res.status(503).send('Stripe is not configured');
    return;
  }
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || functions.config().stripe?.webhook_secret;
  if (!sig || !webhookSecret) {
    res.status(400).send('Missing signature or webhook secret');
    return;
  }
  try {
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        // You can update order status in Firestore here
        break;
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        // Handle failed payment
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

/**
 * Vérifie si un numéro de téléphone est déjà utilisé
 * Remplace la lecture directe de phoneIndex pour la sécurité
 */
export const checkPhoneNumberAvailability = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { phoneNumber } = data;
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Phone number is required');
  }

  try {
    const phoneIndexRef = admin.firestore().collection('phoneIndex').doc(phoneNumber);
    const phoneIndexDoc = await phoneIndexRef.get();
    
    return {
      available: !phoneIndexDoc.exists
    };
  } catch (error: any) {
    console.error('Error checking phone number:', error);
    throw new functions.https.HttpsError('internal', 'Failed to check phone number');
  }
});

/**
 * Récupère toutes les commandes (admin uniquement)
 * Remplace la lecture de tous les utilisateurs pour la sécurité
 */
export const getAllOrders = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    // Vérifier que l'utilisateur est admin
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    // Calculer la date limite (3 mois en arrière)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // Récupérer tous les utilisateurs
    const usersSnapshot = await admin.firestore().collection('users').get();
    
    const orders: any[] = [];
    
    // Pour chaque utilisateur, récupérer ses commandes (des 3 derniers mois uniquement)
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      const ordersSnapshot = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('orders')
        .where('createdAt', '>=', threeMonthsAgo)
        .orderBy('createdAt', 'desc')
        .get();
      
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          userId,
          userEmail: userData.email,
          userName: userData.fullName || userData.displayName,
          orderNumber: data.orderNumber,
          total: data.total || 0,
          status: data.status || 'En préparation',
          pickupTime: data.pickupTime,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          items: data.items || [],
        });
      });
    }

    // Trier par date décroissante
    orders.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return { orders };
  } catch (error: any) {
    console.error('Error getting all orders:', error);
    if (error.code === 'permission-denied') {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to get orders');
  }
});

