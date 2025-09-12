#!/usr/bin/env node

// Setup directories for production deployment
const fs = require('fs');
const path = require('path');

const directories = [
  './static/uploads',
  './logs'
];

console.log('📁 Setting up directories for production...');

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

console.log('✅ Directory setup completed');
