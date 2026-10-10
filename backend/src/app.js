import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { usuarioRouter } from './presentation/routes/usuario.router.js';
import { authRouter } from './presentation/routes/auth.router.js';
import { proveedorLaboratorioRouter } from './presentation/routes/proveedor-laboratorio.router.js';
import { medicamentoRouter } from './presentation/routes/medicamento.router.js';
import { principioActivoRouter } from './presentation/routes/principio-activo.router.js';
import { inventarioRouter } from './presentation/routes/inventario.router.js';
import { compraRouter } from './presentation/routes/compra.router.js';
import { errorHandler } from './presentation/middlewares/error.middleware.js';

export const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/usuarios', usuarioRouter);
app.use('/api/auth', authRouter);
app.use('/api/proveedores-laboratorios', proveedorLaboratorioRouter);
app.use('/api/medicamentos', medicamentoRouter);
app.use('/api/principios-activos', principioActivoRouter);
app.use('/api/inventario', inventarioRouter);
app.use('/api/compras', compraRouter);

app.use(errorHandler);
