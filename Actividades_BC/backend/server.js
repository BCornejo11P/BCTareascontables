
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Task = require('./models/Task');
const History = require('./models/History');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'https://bctareascontables-web.onrender.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS'));
  }
}));

app.use(express.json());

// Comprobar servidor y conexión con MongoDB
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1
      ? 'connected'
      : 'disconnected'
  });
});

// ==========================================
// INICIO DE SESIÓN
// ==========================================

app.post('/api/login', (req, res) => {
  const { name, password } = req.body;

  if (!process.env.SHARED_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(500).json({
      message: 'El acceso no está configurado en el servidor'
    });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({
      message: 'Debes ingresar tu nombre'
    });
  }

  if (!password || password !== process.env.SHARED_PASSWORD) {
    return res.status(401).json({
      message: 'Contraseña incorrecta'
    });
  }

  const userName = name.trim().substring(0, 60);

  const token = jwt.sign(
    {
      access: true,
      name: userName
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    message: 'Acceso autorizado',
    token,
    name: userName
  });
});

// ==========================================
// PROTECCIÓN DE RUTAS
// ==========================================

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Debes iniciar sesión'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.access !== true || !decoded.name) {
      return res.status(403).json({
        message: 'Acceso no autorizado'
      });
    }

    req.user = {
      name: decoded.name
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'La sesión expiró. Inicia sesión nuevamente'
    });
  }
}

// Desde aquí todas las rutas /api requieren autenticación.
// /api/health y /api/login quedan públicas porque están antes.
app.use('/api', authenticate);

// ==========================================
// VALIDACIÓN DE ACTIVIDADES
// ==========================================

function validTask(data) {
  const priorities = ['Baja', 'Media', 'Alta', 'Urgente'];
  const statuses = ['Pendiente', 'En progreso', 'Completada'];

  if (!data.title || !data.title.trim()) {
    return 'El título es obligatorio';
  }

  if (data.priority && !priorities.includes(data.priority)) {
    return 'Prioridad no válida';
  }

  if (data.status && !statuses.includes(data.status)) {
    return 'Estado no válido';
  }

  return null;
}

// ==========================================
// OBTENER ACTIVIDADES
// ==========================================

app.get('/api/tasks', async (_req, res) => {
  try {
    const tasks = await Task.find()
      .sort({ updatedAt: -1 })
      .lean();

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'No se pudieron obtener las actividades'
    });
  }
});

// ==========================================
// CREAR ACTIVIDAD
// ==========================================

app.post('/api/tasks', async (req, res) => {
  const validation = validTask(req.body);

  if (validation) {
    return res.status(400).json({ message: validation });
  }

  try {
    const task = await Task.create({
      title: req.body.title,
      description: req.body.description || '',
      owner: req.body.owner || '',
      priority: req.body.priority || 'Media',
      status: req.body.status || 'Pendiente',
      dueDate: req.body.dueDate || null,
      completedAt:
        req.body.status === 'Completada' ? new Date() : null
    });

    await History.create({
      taskId: task._id,
      taskTitle: task.title,
      owner: task.owner || 'Sin asignar',
      performedBy: req.user.name,
      action: 'Creación',
      oldStatus: null,
      newStatus: task.status,
      note: 'Actividad registrada'
    });

    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'No se pudo crear la actividad'
    });
  }
});

// ==========================================
// EDITAR ACTIVIDAD
// ==========================================

app.put('/api/tasks/:id', async (req, res) => {
  const validation = validTask(req.body);

  if (validation) {
    return res.status(400).json({ message: validation });
  }

  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: 'Actividad no encontrada'
      });
    }

    const oldStatus = task.status;

    task.title = req.body.title;
    task.description = req.body.description || '';
    task.owner = req.body.owner || '';
    task.priority = req.body.priority || 'Media';
    task.status = req.body.status || 'Pendiente';
    task.dueDate = req.body.dueDate || null;

    task.completedAt =
      task.status === 'Completada'
        ? (task.completedAt || new Date())
        : null;

    await task.save();

    await History.create({
      taskId: task._id,
      taskTitle: task.title,
      owner: task.owner || 'Sin asignar',
      performedBy: req.user.name,
      action:
        oldStatus === task.status
          ? 'Edición'
          : 'Cambio de estado',
      oldStatus,
      newStatus: task.status,
      note: 'Actividad actualizada'
    });

    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'No se pudo actualizar la actividad'
    });
  }
});

// ==========================================
// COMPLETAR ACTIVIDAD
// ==========================================

app.patch('/api/tasks/:id/complete', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: 'Actividad no encontrada'
      });
    }

    const oldStatus = task.status;

    task.status = 'Completada';
    task.completedAt = new Date();

    await task.save();

    await History.create({
      taskId: task._id,
      taskTitle: task.title,
      owner: task.owner || 'Sin asignar',
      performedBy: req.user.name,
      action: 'Actividad completada',
      oldStatus,
      newStatus: 'Completada',
      note: req.body.note || 'Actividad marcada como realizada'
    });

    res.json({
      message: 'Actividad completada',
      task
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'No se pudo completar la actividad'
    });
  }
});

// ==========================================
// ELIMINAR ACTIVIDAD
// ==========================================

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: 'Actividad no encontrada'
      });
    }

    await History.create({
      taskId: task._id,
      taskTitle: task.title,
      owner: task.owner || 'Sin asignar',
      performedBy: req.user.name,
      action: 'Eliminación',
      oldStatus: task.status,
      newStatus: null,
      note: 'Actividad eliminada'
    });

    res.json({
      message: 'Actividad eliminada y registrada en el historial'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'No se pudo eliminar la actividad'
    });
  }
});

// ==========================================
// CONSULTAR HISTORIAL
// ==========================================

app.get('/api/history', async (_req, res) => {
  try {
    const history = await History.find()
      .sort({ changedAt: -1 })
      .lean();

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'No se pudo consultar el historial'
    });
  }
});

// ==========================================
// CONEXIÓN A MONGODB ATLAS
// ==========================================

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Conectado correctamente a MongoDB Atlas');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor iniciado en el puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error(
      'No se pudo conectar a MongoDB Atlas:',
      err.message
    );

    process.exit(1);
  });
