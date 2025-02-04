from app import db, login_manager
from flask_login import UserMixin
from datetime import datetime

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(128), unique=True, nullable=False)
    email    = db.Column(db.Text, unique=True, nullable=False)
    password = db.Column(db.Text, nullable=False)
    is_admin    = db.Column(db.Boolean, default=False)
    is_approved = db.Column(db.Boolean, default=False)
    ratings = db.relationship('Rating', backref='user', lazy=True)
    notes   = db.relationship('Note', backref='user', lazy=True)

    def __repr__(self):
        return f'<User {self.username}>'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class Show(db.Model):
    __tablename__ = 'shows'
    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text)
    order       = db.Column(db.Integer)  # For checklist ordering
    artwork_url = db.Column(db.String(256))  # Artwork placeholder URL
    seasons     = db.relationship('Season', backref='show', lazy=True)

    def __repr__(self):
        return f'<Show {self.title}>'

class Season(db.Model):
    __tablename__ = 'seasons'
    id      = db.Column(db.Integer, primary_key=True)
    number  = db.Column(db.Integer, nullable=False)
    show_id = db.Column(db.Integer, db.ForeignKey('shows.id'), nullable=False)
    episodes = db.relationship('Episode', backref='season', lazy=True)

    def __repr__(self):
        return f'<Season {self.number} of Show {self.show_id}>'

class Episode(db.Model):
    __tablename__ = 'episodes'
    id             = db.Column(db.Integer, primary_key=True)
    title          = db.Column(db.String(128), nullable=False)
    episode_number = db.Column(db.Integer)
    season_id      = db.Column(db.Integer, db.ForeignKey('seasons.id'), nullable=False)
    air_date       = db.Column(db.Date)
    artwork_url    = db.Column(db.String(256))  # Artwork placeholder URL for episodes
    ratings        = db.relationship('Rating', backref='episode', lazy=True)
    notes          = db.relationship('Note', backref='episode', lazy=True)

    def __repr__(self):
        return f'<Episode {self.title}>'

class Movie(db.Model):
    __tablename__ = 'movies'
    id           = db.Column(db.Integer, primary_key=True)
    title        = db.Column(db.String(128), nullable=False)
    release_date = db.Column(db.Date)
    description  = db.Column(db.Text)
    order        = db.Column(db.Integer)  # For checklist ordering
    artwork_url  = db.Column(db.String(256))  # Artwork placeholder URL for movies
    ratings      = db.relationship('Rating', backref='movie', lazy=True)
    notes        = db.relationship('Note', backref='movie', lazy=True)

    def __repr__(self):
        return f'<Movie {self.title}>'

class Rating(db.Model):
    __tablename__ = 'ratings'
    id         = db.Column(db.Integer, primary_key=True)
    value      = db.Column(db.Float, nullable=False)  # Supports half-star increments
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    episode_id = db.Column(db.Integer, db.ForeignKey('episodes.id'), nullable=True)
    movie_id   = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=True)
    timestamp  = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Rating {self.value} by User {self.user_id}>'

class Note(db.Model):
    __tablename__ = 'notes'
    id         = db.Column(db.Integer, primary_key=True)
    content    = db.Column(db.Text)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    episode_id = db.Column(db.Integer, db.ForeignKey('episodes.id'), nullable=True)
    movie_id   = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=True)
    timestamp  = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Note by User {self.user_id}>'
