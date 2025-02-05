# Use an official Python runtime as the base image
FROM python:3.9-slim

#Install git and other build dependencies
RUN apt-get update && apt-get install -y git

# Environment variables to disable bytecode and buffer output
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the application code into the container
COPY . /app/

# Expose port 5001
EXPOSE 5001

# Use Gunicorn to serve the app
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "wsgi:app"]
