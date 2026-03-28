#!/bin/bash
echo "Starting medicanteen with Gunicorn (Production Server)..."
echo "Starting with 5 workers..."
# Gunicorn is far more efficient than runserver
# Make sure you are in the directory containing manage.py when running this.
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m gunicorn canteen.wsgi:application --workers 5 --bind 0.0.0.0:8000
