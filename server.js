const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const otpManager = require('./otpManager');

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public_html')); // Serves static files like HTML, CSS, JS

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));



// Home route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public_html', 'index.html'));
});

// Route to send OTP
app.post('/send-otp', async (req, res) => {
  const email = req.body.email;
  const otp = otpManager.generateOTP(email);
  try {
    await otpManager.sendOTP(email, otp);
    req.session.email = email;
    res.redirect('/otp.html');
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).send('Failed to send OTP. Please try again later.');
  }
});

// Route to verify OTP
app.post('/verify-otp', (req, res) => {
  const { otp } = req.body;
  const email = req.session.email;

  if (otpManager.validateOTP(email, otp)) {
    res.send(`<h2> OTP Verified! Welcome ${email}</h2>`);
  } else {
    res.send(`<h2> Invalid or Expired OTP</h2><a href="/">Try Again</a>`);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
