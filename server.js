const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// GET KEYS FROM RENDER ENV
const CONSUMER_KEY = (process.env.MPESA_CONSUMER_KEY || '').trim();
const CONSUMER_SECRET = (process.env.MPESA_CONSUMER_SECRET || '').trim();
const SHORTCODE = (process.env.MPESA_SHORTCODE || '4835569').trim();
const PASSKEY = (process.env.MPESA_PASSKEY || '').trim();
const MPESA_ENV = (process.env.MPESA_ENV || 'production').trim();

const BASE = MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

console.log('ENV CHECK:', { 
  hasKey: !!CONSUMER_KEY, 
  hasSecret: !!CONSUMER_SECRET, 
  hasPasskey: !!PASSKEY, 
  shortcode: SHORTCODE,
  env: MPESA_ENV 
});

async function getToken() {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('MISSING_KEYS: MPESA_CONSUMER_KEY or SECRET not set in Render');
  }
  const auth = Buffer.from(CONSUMER_KEY + ':' + CONSUMER_SECRET).toString('base64');
  const res = await axios.get(BASE + '/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: 'Basic ' + auth }
  });
  return res.data.access_token;
}

app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    let { phone, amount, name } = req.body;
    if (!phone) throw new Error('Phone required');
    
    phone = phone.toString().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (!phone.startsWith('254')) phone = '254' + phone;
    if (phone.length !== 12) throw new Error('Invalid phone format');

    if (!PASSKEY) throw new Error('MISSING_PASSKEY: Add MPESA_PASSKEY in Render Env');

    const token = await getToken();
    const now = new Date();
    const timestamp = now.getFullYear() + 
      String(now.getMonth()+1).padStart(2,'0') + 
      String(now.getDate()).padStart(2,'0') + 
      String(now.getHours()).padStart(2,'0') + 
      String(now.getMinutes()).padStart(2,'0') + 
      String(now.getSeconds()).padStart(2,'0');
      
    const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: Math.round(Number(amount) || 1),
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: 'https://gomerryapp.onrender.com/api/mpesa/callback',
      AccountReference: 'Gomerry',
      TransactionDesc: 'Gomerry Shop Payment'
    };

    console.log('STK Request:', { phone, amount, timestamp });

    const mpesaRes = await axios.post(BASE + '/mpesa/stkpush/v1/processrequest', payload, {
      headers: { Authorization: 'Bearer ' + token }
    });

    console.log('STK Success:', mpesaRes.data);
    res.json({ success: true, data: mpesaRes.data });

  } catch (err) {
    const errData = err.response ? err.response.data : null;
    const msg = errData ? JSON.stringify(errData) : err.message;
    console.error('STK ERROR:', msg);
    res.status(500).json({ 
      success: false, 
      error: errData || { errorMessage: err.message },
      message: msg
    });
  }
});

app.post('/api/mpesa/callback', (req, res) => {
  console.log('CALLBACK:', JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    hasKey: !!CONSUMER_KEY, 
    hasSecret: !!CONSUMER_SECRET,
    hasPasskey: !!PASSKEY,
    shortcode: SHORTCODE 
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Gomerry live on ' + PORT));
