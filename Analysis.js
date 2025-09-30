const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileUpload',
    required: true
  },
  chartType: {
    type: String,
    required: true,
    enum: ['bar', 'line', 'scatter', 'bubble', 'radar', 'doughnut', 'pie']
  },
  xAxis: {
    type: String,
    required: true
  },
  yAxis: {
    type: String,
    required: true
  },
  chartTitle: String,
  chartData: {
    type: Object,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ fileId: 1 });

module.exports = mongoose.model('Analysis', analysisSchema);