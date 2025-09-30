const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_analyzer', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Models
const User = require('./models/User');
const FileUpload = require('./models/FileUpload');
const Analysis = require('./models/Analysis');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xls', '.xlsx'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Routes

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      email,
      password: hashedPassword,
      name,
      role: email === 'admin@excel.com' ? 'admin' : 'user' // Auto-admin for demo
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// File upload and analysis routes
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Read Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    const headers = data[0];
    const rows = data.slice(1).filter(row => row.length > 0);

    // Save file info to database
    const fileUpload = new FileUpload({
      userId: req.user.userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      headers: headers,
      rowCount: rows.length,
      fileSize: req.file.size
    });

    await fileUpload.save();

    res.json({
      message: 'File uploaded successfully',
      fileId: fileUpload._id,
      headers: headers,
      data: rows.slice(0, 10), // Return first 10 rows for preview
      totalRows: rows.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error processing file: ' + error.message });
  }
});

app.post('/api/analyze', authenticateToken, async (req, res) => {
  try {
    const { fileId, chartType, xAxis, yAxis, chartTitle } = req.body;

    if (!fileId || !chartType || !xAxis || !yAxis) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const fileUpload = await FileUpload.findOne({ _id: fileId, userId: req.user.userId });
    if (!fileUpload) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Read the file again for analysis
    const workbook = xlsx.readFile(fileUpload.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ message: 'No data available for analysis' });
    }

    // Validate that selected columns exist
    if (!data[0].hasOwnProperty(xAxis) || !data[0].hasOwnProperty(yAxis)) {
      return res.status(400).json({ message: 'Selected columns not found in data' });
    }

    // Process data for chart
    const chartData = {
      labels: data.map(row => row[xAxis]),
      datasets: [{
        label: yAxis,
        data: data.map(row => row[yAxis]),
        backgroundColor: getBackgroundColor(chartType),
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    };

    // Save analysis to database
    const analysis = new Analysis({
      userId: req.user.userId,
      fileId: fileId,
      chartType: chartType,
      xAxis: xAxis,
      yAxis: yAxis,
      chartTitle: chartTitle || `${yAxis} vs ${xAxis}`,
      chartData: chartData
    });

    await analysis.save();

    // Update file upload with analysis reference
    await FileUpload.findByIdAndUpdate(fileId, { 
      $push: { analyses: analysis._id } 
    });

    res.json({
      analysisId: analysis._id,
      chartData: chartData,
      chartType: chartType,
      chartTitle: analysis.chartTitle,
      xAxis: xAxis,
      yAxis: yAxis
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ message: 'Error generating analysis: ' + error.message });
  }
});

// Helper function for chart colors
function getBackgroundColor(chartType) {
  const colors = {
    bar: 'rgba(54, 162, 235, 0.6)',
    line: 'rgba(255, 99, 132, 0.6)',
    scatter: 'rgba(75, 192, 192, 0.6)',
    bubble: 'rgba(153, 102, 255, 0.6)',
    radar: 'rgba(255, 159, 64, 0.6)',
    doughnut: [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(153, 102, 255, 0.6)'
    ],
    pie: [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(153, 102, 255, 0.6)'
    ]
  };
  
  return colors[chartType] || 'rgba(54, 162, 235, 0.6)';
}

// Get user history
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const analyses = await Analysis.find({ userId: req.user.userId })
      .populate('fileId')
      .sort({ createdAt: -1 });

    res.json(analyses);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ message: 'Error fetching history' });
  }
});

// Get user files
app.get('/api/files', authenticateToken, async (req, res) => {
  try {
    const files = await FileUpload.find({ userId: req.user.userId })
      .sort({ uploadedAt: -1 });

    res.json(files);
  } catch (error) {
    console.error('Files error:', error);
    res.status(500).json({ message: 'Error fetching files' });
  }
});

// Delete analysis
app.delete('/api/analysis/:id', authenticateToken, async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ 
      _id: req.params.id, 
      userId: req.user.userId 
    });

    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }

    await Analysis.findByIdAndDelete(req.params.id);
    res.json({ message: 'Analysis deleted successfully' });
  } catch (error) {
    console.error('Delete analysis error:', error);
    res.status(500).json({ message: 'Error deleting analysis' });
  }
});

// Admin routes
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.get('/api/admin/usage', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalFiles = await FileUpload.countDocuments();
    const totalAnalyses = await Analysis.countDocuments();
    
    const storageUsage = await FileUpload.aggregate([
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$fileSize' }
        }
      }
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email createdAt');

    res.json({
      totalUsers,
      totalFiles,
      totalAnalyses,
      totalStorage: storageUsage[0]?.totalSize || 0,
      recentUsers
    });
  } catch (error) {
    console.error('Admin usage error:', error);
    res.status(500).json({ message: 'Error fetching usage stats' });
  }
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Excel Analysis Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
  }
  res.status(500).json({ message: error.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Excel Analysis Platform Backend Ready`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});