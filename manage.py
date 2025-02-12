#!/usr/bin/env python
import os
import datetime
import subprocess
from flask.cli import FlaskGroup
import click
from flask_migrate import Migrate, init as migrate_init, migrate as migrate_command, upgrade as migrate_upgrade
from urllib.parse import urlparse
from app import create_app, db

# Create the app instance.
app = create_app()

# Initialize Flask-Migrate so it registers itself in app.extensions.
migrate = Migrate(app, db)

# Pass the app instance (not the factory) to FlaskGroup.
cli = FlaskGroup(app)

# Define a custom "db" command group.
@cli.group()
def db():
    """Database migration commands."""
    pass

@db.command("init")
def db_init():
    """Initialize a new migration repository."""
    with app.app_context():
        migrate_init(directory="migrations")
    click.echo("Migration repository initialized.")

@db.command("migrate")
def db_migrate():
    """Generate a migration script."""
    with app.app_context():
        migrate_command(directory="migrations", message="Auto migration")
    click.echo("Migration script generated.")

@db.command("upgrade")
def db_upgrade():
    """Upgrade the database to the latest revision."""
    with app.app_context():
        migrate_upgrade(directory="migrations")
    click.echo("Database upgraded.")

# Add a new command to backup the database.
@cli.command("backup")
def backup_db():
    """Backup the database to a SQL file."""
    # Get the database URL from the configuration.
    db_url = app.config.get("SQLALCHEMY_DATABASE_URI")
    parsed_url = urlparse(db_url)
    user = parsed_url.username
    password = parsed_url.password
    host = parsed_url.hostname
    port = parsed_url.port
    db_name = parsed_url.path.lstrip('/')  # Remove the leading slash

    # Prepare the backup directory and filename.
    backup_dir = os.path.join(os.getcwd(), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"backup_{timestamp}.sql")

    # Set the environment variable for pg_dump to use the password.
    env = os.environ.copy()
    env["PGPASSWORD"] = password

    # Build the pg_dump command.
    cmd = [
        "pg_dump",
        "-h", host,
        "-p", str(port),
        "-U", user,
        "-d", db_name,
        "-f", backup_file
    ]

    # Execute the command.
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        click.echo("Error during backup:")
        click.echo(result.stderr)
    else:
        click.echo(f"Backup saved to {backup_file}")

if __name__ == '__main__':
    cli()
