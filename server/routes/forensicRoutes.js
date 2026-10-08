'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { analyzeEml } = require('../controllers/forensicController');

// Multer memory storage configuration
const storage = multer.memoryStorage();
// Parse MAX_EML_SIZE_MB from env, default 10MB
const maxSizeMB = parseInt(process.env.MAX_EML_SIZE_MB || '10', 10);
const limits = { fileSize: maxSizeMB * 1024 * 1024 };

const upload = multer({
  storage,
  limits,
  fileFilter: (req, file, cb) => {
    // Sanitize filename against null bytes and path traversal characters
    if (file.originalname.includes('\0') || file.originalname.includes('..') || /[<>:"/\\|?*]/.test(file.originalname)) {
      return cb(new Error('Invalid filename characters in upload.'), false);
    }
    // Only accept .eml extension
    if (!file.originalname.toLowerCase().endsWith('.eml')) {
      return cb(new Error('Only .eml files are allowed'), false);
    }
    cb(null, true);
  }
});

// @route   POST /api/email-forensics/analyze
// @desc    Upload and analyze .eml file
// @access  Private
router.post(
  '/analyze',
  protect,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: { code: 'FILE_TOO_LARGE', message: `File size exceeds the limit of ${maxSizeMB}MB.` }
          });
        }
        return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } });
      } else if (err) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: err.message } });
      }
      next();
    });
  },
  analyzeEml
);

module.exports = router;
