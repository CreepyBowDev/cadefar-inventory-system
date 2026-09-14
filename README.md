# CADEFAR Inventory System

Sistema web para la gestión de inventario, compras, ventas y control de vencimiento de medicamentos de la farmacia CADEFAR.

## Tecnologías

### Backend

- Node.js
- Express.js
- Sequelize ORM
- Sequelize CLI
- MySQL
- pnpm

### Frontend

El frontend se desarrollará dentro del mismo repositorio.

## Estructura del proyecto

```text
cadefar-inventory-system/
├── backend/
├── frontend/
├── .gitignore
└── README.md
```

## Requisitos previos

Antes de ejecutar el proyecto es necesario tener instalado:

- Node.js
- pnpm
- MySQL Server
- Git

Para verificar las instalaciones:

```bash
node --version
pnpm --version
git --version
```

## Clonar el repositorio

```bash
git clone https://github.com/CreepyBowDev/cadefar-inventory-system.git
```

Ingresar al backend:

```bash
cd cadefar-inventory-system/backend
```

## Instalar dependencias

```bash
pnpm install
```

## Variables de entorno

Dentro de la carpeta `backend`, crear un archivo:

```text
.env
```

Ejemplo:

```env
DB_USER=root
PASSWORD_DB=tu_password
DB_NAME=cadefar
DB_HOST=127.0.0.1
```

Cada integrante debe utilizar sus propias credenciales de MySQL.

El archivo `.env` no debe subirse al repositorio.

## Ejecutar migraciones

Las migraciones crean las tablas, restricciones y relaciones de la base de datos.

```bash
pnpm sequelize-cli db:migrate
```

Para revisar el estado de las migraciones:

```bash
pnpm sequelize-cli db:migrate:status
```

## Cargar datos de prueba

Después de ejecutar las migraciones, cargar la población inicial mediante los seeders:

```bash
pnpm sequelize-cli db:seed:all
```

Esto carga datos de prueba para roles, usuarios, proveedores, medicamentos, existencias, compras, ventas, recetas y movimientos de inventario.

## Deshacer cambios

Deshacer la última migración:

```bash
pnpm sequelize-cli db:migrate:undo
```

Deshacer todas las migraciones:

```bash
pnpm sequelize-cli db:migrate:undo:all
```

Deshacer todos los seeders:

```bash
pnpm sequelize-cli db:seed:undo:all
```

## Inicio rápido

Después de clonar el proyecto:

```bash
cd cadefar-inventory-system/backend
pnpm install
```

Crear y configurar el archivo:

```text
.env
```

Luego ejecutar:

```bash
pnpm sequelize-cli db:migrate
pnpm sequelize-cli db:seed:all
```

## Arquitectura

El backend utiliza una arquitectura de tres capas:

```text
Presentación
     ↓
Lógica de negocio
     ↓
Acceso a datos
     ↓
MySQL
```
