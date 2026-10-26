const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE || '4835569';
const PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_ENV = process.env.MPESA_ENV || 'production';

const BASE_URL = MPESA_ENV === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';

async function getAccessToken() {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('MISSING_KEYS: Add MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in Render Env');
  }
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const resp = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return resp.data.access_token;
}

function getTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    shortcode: SHORTCODE,
    env: MPESA_ENV,
    hasKey: !!CONSUMER_KEY,
    hasSecret: !!CONSUMER_SECRET,
    hasPasskey: !!PASSKEY,
    time: new Date().toISOString()
  });
});

app.post('/api/stkpush', async (req, res) => {
  try {
    let { phone, amount } = req.body;
    console.log('STK Request:', { phone, amount, timestamp: getTimestamp() });

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone and amount required' });
    }
    if (!PASSKEY) {
      return res.status(500).json({ error: 'MISSING_PASSKEY: Add MPESA_PASSKEY in Render Env' });
    }

    // Format phone to 254...
    phone = phone.toString().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('7')) phone = '254' + phone;
    if (!phone.startsWith('254')) {
      return res.status(400).json({ error: 'Invalid phone format. Use 0718... or 254718...' });
    }

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

    // FIX FOR 2002 ERROR: Use PayBillOnline for Tills with Stores
    // If your Till has Store Number, PayBillOnline will work!
    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline', // Changed from BuyGoods to fix 2002
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: `https://gomerryapp.onrender.com/api/callback`,
      AccountReference: 'Gomerry',
      TransactionDesc: 'Gomerry Shop Payment'
    };

    console.log('Sending to Safaricom:', { shortcode: SHORTCODE, type: payload.TransactionType });

    const stkResp = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('STK Success:', stkResp.data);
    res.json(stkResp.data);

  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('STK Error:', errData);
    res.status(500).json({ error: 'STK Push Failed', details: errData });
  }
});

app.post('/api/callback', (req, res) => {
  console.log('CALLBACK:', JSON.stringify(req.body));
  // Here you can save to database
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Gomerry Shop live on ${PORT}`));
