#!/usr/bin/env python
import os
import subprocess
from datetime import datetime

from flask import current_app
from flask.cli import FlaskGroup
from flask_migrate import Migrate

from app import create_app, db

# Create the app via the factory.
app = create_app()
migrate = Migrate(app, db)

cli = FlaskGroup(create_app=create_app)

@cli.command("backup")
def backup():
    """Back up the PostgreSQL database using pg_dump."""
    # Define backup directory and file name.
    backup_dir = os.path.join(os.getcwd(), "backups")
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"backup_{timestamp}.sql")

    # Get the connection string from environment.
    # It should be in a format acceptable to pg_dump (e.g. postgres://user:pass@host:port/db)
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        cli.echo("DATABASE_URL environment variable is not set.")
        return

    # Run pg_dump. Note: pg_dump can accept the connection string directly.
    # If you are running inside Docker, you might need to run this command in the db container.
    command = ["pg_dump", database_url, "-f", backup_file]

    try:
        subprocess.check_call(command)
        cli.echo(f"Backup successful: {backup_file}")
    except subprocess.CalledProcessError as e:
        cli.echo(f"Backup failed: {e}")

if __name__ == "__main__":
    cli()
