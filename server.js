const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const SHORTCODE = process.env.MPESA_SHORTCODE || '4835569';
const PASSKEY = process.env.MPESA_PASSKEY || '';
const MPESA_ENV = process.env.MPESA_ENV || 'production';

const BASE = MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

async function getToken() {
  const auth = Buffer.from(CONSUMER_KEY + ':' + CONSUMER_SECRET).toString('base64');
  const res = await axios.get(BASE + '/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: 'Basic ' + auth }
  });
  return res.data.access_token;
}

app.post('/api/mpesa/stkpush', async function(req, res) {
  try {
    let phone = req.body.phone || '';
    let amount = req.body.amount || 1;
    let name = req.body.name || 'Customer';
    
    phone = phone.toString().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (!phone.startsWith('254')) phone = '254' + phone;

    const token = await getToken();
    const d = new Date();
    const timestamp = d.getFullYear() + ('0'+(d.getMonth()+1)).slice(-2) + ('0'+d.getDate()).slice(-2) + ('0'+d.getHours()).slice(-2) + ('0'+d.getMinutes()).slice(-2) + ('0'+d.getSeconds()).slice(-2);
    const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: Math.round(Number(amount)),
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: 'https://gomerryapp.onrender.com/api/mpesa/callback',
      AccountReference: 'Gomerry',
      TransactionDesc: 'Gomerry Payment'
    };

    const mpesaRes = await axios.post(BASE + '/mpesa/stkpush/v1/processrequest', payload, {
      headers: { Authorization: 'Bearer ' + token }
    });

    console.log('SUCCESS', mpesaRes.data);
    res.json({ success: true, data: mpesaRes.data });

  } catch (err) {
    console.log('ERROR', err.response ? err.response.data : err.message);
    res.status(500).json({ success: false, error: err.response ? err.response.data : { errorMessage: err.message } });
  }
});

app.post('/api/mpesa/callback', function(req, res) {
  console.log('Callback', JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, function() {
  console.log('Gomerry live on ' + PORT);
});
