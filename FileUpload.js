const mongoose = require('mongoose');

const fileUploadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  headers: [String],
  rowCount: Number,
  fileSize: Number,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  analyses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Analysis'
  }]
});

module.exports = mongoose.model('FileUpload', fileUploadSchema);