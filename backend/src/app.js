import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { usuarioRouter } from './presentation/routes/usuario.router.js';
import { errorHandler } from './presentation/middlewares/error.middleware.js';

export const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

app.use('/api/usuarios', usuarioRouter);

app.use(errorHandler);
app.use(cookieParser());