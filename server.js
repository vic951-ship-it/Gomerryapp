const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE || '4835569';
const PASSKEY = process.env.MPESA_PASSKEY;
const ENV = process.env.MPESA_ENV || 'production';

const BASE_URL = ENV === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';

async function getToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const res = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return res.data.access_token;
}

app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phone, amount, name } = req.body;
    let formattedPhone = phone.toString().replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

    const token = await getToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0,14);
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: `https://gomerryapp.onrender.com/api/mpesa/callback`,
      AccountReference: "Gomerry",
      TransactionDesc: "Gomerry Shop & Chama"
    };

    const response = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json({ success: true, data: response.data, message: "STK sent!" });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

app.post('/api/mpesa/callback', (req, res) => {
  console.log('Callback:', JSON.stringify(req.body));
  // TODO: Save to DB, confirm payment
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// Chama members
let members = [];
app.get('/api/members', (req, res) => res.json(members));
app.post('/api/members', (req, res) => {
  const newMember = { ...req.body, id: Date.now(), joinedAt: new Date() };
  members.push(newMember);
  res.json({ success: true, member: newMember });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Gomerry PRODUCTION on ${PORT} - Till ${SHORTCODE}`));
