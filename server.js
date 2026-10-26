const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ENV from Render
const CONSUMER_KEY = (process.env.MPESA_CONSUMER_KEY || '').trim();
const CONSUMER_SECRET = (process.env.MPESA_CONSUMER_SECRET || '').trim();
const SHORTCODE = (process.env.MPESA_SHORTCODE || '4835569').trim();
const PASSKEY = (process.env.MPESA_PASSKEY || '').trim();
const ENV = (process.env.MPESA_ENV || 'production').trim().toLowerCase();

const BASE_URL = ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

console.log(`=== GOMERRY STARTING ===`);
console.log(`ENV: ${ENV} | SHORTCODE: ${SHORTCODE} | BASE: ${BASE_URL}`);
console.log(`KEY exists: ${!!CONSUMER_KEY} | SECRET exists: ${!!CONSUMER_SECRET} | PASSKEY exists: ${!!PASSKEY} | PASSKEY length: ${PASSKEY.length}`);

let orders = [];

async function getToken() {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('Missing CONSUMER_KEY or SECRET in Render ENV');
  }
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  try {
    const res = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    return res.data.access_token;
  } catch (e) {
    console.error('TOKEN ERROR:', e.response?.data || e.message);
    throw new Error(JSON.stringify(e.response?.data || e.message));
  }
}

app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    let { phone, amount, name } = req.body;
    console.log('STK Request:', { phone, amount, name });

    if (!phone) return res.status(400).json({ success: false, error: { errorMessage: 'Phone required' } });
    
    // Format phone 0718370199 -> 254718370199
    let formattedPhone = phone.toString().replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);
    if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;

    const token
