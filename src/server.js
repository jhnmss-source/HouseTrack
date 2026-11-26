
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 // 1 hour
    }
}));

// Routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);
const unitRoutes = require('./routes/units');
app.use('/units', unitRoutes);

// Public files
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
    console.log(`HouseTrack server running at http://localhost:${PORT}`);
});
const requireLogin = require('./middleware/authMiddleware');

app.get('/dashboard.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});