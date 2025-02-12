from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from config import Config
import markdown
import re

db = SQLAlchemy()
login_manager = LoginManager()

def stars_filter(rating, max_stars=5):
    if rating is None:
        return "<span class='text-muted'>No rating</span>"
    stars = rating / 2.0
    full = int(stars)
    half = 1 if (stars - full) >= 0.5 else 0
    empty = max_stars - full - half
    result = ""
    result += "<i class='fas fa-star'></i> " * full
    if half:
        result += "<i class='fas fa-star-half-alt'></i> "
    result += "<i class='far fa-star'></i> " * empty
    return result

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    def markdown_filter(text):
        # Simply convert markdown to HTML without escaping headers.
        return markdown.markdown(text, extensions=['nl2br', 'fenced_code', 'sane_lists'])

    app.jinja_env.filters['markdown'] = markdown_filter
    app.jinja_env.filters['stars'] = stars_filter

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    from app.auth.routes import auth_bp
    from app.main.routes import main_bp
    from app.admin.routes import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)

    return app
