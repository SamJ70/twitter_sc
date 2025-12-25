const express = require('express');
const cors = require('cors');
const path = require('path');
const profileController = require('./controllers/profileController');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from reports directory
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// Routes
app.post('/api/analyze', profileController.analyzeProfile);
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Kosh Profile Tracker is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!', 
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Kosh Profile Tracker Backend running on http://localhost:${PORT}`);
  console.log(`📊 Reports available at http://localhost:${PORT}/reports`);
});