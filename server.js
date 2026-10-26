const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = (process.env.MPESA_SHORTCODE || '4835569').trim();
const PASSKEY = (process.env.MPESA_PASSKEY || '').trim();
const MPESA_ENV = (process.env.MPESA_ENV || 'production').trim();

const BASE_URL = MPESA_ENV === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';

async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const resp = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    timeout: 15000
  });
  return resp.data.access_token;
}

function getTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

app.get('/api/health', (req, res) => {
  res.json({ status: "ok", shortcode: SHORTCODE, env: MPESA_ENV, hasKey: !!CONSUMER_KEY, hasSecret: !!CONSUMER_SECRET, hasPasskey: !!PASSKEY });
});

app.post('/api/stkpush', async (req, res) => {
  try {
    let { phone, amount } = req.body;
    console.log('STK REQ:', phone, amount);
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount required' });
    if (!PASSKEY) return res.status(500).json({ error: 'PASSKEY missing in Render Env' });

    phone = phone.toString().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('7')) phone = '254' + phone;

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(amount)),
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: 'https://gomerryapp.onrender.com/api/callback',
      AccountReference: 'Gomerry',
      TransactionDesc: 'Gomerry Shop'
    };

    const stkResp = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000
    });

    console.log('STK OK:', stkResp.data);
    return res.json(stkResp.data);
  } catch (err) {
    console.error('STK FAIL:', err.response?.data || err.message);
    return res.status(500).json({ error: 'STK Failed', details: err.response?.data || err.message });
  }
});

app.post('/api/callback', (req, res) => {
  console.log('CALLBACK:', JSON.stringify(req.body).slice(0,1000));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Serve frontend AFTER api routes
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Gomerry Live on ${PORT}`));
