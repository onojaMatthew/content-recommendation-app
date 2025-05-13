import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';



const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

export default app;