# Star-Trek-Tracker
Front-end with user management to track, rate, and note take for every episode, season, movie, and show of star trek in release order.


## Setting Up the Database & Backups

After building and starting your Docker containers for the first time, follow these steps:

1. **Start Your Docker Containers**

   From your project’s root directory, run:

   ```bash
   docker-compose up -d
   ```

   This command starts all containers (the web app, PostgreSQL database, and Adminer).

2. **Initialize the Migrations Directory**

   Run the following command (without entering an interactive shell):

   ```bash
   docker-compose exec web python manage.py db init
   ```

   This command creates a new `migrations` folder where migration scripts will be stored.

3. **Generate a Migration Script**

   Generate a migration script based on your current models by running:

   ```bash
   docker-compose exec web python manage.py db migrate
   ```

4. **Apply the Migration**

   Upgrade your database to the latest migration (which creates all necessary tables):

   ```bash
   docker-compose exec web python manage.py db upgrade
   ```

5. **Backup the Database**

   You can backup your database by running:

   ```bash
   docker-compose exec web python manage.py backup
   ```

   This command creates a backup file in a `backups` directory in your project root.  
   **Note:** Ensure that the PostgreSQL client (`pg_dump`) is installed in your web container (see the Dockerfile note below).

6. **Verify Your Database (Optional)**

   Open your browser and navigate to [http://localhost:5002](http://localhost:5002) (or the port specified for Adminer in your `docker-compose.yml`). Log in using:
   
   - **System:** PostgreSQL  
   - **Server:** db  
   - **Username:** postgres  
   - **Password:** postgres  
   - **Database:** startrekdb