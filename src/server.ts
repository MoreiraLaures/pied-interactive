import express, {Router, Request, Response } from 'express';
import dotenv from 'dotenv';
import orderWebhook from './webhook/order';
import help from './webhook/help';

dotenv.config()

const app = express();
const PORT = 3000;
app.use(express.json({ limit: '10mb' }));


app.use('/', orderWebhook);
app.use('/',help)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
