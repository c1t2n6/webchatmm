#!/usr/bin/env bash
set -o errexit

# Force Python 3.11 - Check multiple ways
echo "=== FORCING PYTHON 3.11 ==="
echo "Current Python version:"
python --version

echo "Python executable path:"
which python

echo "Python symlink target:"
ls -la $(which python)

# Verify Python 3.11
if [[ $(python --version 2>&1) != *"3.11"* ]]; then
    echo "ERROR: Python 3.11 not detected!"
    echo "Available Python versions:"
    ls /usr/local/bin/python*
    exit 1
fi

echo "✅ Python 3.11 confirmed!"

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "Creating directories..."
mkdir -p logs
mkdir -p static/uploads

echo "✅ Build completed successfully!"
