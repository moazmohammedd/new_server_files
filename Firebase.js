const express = require('express');
const cors = require('cors');
const router = express.Router();
const stripeKey = require('../utils/StripeKey');
const stripe = require('stripe')(stripeKey);
require('dotenv').config();

const moment = require('moment');

// firebase config 
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, addDoc, updateDoc , serverTimestamp } = require('firebase/firestore');

const firebaseConfig = require('../config/FirebaseConfig');


const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const ordersCollection = collection(db, "orders");


// This is your Stripe CLI webhook secret for testing your endpoint locally.
async function retrievePaymentIntent(paymentIntentId) {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log('#'.repeat(50));
        // console.log('payment intent', paymentIntent);
        console.log('#'.repeat(50));
        await getChargeData(paymentIntent.latest_charge);
    } catch (e) {
        console.log(e.message);
    }
}

async function getChargeData(chargeId) {
    try {
        const charge = await stripe.charges.retrieve(chargeId);
        // console.log('charge', charge);
        await CreateOrder({ ...charge.billing_details, intent: charge.payment_intent });
    } catch (e) {
        console.log('#'.repeat(50));
        console.log(`charge error`, e.message);
        console.log('#'.repeat(50));
    }
}
async function CreateOrder(orderData) {

    const data = JSON.parse(orderData?.address?.line2 || []);
    const intent = orderData?.intent || 'error';

    const rostockTime = moment().format('HH:mm');
    const currentDate = moment().format('YYYY-MM-DD');
    try {
        // Generate a new order object

        const docRef = await addDoc(ordersCollection, data);
        const docId = docRef.id;

        console.log(serverTimestamp())
        console.log( typeof serverTimestamp())

        // Add the new order to Firestore
        await updateDoc(doc(db, 'orders', docRef.id), {
            ...data,
            id: docId,
            payWay: 'stripe',
            createdAt: serverTimestamp(),
            orderTime: rostockTime,
            orderDate: currentDate,
            paymentWay: 'card',
            mode: 'stripe',
            intent,
        });

        // res.json({ message: 'Order created successfully', order: newOrder });
    } catch (error) {
        console.error('Error creating order:', error);
        // res.status(500).json({ error: 'Failed to create order' });
    }
}
const endpointSecret = process.env.STRIPE_WEB_HOOK_SECRET;
// for production 
router.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    // const sig = request.headers['stripe-signature'];
    // console.log(request.body)
    // Assuming req.body contains the buffer data
    const bufferData = request.body;
    // Convert buffer data to a string
    const jsonString = bufferData.toString('utf8');

    // Parse the string into a JavaScript object
    const payload = await JSON.parse(jsonString);

    // Now you have the payload object, you can access its properties
    // console.log(payload || 'payload is undefined');
    let event = payload;

    // try {
    //     const sig = request.headers['stripe-signature'];
    //     const constructEventData = {jsonString, sig, endpointSecret :Buffer.from(endpointSecret)};
    //     console.log('#'.repeat(200))
    //     console.log(`{${constructEventData}}`)
    //     event = stripe.webhooks.constructEvent(jsonString, sig, Buffer.from(endpointSecret));
    // } catch (err) {
    //     response.status(400).send(`Webhook Error: ${err.message}
    //     ${typeof jsonString}
    //     ${jsonString}
    // ` );
    //     return;
    // }

    // Handle the event
    console.log(event?.type)
    if (event) {
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntentSucceeded = event.data.object;
                retrievePaymentIntent(paymentIntentSucceeded?.id);
                // console.log(paymentIntentSucceeded)
                break;
            // ... handle other event types
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

    } else {
        console.log(`event is undefined`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
});

// for test firestore
// Define a route to get all category collection data
router.get('/orders', async (req, res) => {
    try {
        // const docSnap = await getDocs(ordersCollection);
        // const data = docSnap.docs.map((doc) => {
        //     return { id: doc.id, ...doc.data() };
        // });
        res.json({ message: 'why do you need it??' });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});


// Route to update a specific order by its ID
router.put('/update-order/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const newData = req.body; // New data to update the order

    try {
        await updateDoc(doc(ordersCollection, orderId), newData);
        res.json({ message: 'Order updated successfully' });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});


module.exports = router 