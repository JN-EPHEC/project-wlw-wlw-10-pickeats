"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOrders = exports.checkPhoneNumberAvailability = exports.stripeWebhook = exports.detachPaymentMethod = exports.createPaymentIntent = exports.createStripeCustomer = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
// Initialize Firebase Admin
admin.initializeApp();
// Initialize Stripe with your secret key (optional - only if configured)
// IMPORTANT: Set this in Firebase Functions config or environment variables
// DO NOT hardcode the secret key in your code
let stripe = null;
try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key;
    if (stripeSecretKey) {
        stripe = new stripe_1.default(stripeSecretKey, {
            apiVersion: '2023-10-16',
        });
    }
}
catch (error) {
    console.warn('Stripe not configured. Stripe functions will not work.');
}
/**
 * Create a Stripe Customer and attach a payment method
 * Called when user adds their first payment method
 */
exports.createStripeCustomer = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('Error creating Stripe customer:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Create a Payment Intent for processing a payment
 * Called when user places an order
 */
exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('Error creating payment intent:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Detach a payment method from customer
 * Called when user deletes a saved payment method
 */
exports.detachPaymentMethod = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('Error detaching payment method:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Webhook handler for Stripe events
 * Handles payment confirmation and other events
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
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
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});
/**
 * Vérifie si un numéro de téléphone est déjà utilisé
 * Remplace la lecture directe de phoneIndex pour la sécurité
 */
exports.checkPhoneNumberAvailability = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('Error checking phone number:', error);
        throw new functions.https.HttpsError('internal', 'Failed to check phone number');
    }
});
/**
 * Récupère toutes les commandes (admin uniquement)
 * Remplace la lecture de tous les utilisateurs pour la sécurité
 */
exports.getAllOrders = functions.https.onCall(async (data, context) => {
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
        const orders = [];
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
    }
    catch (error) {
        console.error('Error getting all orders:', error);
        if (error.code === 'permission-denied') {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to get orders');
    }
});
//# sourceMappingURL=index.js.map