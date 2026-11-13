
const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  taskTitle: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    default: 'Sin asignar'
  },
  performedBy: {
    type: String,
    default: 'No identificado'
  },
  action: {
    type: String,
    required: true
  },
  oldStatus: {
    type: String,
    default: null
  },
  newStatus: {
    type: String,
    default: null
  },
  note: {
    type: String,
    default: ''
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('History', historySchema);
