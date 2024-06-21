const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const router = express.Router();
require('dotenv').config();

router.use(express.json());
router.use(cors());

const stripeKey = require('../utils/StripeKey');
const stripe = require('stripe')(stripeKey);
router.use(express.static('public'))
router.use(bodyParser.raw({ type: 'application/json' }));






router.post('/payments', async (req, res) => {
    const { amount } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'eur',
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: err.message });
    }
});
router.get("/config", (req, res) => {
    res.send({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
});


router.post("/create-payment-intent", async (req, res) => {
    const { amount, order } = req.body;
    console.log(amount, order);
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            currency: "EUR",
            amount: amount * 100,
            automatic_payment_methods: { enabled: true },
            metadata: {
                order: JSON.stringify(order),
            },
        });

        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (e) {
        return res.status(400).send({
            error: {
                message: e.message,
            },
        });
    }
});


router.post('/retrieve-payment-intent', async (req, res) => {
    const { paymentIntentId } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        res.send(paymentIntent);
    } catch (e) {
        return res.status(400).send({
            error: {
                message: e.message,
            },
        });
    }
});
router.post("/get-order-info", async (req, res) => {
    const { clientSecret, paymentIntentId } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.client_secret !== clientSecret) {
            throw new Error("Invalid client secret");
        }

        const customer = await stripe.customers.retrieve(paymentIntent.customer);

        const customerData = {
            email: customer.email,
            name: customer.name,
            address: {
                line1: customer.address.line1,
            },
        };

        res.json(customerData);
    } catch (error) {
        console.error("Error retrieving order information:", error);
        res.status(500).json({ error: "Failed to retrieve order information" });
    }
});

router.post('/charge', async (req, res) => {
    const { chargeId } = req.body;
    try {
        const charge = await stripe.charges.retrieve(chargeId);

        res.json(charge);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/refund', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
        });

        res.json({ refund });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing the refund.' });
    }
});

module.exports = router;