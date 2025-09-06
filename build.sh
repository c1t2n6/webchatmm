#!/usr/bin/env bash
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Create necessary directories
mkdir -p logs
mkdir -p static/uploads

# Initialize database
python scripts/init_db.py