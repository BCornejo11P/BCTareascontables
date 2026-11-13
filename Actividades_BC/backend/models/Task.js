
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, default: '' },
  owner: { type: String, default: '' },
  startDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  priority: {
    type: String,
    enum: ['Baja', 'Media', 'Alta', 'Urgente'],
    default: 'Media'
  },
  status: {
    type: String,
    enum: ['Pendiente', 'En progreso', 'Completada'],
    default: 'Pendiente'
  },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
