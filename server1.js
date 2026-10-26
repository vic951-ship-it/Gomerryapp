import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PRODUCTS = [
  { id: 1, name: "Fresh Milk 500ml", price: 70 },
  { id: 2, name: "Maziwa Lala 500ml", price: 80 },
  { id: 3, name: "Eggs Tray", price: 420 },
  { id: 4, name: "Bread", price: 65 }
];

let orders = [];
let merryMembers = [];

app.get('/', (req,res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/api/products', (req,res) => res.json(PRODUCTS));
app.get('/api/orders', (req,res) => res.json(orders));

app.post('/api/mpesa', (req,res) => {
  const { phone, amount, name } = req.body;
  console.log(`M-PESA STK Push to ${phone} Amount ${amount}`);
  // TODO: Integrate Daraja API here
  orders.push({ id: Date.now(), phone, amount, name, status: 'Pending', time: new Date() });
  res.json({ success: true, message: `STK Push sent to ${phone} for KES ${amount}. Check phone!` });
});

app.post('/api/merry/join', (req,res) => {
  const { name, phone, amount } = req.body;
  merryMembers.push({ name, phone, amount, date: new Date() });
  res.json({ success: true, message: `${name} joined merry-go-round with ${amount}` });
});

app.get('/api/merry', (req,res) => res.json(merryMembers));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gomerryapp running on port ${PORT}`));
