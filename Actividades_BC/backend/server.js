\
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Task = require('./models/Task');
const History = require('./models/History');

const app = express();
app.use(cors({ origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://127.0.0.1:3000', 'null'] }));
app.use(express.json());

function validTask(data) {
  const priorities = ['Baja', 'Media', 'Alta', 'Urgente'];
  const statuses = ['Pendiente', 'En progreso', 'Completada'];
  if (!data.title || !data.title.trim()) return 'El título es obligatorio';
  if (data.priority && !priorities.includes(data.priority)) return 'Prioridad no válida';
  if (data.status && !statuses.includes(data.status)) return 'Estado no válido';
  return null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/tasks', async (_req, res) => {
  try {
    const tasks = await Task.find().sort({ updatedAt: -1 }).lean();
    res.json(tasks);
  } catch (err) { res.status(500).json({ message: 'No se pudieron obtener las actividades' }); }
});

app.post('/api/tasks', async (req, res) => {
  const validation = validTask(req.body);
  if (validation) return res.status(400).json({ message: validation });
  try {
    const task = await Task.create({
      title: req.body.title, description: req.body.description || '',
      owner: req.body.owner || '', priority: req.body.priority || 'Media',
      status: req.body.status || 'Pendiente', dueDate: req.body.dueDate || null,
      completedAt: req.body.status === 'Completada' ? new Date() : null
    });
    await History.create({
      taskId: task._id, taskTitle: task.title, owner: task.owner || 'Sin asignar',
      action: 'Creación', oldStatus: null, newStatus: task.status, note: 'Actividad registrada'
    });
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ message: 'No se pudo crear la actividad' }); }
});

app.put('/api/tasks/:id', async (req, res) => {
  const validation = validTask(req.body);
  if (validation) return res.status(400).json({ message: validation });
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Actividad no encontrada' });
    const oldStatus = task.status;
    task.title = req.body.title;
    task.description = req.body.description || '';
    task.owner = req.body.owner || '';
    task.priority = req.body.priority || 'Media';
    task.status = req.body.status || 'Pendiente';
    task.dueDate = req.body.dueDate || null;
    task.completedAt = task.status === 'Completada' ? (task.completedAt || new Date()) : null;
    await task.save();
    await History.create({
      taskId: task._id, taskTitle: task.title, owner: task.owner || 'Sin asignar',
      action: oldStatus === task.status ? 'Edición' : 'Cambio de estado',
      oldStatus, newStatus: task.status, note: 'Actividad actualizada'
    });
    res.json(task);
  } catch (err) { res.status(500).json({ message: 'No se pudo actualizar la actividad' }); }
});

app.patch('/api/tasks/:id/complete', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Actividad no encontrada' });
    const oldStatus = task.status;
    task.status = 'Completada';
    task.completedAt = new Date();
    await task.save();
    await History.create({
      taskId: task._id, taskTitle: task.title, owner: task.owner || 'Sin asignar',
      action: 'Actividad completada', oldStatus, newStatus: 'Completada',
      note: req.body.note || 'Actividad marcada como realizada'
    });
    res.json({ message: 'Actividad completada', task });
  } catch (err) { res.status(500).json({ message: 'No se pudo completar la actividad' }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Actividad no encontrada' });
    // El historial se conserva deliberadamente, incluso si se elimina la actividad.
    res.json({ message: 'Actividad eliminada; su historial se conservó' });
  } catch (err) { res.status(500).json({ message: 'No se pudo eliminar la actividad' }); }
});

app.get('/api/history', async (_req, res) => {
  try {
    const history = await History.find().sort({ changedAt: -1 }).lean();
    res.json(history);
  } catch (err) { res.status(500).json({ message: 'No se pudo consultar el historial' }); }
});

const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Conectado correctamente a MongoDB Atlas');
    app.listen(PORT, () => console.log(`Servidor API en http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('No se pudo conectar a MongoDB Atlas:', err.message);
    process.exit(1);
  });
