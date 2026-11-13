\
# Gestor de actividades con MongoDB Atlas

Proyecto sencillo con HTML, CSS y JavaScript en el frontend, y Node.js + Express + Mongoose en el backend.

## 1. Configurar MongoDB Atlas

1. Entra a https://cloud.mongodb.com/ e inicia sesión.
2. Crea un proyecto y un clúster gratuito (si está disponible en tu cuenta).
3. En **Database Access**, crea un usuario de base de datos y guarda su contraseña.
4. En **Network Access**, agrega la IP desde la que te conectarás. Para pruebas puedes permitir `0.0.0.0/0`, pero restringe el acceso a tu IP para un entorno real.
5. En **Database > Connect > Drivers**, selecciona Node.js y copia la cadena `mongodb+srv://...`.
6. Sustituye el usuario y contraseña en la cadena. Si la contraseña contiene caracteres especiales, codifícalos para URL.

## 2. Configurar backend

Abre la carpeta `backend` en una terminal:

```powershell
npm install
```

Copia `.env.example` y crea un archivo llamado `.env` en esa misma carpeta. Pega tu cadena de conexión:

```env
PORT=4000
MONGODB_URI=mongodb+srv://USUARIO:CONTRASENA@cluster0.xxxxx.mongodb.net/gestor_empresa?retryWrites=true&w=majority
```

No compartas el archivo `.env` ni subas tus credenciales a GitHub.

Inicia el servidor:

```powershell
npm run dev
```

Debe mostrar:
`Conectado correctamente a MongoDB Atlas`
`Servidor API en http://localhost:4000`

## 3. Abrir el frontend

Abre `frontend/index.html` con Live Server en VS Code. Normalmente será:
`http://127.0.0.1:5500/frontend/index.html`

El backend permite CORS para Live Server en los puertos 5500 y 3000. Si usas otro puerto, ajusta la lista de orígenes en `backend/server.js`.

## 4. Funciones incluidas

- Crear, editar, listar y eliminar actividades.
- Cambiar estado y marcar como completada.
- Guardar las actividades en MongoDB Atlas.
- Registrar creación, edición y cambios de estado en el historial.
- Conservar el historial aunque se elimine una actividad.
- Buscar y filtrar por estado en la interfaz.
- Dashboard con contadores.

## Importante

Esta versión es una base de desarrollo local. No incluye autenticación ni roles de usuario. Antes de publicarla en internet, añade autenticación, autorización, validación y protección de API, limita CORS a tu dominio y restringe las IP permitidas en Atlas.
