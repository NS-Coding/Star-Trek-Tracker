# Star-Trek-Tracker

Star-Trek-Tracker was born out of a passion to document and share every thought and reaction during our journey through one of our favorite franchises. My best friend and I have always cherished our discussions about Star Trek, and I wanted a dedicated space to track, rate, and note each episode, season, and movie. More importantly, I wanted to give anyone the opportunity to do the same—to relive the experience, spark conversation, and build a community around our shared love for Star Trek.

> **Prerequisite:**  
> To get started, you will need to have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your system. Docker Desktop is required to run the multi-container setup used in this project.

## Getting Started

This project is built with Flask, SQLAlchemy, and a PostgreSQL database, and it leverages Docker to simplify setup and deployment. Follow these steps to get your instance up and running:

1. **Start Your Docker Containers**

   From the project’s root directory, run:

   ```bash
   docker-compose up --build -d
   ```

   This command will start three containers:
   - **web**: The Flask web application (served by Gunicorn on port **5001**).
   - **db**: A PostgreSQL database.
   - **adminer**: A database administration tool accessible at port **5002**.

2. **Set Up Database Migrations**

   After your containers are running, initialize the migration repository:

   ```bash
   docker-compose exec web python manage.py db init
   ```

   Generate a migration script based on the current models:

   ```bash
   docker-compose exec web python manage.py db migrate
   ```

   Finally, apply the migration to create all necessary database tables:

   ```bash
   docker-compose exec web python manage.py db upgrade
   ```

3. **Import Star Trek Data**

   Once your database is set up and migrated, populate it with data by running:

   ```bash
   docker-compose exec web python data_import.py
   ```

   This script uses CinemagoerNG to fetch details about Star Trek TV series and movies from IMDb and inserts them into your database.

4. **Access the Front End**

   - Open your browser and navigate to: [http://localhost:5001](http://localhost:5001)  
     This is where the Star-Trek-Tracker front end is served.

   - **Forwarding the Port:**  
     If you want to allow friends on other networks to access your tracker, you’ll need to forward port **5001** (or the externally mapped port) on your router. **Security Disclaimer:** Exposing your application to external networks can present security risks. Ensure that you have proper firewall rules, secure credentials, and consider setting up a reverse proxy or VPN to protect your application.

5. **Database Administration (Optional)**

   For easy database inspection, access Adminer at: [http://localhost:5002](http://localhost:5002)  
   Use the following credentials:
   - **System:** PostgreSQL  
   - **Server:** db  
   - **Username:** postgres  
   - **Password:** postgres  
   - **Database:** startrekdb

## Technical Overview

For developers interested in understanding how Star-Trek-Tracker works or planning to extend it, here’s a rundown of the project’s architecture and key components:

- **Application Structure:**  
  The project is organized as a Flask application with blueprints for authentication (`app/auth`), main user functionality (`app/main`), and admin features (`app/admin`). The core app is instantiated in `app/__init__.py`, where configuration, database initialization (via SQLAlchemy), and Flask-Login are set up.

- **Configuration & Environment:**  
  - **`config.py`** contains configuration settings including the secret key and the PostgreSQL database URI.
  - Environment variables can override default configurations to improve security and flexibility.

- **Database & Migrations:**  
  - Models are defined in `app/models.py` and include entities such as **User**, **Show**, **Season**, **Episode**, **Movie**, **Rating**, and **Note**.
  - Database migrations are managed using Flask-Migrate. The `manage.py` script provides commands to initialize, generate, and apply migrations, as well as a custom backup command for the database.

- **Data Importing:**  
  - The **`data_import.py`** script fetches TV series and movie data from IMDb using CinemagoerNG, processes it (including downloading images and parsing dates), and populates the database. This script is essential for importing the initial Star Trek content.

- **Docker & Deployment:**  
  - The **Dockerfile** sets up the Python environment, installs dependencies from `requirements.txt`, and configures Gunicorn as the WSGI server.
  - **docker-compose.yml** orchestrates the multi-container setup, ensuring the web application, PostgreSQL database, and Adminer run in harmony.

- **User Interface & Reviews:**  
  - The front end leverages Bootstrap for styling and Font Awesome for icons. Templates are located in `app/templates` and include pages for registration, login, a dashboard with filtering options, and detailed content views where users can add ratings and notes.
  - Markdown support is provided for notes, with filters defined in `app/__init__.py` for converting Markdown to HTML.

- **Additional Tools:**  
  - **IMDb Search:** The `imdb_search.py` script allows searching IMDb for titles, which can be useful for debugging or extending the app’s capabilities.
