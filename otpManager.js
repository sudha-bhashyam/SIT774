const nodemailer = require('nodemailer');
const crypto = require('crypto'); // Import crypto module for secure OTP generation

// In-memory store for OTPs
const otpStore = {};

/**
 * Generates a secure 6-digit OTP using crypto.randomInt.
 * Stores the OTP and a timestamp for expiry checking.
 */
exports.generateOTP = (email) => {
  const otp = crypto.randomInt(100000, 1000000).toString(); // Generates secure OTP between 100000–999999
  otpStore[email] = { otp, timestamp: Date.now() }; // Store OTP with current time
  return otp;
};

/**
 * Sends the OTP via email using Nodemailer.
 * Credentials are stored securely in environment variables.
 */
exports.sendOTP = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_ID,      // Your Gmail address from .env
      pass: process.env.EMAIL_PASS     // App password or Gmail password from .env
    }
  });

  await transporter.sendMail({
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}. It expires in 2 minutes.`
  });
};

/**
 * Validates the input OTP against the stored OTP.
 * Also checks if the OTP has expired (2-minute validity window).
 */
exports.validateOTP = (email, inputOtp) => {
  const record = otpStore[email];
  if (!record) return false;

  const isValid = record.otp === inputOtp;
  const isExpired = (Date.now() - record.timestamp) > 2 * 60 * 1000; // 2 minutes expiry

  return isValid && !isExpired;
};
