# CADEFAR Inventory System

Sistema web de uso interno para la administración de inventario, ventas y control de vencimientos de la farmacia CADEFAR. El repositorio contiene un backend y un frontend independientes. Están disponibles las interfaces y API de autenticación, usuarios, proveedores/laboratorios, medicamentos/composición, Inventario y Compras. Inventario incluye consultas, ajustes, retiros y vencimientos; Compras incluye registro, consulta y anulación. Ventas, Recetas y Reportes permanecen pendientes como módulos funcionales.

La guía de uso y verificación del bloque entregado está en [Inventario y Compras](docs/uso/inventario-compras.md).

## Requisitos previos

- Git, Node.js y pnpm instalados.
- MySQL Server instalado, **iniciado y funcionando**, con una cuenta que pueda acceder a la base de datos configurada.

El frontend consume la API del backend; el backend se conecta a MySQL. Para probar las funciones que dependen de datos deben funcionar los tres elementos:

```text
Frontend → Backend → MySQL Server
```

Tener solo frontend y backend ejecutándose no basta si MySQL está detenido o las credenciales son incorrectas.

## Tecnologías

| Backend | Frontend |
| --- | --- |
| Node.js, Express, Sequelize, Sequelize CLI y MySQL (`mysql2`) | React, Vite, React Router y Axios |
| Zod, bcrypt, JWT (`jsonwebtoken`), `cookie-parser`, `cors` y `dotenv` | Context API para la sesión y CSS |

Se utiliza **pnpm** para instalar las dependencias de ambos proyectos.

## Estructura del repositorio

```text
cadefar-inventory-system/
├── backend/
│   ├── .env.example
│   ├── .sequelizerc
│   ├── package.json
│   └── src/
│       ├── presentation/       # Rutas, middlewares y controllers
│       ├── business/           # Services y validators
│       ├── data/               # Modelos, repositories, config, migraciones y seeders
│       ├── shared/             # Errores, constantes y utilidades
│       ├── app.js
│       └── server.js            # Punto de entrada de pnpm start
├── frontend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── api/                # Configuración de Axios
│       ├── app/                # Rutas de React
│       ├── components/
│       ├── features/           # auth, usuarios, catálogo, proveedores, inventario y compras
│       ├── layouts/
│       ├── routes/             # Protección de vistas
│       └── styles/
├── docs/ai/                    # Contexto, requisitos y reglas del proyecto
├── .gitignore
└── README.md
```

## Instalación y configuración

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/CreepyBowDev/cadefar-inventory-system.git
cd cadefar-inventory-system/backend
pnpm install
```

En el frontend se instalan por separado:

```bash
cd ../frontend
pnpm install
```

### 2. Variables de entorno

Cada carpeta tiene su propio `.env.example`. Copia su contenido a un archivo `.env` en **esa misma carpeta** y completa los valores para tu entorno. Nunca versiones los archivos `.env` ni compartas credenciales o claves reales.

**`backend/.env`** (ejemplo de desarrollo; reemplaza los valores entre `< >`):

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DB_HOST=127.0.0.1
DB_USER=<usuario-mysql>
PASSWORD_DB=<contraseña-mysql>
DB_NAME=cadefar

JWT_SECRET=<clave-aleatoria-propia>
SEED_USERS_PASSWORD=<contraseña-fuerte-propia-para-usuarios-demo>
```

`PORT` es opcional (por defecto, `3000`). `NODE_ENV` usa `development` si se omite. La configuración de Sequelize también contempla `DB_NAME_TEST` y `DB_NAME_PRODUCTION` para esos entornos; configúralos si vas a utilizarlos. `FRONTEND_URL` debe coincidir con el origen desde el que abres Vite para permitir las solicitudes con cookie.

`SEED_USERS_PASSWORD` es necesaria al cargar el seeder de usuarios: define una contraseña propia de 8 a 100 caracteres con al menos una mayúscula, una minúscula, un número y un carácter especial. El seeder guarda su hash, no la contraseña en texto plano.

**`frontend/.env`** (ejemplo):

```env
VITE_API_URL=http://localhost:3000/api
```

Si cambias el puerto del backend, ajusta también `VITE_API_URL`. No incluyas secretos en variables `VITE_*`: quedan expuestas al navegador.

### 3. Preparar MySQL

Con MySQL Server iniciado, verifica `DB_HOST`, `DB_USER`, `PASSWORD_DB` y `DB_NAME` en `backend/.env`. La base de datos indicada debe existir antes de migrar. Si la cuenta tiene permiso para crearla, desde **`backend/`** puedes ejecutar:

```bash
pnpm exec sequelize-cli db:create
```

También puedes crear la base manualmente con MySQL. Los comandos del CLI utilizan `.sequelizerc` y `src/data/database/config/config.cjs` del backend; por ello deben ejecutarse desde esa carpeta.

### 4. Migraciones y datos iniciales

Desde **`backend/`**, aplica las migraciones y consulta su estado:

```bash
pnpm exec sequelize-cli db:migrate
pnpm exec sequelize-cli db:migrate:status
```

Para cargar todos los datos de demostración, después de configurar `SEED_USERS_PASSWORD`:

```bash
pnpm exec sequelize-cli db:seed:all
```

Hay seeders para roles, usuarios, proveedores/laboratorios, principios activos, medicamentos, su composición y existencias, compras, ventas, recetas, detalles de compra y venta y movimientos de inventario. Incluyen un usuario administrador de demostración (`admin_demo`) cuya contraseña será la que definas en `SEED_USERS_PASSWORD`. Los seeders de otras tablas aportan datos de ejemplo, **no endpoints para módulos todavía no implementados**.

Para deshacer cambios cuando corresponda (si vas a revertir todo, deshaz primero los datos de los seeders):

```bash
pnpm exec sequelize-cli db:migrate:undo
pnpm exec sequelize-cli db:migrate:undo:all
pnpm exec sequelize-cli db:seed:undo --seed nombre-del-seeder.js
pnpm exec sequelize-cli db:seed:undo:all
```

Los dos primeros comandos deshacen, respectivamente, la última migración y todas las migraciones. Los dos últimos deshacen un seeder indicado por nombre de archivo o todos los seeders.

## Ejecutar el sistema

Mantén MySQL Server funcionando y abre **dos terminales** desde la raíz del repositorio:

**Terminal 1 — backend** (desde `backend/`):

```bash
cd backend
pnpm start
```

El script ejecuta `node src/server.js`. El backend muestra su puerto al iniciar; por defecto utiliza `http://localhost:3000`.

**Terminal 2 — frontend** (ejecuta `pnpm dev` dentro de `frontend/`):

```bash
cd frontend
pnpm dev --host localhost --port 5173 --strictPort
```

Abre `http://localhost:5173`. `--strictPort` evita que Vite cambie silenciosamente de puerto y deje de coincidir con `FRONTEND_URL`. Mantén el mismo hostname en la URL del navegador y `VITE_API_URL` para las cookies. En el frontend también están disponibles `pnpm build` para generar la compilación y `pnpm preview` para previsualizarla; su origen debe coincidir con `FRONTEND_URL` si consume la API.

## Verificar Inventario y Compras

Desde `frontend/`, con las dependencias de ambos proyectos instaladas:

```bash
node --test --test-concurrency=1 tests/inventario.browser.test.mjs tests/compras.browser.test.mjs tests/cu09.browser.test.mjs
node --test tests/aceptacion-real.browser.test.mjs
pnpm build
```

Las tres primeras suites utilizan API simulada. La aceptación integrada utiliza React, Express y MySQL local reales: crea, migra y elimina únicamente una base aleatoria, usa fixtures sintéticos sin seeders y compara los datos/esquemas de las bases configuradas antes/después. Requiere `DB_NAME_TEST`, una cuenta local con permisos para esas operaciones y lectura de `performance_schema.data_lock_waits`, Node.js >=22 y Chrome/Edge. Puede indicarse su ejecutable mediante `CADEFAR_TEST_BROWSER`. La aceptación usa el puerto frontend 5179 y un puerto efímero para su backend; no necesita detener la aplicación local en 3000/5173.

## Arquitectura

El backend separa acceso HTTP, reglas de negocio y persistencia:

```text
Route → Middleware → Controller → Service → Repository → Sequelize Model → MySQL
```

El frontend se organiza por funcionalidades y componentes. Las páginas y componentes consumen servicios que utilizan la instancia compartida de Axios para acceder a la API. La autenticación utiliza una cookie HttpOnly gestionada por el backend. La documentación funcional y las decisiones de diseño se encuentran en `docs/ai/`.

## Inicio rápido

1. Clona el repositorio y entra en `cadefar-inventory-system/backend`.
2. Ejecuta `pnpm install` y configura `backend/.env` tomando como referencia `backend/.env.example`.
3. Inicia MySQL Server; prepara la base indicada en `DB_NAME` y verifica las credenciales.
4. Desde `backend/`, ejecuta `pnpm exec sequelize-cli db:migrate` y, si necesitas los datos de demostración, `pnpm exec sequelize-cli db:seed:all` (requiere `SEED_USERS_PASSWORD`).
5. En esa terminal, inicia el backend con `pnpm start`.
6. Abre otra terminal, entra en `cadefar-inventory-system/frontend`, ejecuta `pnpm install` y configura `frontend/.env` a partir de `frontend/.env.example`.
7. Desde `frontend/`, ejecuta `pnpm dev --host localhost --port 5173 --strictPort` y abre `http://localhost:5173`.

Para trabajar con el sistema deben permanecer funcionando **MySQL Server, backend y frontend**.
