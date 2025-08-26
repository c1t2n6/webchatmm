#!/usr/bin/env bash
set -o errexit

# Force Python 3.11
echo "Using Python version:"
python --version

# Install dependencies
pip install -r requirements.txt

# Create necessary directories
mkdir -p logs
mkdir -p static/uploads
