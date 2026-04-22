# 🚀 AeroMX - Guía de Configuración Local

## Requisitos Previos

- **Node.js** ≥ 18.0.0
- **PostgreSQL** ≥ 13
- **npm** o **yarn**

## Configuración Rápida

### 1️⃣ Configurar Base de Datos

```bash
# Crear base de datos PostgreSQL
createdb aeromx

# O si usas una conexión remota, asegúrate de tener acceso
# postgresql://usuario:password@host:5432/aeromx
```

### 2️⃣ Backend

```bash
# Entrar al directorio del backend
cd aeromx/backend

# Copiar variables de entorno
cp .env.example .env

# EDITAR .env con tus credenciales de PostgreSQL
# Busca la línea: DATABASE_URL="postgresql://usuario:password@localhost:5432/aeromx"
# Y actualiza usuario, password, host según tu configuración

# Instalar dependencias
npm install

# Migrar base de datos (crea tablas automáticamente)
npm run db:migrate

# Cargar datos de prueba (usuarios, aeronaves)
npm run db:seed

# Iniciar servidor (en http://localhost:3000)
npm run dev
```

### 3️⃣ Frontend

En otra terminal:

```bash
# Entrar al directorio del frontend
cd aeromx/frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (en http://localhost:5173)
npm run dev
```

## 🔐 Credenciales de Prueba

Una vez que todo está ejecutándose, usa estas credenciales en el login:

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Técnico | `tecnico@aeromx.com` | `aeromx123` |
| Ingeniero | `ingeniero@aeromx.com` | `aeromx123` |
| Supervisor | `supervisor@aeromx.com` | `aeromx123` |

## 📁 Estructura del Proyecto

```
aeromx/
├── backend/              # API Node.js + Express
│   ├── src/
│   │   ├── routes/       # Definición de endpoints
│   │   ├── controllers/  # Lógica de negocios
│   │   ├── services/     # Servicios reutilizables
│   │   ├── middleware/   # Autenticación, etc.
│   │   └── index.js      # Aplicación principal
│   ├── prisma/
│   │   ├── schema.prisma # Esquema de BD
│   │   └── migrations/   # Migraciones automáticas
│   └── package.json
│
├── frontend/             # PWA React + Vite
│   ├── src/
│   │   ├── pages/        # Páginas principales
│   │   ├── components/   # Componentes reutilizables
│   │   ├── api/          # Servicios de API
│   │   ├── store/        # Estado Zustand
│   │   └── main.jsx      # Punto de entrada
│   └── package.json
│
├── database/             # Scripts SQL
└── docs/                 # Documentación
```

## 🔄 Flujo de la Aplicación

1. **Login** (`/login`)
   - Autentica con email y contraseña
   - Recibe JWT del backend
   - Redirige a dashboard

2. **Dashboard** (`/dashboard`)
   - Lista órdenes de mantenimiento
   - Filtros por estado (borrador, en_proceso, pendiente_firma, cerrada)
   - Botón para crear nueva orden

3. **Crear Orden** (`/ordenes/crear`)
   - Seleccionar formato y aeronave
   - Ingresar datos de cliente y orden de servicio
   - Crea la O/T automáticamente

4. **Inspección** (`/ordenes/:id/inspeccion`)
   - Expandir secciones de inspección
   - Completar puntos (seleccionar estado, observación si aplica)
   - Captura de fotos (en desarrollo)
   - Marcar como completado

5. **Cierre** (`/ordenes/:id/cierre`)
   - Resumen de inspección
   - Indicar si se encontró defecto
   - Firma digital automática
   - Generación y descarga de PDF

## ♻️ Después de un `git pull` con cambios de schema

Cada vez que el `prisma/schema.prisma` cambie (campos nuevos como `fechaRecepcion`,
`lugarMantenimiento`, `archivada`, etc.) hay que **regenerar el cliente Prisma y
aplicar la migración a la base de datos**:

```bash
cd aeromx/backend

# Aplica migraciones nuevas + regenera el cliente. Crea la migración si no existe.
npx prisma migrate dev --name sync_qa_v3

# Si la BD ya está creada y sólo necesitas sincronizarla rápido (sin migrations):
# npx prisma db push
```

Si ves un error como
`Unknown argument 'fechaRecepcion'. Available options are marked with ?` —
significa que el cliente Prisma no se regeneró. Corre `npx prisma generate` o
los comandos de arriba y reinicia `npm run dev`.

## 🛠️ Troubleshooting

### Error: `database "aeromx" does not exist`
- Crea la base de datos: `createdb aeromx`
- O actualiza `DATABASE_URL` en `.env` con una BD existente

### Error: `CORS blocked`
- Asegúrate que `CORS_ORIGIN=http://localhost:5173` en `.env` del backend
- El frontend debe estar en puerto 5173

### Error: `Cannot find module '@prisma/client'`
- Ejecuta `npm install` en `aeromx/backend`
- Luego `npm run db:generate`

### Error: `Unknown argument 'fechaRecepcion' / 'lugarMantenimiento' / 'archivada'`
- El schema cambió pero el cliente Prisma no se regeneró.
- Soluciónalo en `aeromx/backend`:
  ```bash
  npx prisma migrate dev --name sync_qa_v3
  # o, si no quieres crear migración:
  npx prisma db push
  ```
- Reinicia `npm run dev` después de regenerar.

### Frontend no conecta con backend
- Verifica que el backend corre en `http://localhost:3000`
- En `vite.config.js` está configurado el proxy `/api`

## 📊 Endpoints de API Principales

```
POST   /api/auth/login                    Login
GET    /api/auth/me                       Usuario actual
GET    /api/ordenes                       Listar O/T
POST   /api/ordenes                       Crear O/T
GET    /api/ordenes/:id                   Detalle O/T
PATCH  /api/ordenes/:id/puntos/:pId      Actualizar resultado
POST   /api/ordenes/:id/cierre/firmar     Firmar cierre
GET    /api/ordenes/:id/pdf               Descargar PDF
```

## 🚀 Deployment

### Frontend
- Build: `npm run build` → carpeta `dist/`
- Deploy a Vercel, Netlify o servidor propio

### Backend
- Deploy a Railway, Heroku, DigitalOcean, o servidor propio
- Asegurar PostgreSQL en producción
- Configurar variables de entorno en producción

## 📚 Documentación Completa

Ver `CLAUDE.md` para detalles técnicos completos:
- Esquema de BD detallado
- Reglas de negocio
- Stack tecnológico
- Roadmap del proyecto

## 💡 Próximos Pasos

- [ ] Implementar captura de fotos con cámara
- [ ] Interfaz de firma digital visual (canvas)
- [ ] Dashboard de flota y analytics
- [ ] Notificaciones push
- [ ] Soporte offline con Service Worker
