from app import db, login_manager
from flask_login import UserMixin
from datetime import datetime

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id       = db.Column(db.Integer, primary_key=True, index=True)
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
    id          = db.Column(db.Integer, primary_key=True, index=True)
    title       = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text)
    order       = db.Column(db.Integer, index=True)
    artwork_url = db.Column(db.String(256))
    imdb_rating = db.Column(db.Float)
    seasons     = db.relationship('Season', backref='show', lazy=True)
    notes       = db.relationship('Note', backref='show', lazy=True)
    ratings     = db.relationship('Rating', backref='show', lazy=True)

    @property
    def watched(self):
        if not self.seasons:
            return False
        return all(season.watched for season in self.seasons)

    def get_calculated_user_rating(self, user_id):
        """
        Returns the average of the current user’s ratings on all episodes within all seasons.
        (A season’s calculated rating is computed from its episodes.)
        """
        ratings = []
        for season in self.seasons:
            season_rating = season.get_calculated_user_rating(user_id)
            if season_rating is not None:
                ratings.append(season_rating)
        if ratings:
            return sum(ratings) / len(ratings)
        return None

    @property
    def calculated_avg_user_rating(self):
        """
        Returns the overall average of all users’ episode ratings from all seasons.
        """
        ratings = []
        for season in self.seasons:
            season_rating = season.calculated_avg_user_rating
            if season_rating is not None:
                ratings.append(season_rating)
        if ratings:
            return sum(ratings) / len(ratings)
        return None

    def __repr__(self):
        return f'<Show {self.title}>'
    
class Season(db.Model):
    __tablename__ = 'seasons'
    id          = db.Column(db.Integer, primary_key=True, index=True)
    number      = db.Column(db.Integer, nullable=False, index=True)
    show_id     = db.Column(db.Integer, db.ForeignKey('shows.id'), nullable=False)
    imdb_rating = db.Column(db.Float)
    episodes    = db.relationship('Episode', backref='season', lazy=True)
    notes       = db.relationship('Note', backref='season', lazy=True)
    ratings     = db.relationship('Rating', backref='season', lazy=True)

    @property
    def watched(self):
        if not self.episodes:
            return False
        return all(episode.watched for episode in self.episodes)

    @property
    def display_artwork_url(self):
        """If no specific season image, fall back to the parent show artwork."""
        if self.show and self.show.artwork_url:
            return self.show.artwork_url
        return None

    def get_calculated_user_rating(self, user_id):
        """
        Returns the average of the current user’s ratings on all episodes in this season.
        """
        ratings = []
        for episode in self.episodes:
            for rating in episode.ratings:
                if rating.user_id == user_id:
                    ratings.append(rating.value)
        if ratings:
            return sum(ratings) / len(ratings)
        return None

    @property
    def calculated_avg_user_rating(self):
        """
        Returns the average of all users’ ratings on all episodes in this season.
        """
        ratings = []
        for episode in self.episodes:
            for rating in episode.ratings:
                ratings.append(rating.value)
        if ratings:
            return sum(ratings) / len(ratings)
        return None

    def __repr__(self):
        return f'<Season {self.number} of Show {self.show_id}>'

class Episode(db.Model):
    __tablename__ = 'episodes'
    id             = db.Column(db.Integer, primary_key=True, index=True)
    title          = db.Column(db.String(256), nullable=False)
    episode_number = db.Column(db.Integer, index=True)
    season_id      = db.Column(db.Integer, db.ForeignKey('seasons.id'), nullable=False)
    air_date       = db.Column(db.Date)
    artwork_url    = db.Column(db.String(256))
    imdb_rating    = db.Column(db.Float)
    watched        = db.Column(db.Boolean, default=False)
    ratings        = db.relationship('Rating', backref='episode', lazy=True)
    notes          = db.relationship('Note', backref='episode', lazy=True)

    @property
    def display_artwork_url(self):
        if self.artwork_url:
            return self.artwork_url
        if self.season and self.season.show and self.season.show.artwork_url:
            return self.season.show.artwork_url
        return None

    def __repr__(self):
        return f'<Episode {self.title}>'

class Movie(db.Model):
    __tablename__ = 'movies'
    id           = db.Column(db.Integer, primary_key=True, index=True)
    title        = db.Column(db.String(128), nullable=False)
    release_date = db.Column(db.Date)
    description  = db.Column(db.Text)
    order        = db.Column(db.Integer, index=True)
    artwork_url  = db.Column(db.String(256))
    imdb_rating  = db.Column(db.Float)
    watched      = db.Column(db.Boolean, default=False)
    ratings      = db.relationship('Rating', backref='movie', lazy=True)
    notes        = db.relationship('Note', backref='movie', lazy=True)

    def __repr__(self):
        return f'<Movie {self.title}>'

class Rating(db.Model):
    __tablename__ = 'ratings'
    id         = db.Column(db.Integer, primary_key=True)
    value      = db.Column(db.Float, nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    episode_id = db.Column(db.Integer, db.ForeignKey('episodes.id'), nullable=True)
    movie_id   = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=True)
    season_id  = db.Column(db.Integer, db.ForeignKey('seasons.id'), nullable=True)
    show_id    = db.Column(db.Integer, db.ForeignKey('shows.id'), nullable=True)
    timestamp  = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Rating {self.value} by User {self.user_id}>'

class Note(db.Model):
    __tablename__ = 'notes'
    id         = db.Column(db.Integer, primary_key=True, index=True)
    content    = db.Column(db.Text)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    episode_id = db.Column(db.Integer, db.ForeignKey('episodes.id'), nullable=True)
    movie_id   = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=True)
    season_id  = db.Column(db.Integer, db.ForeignKey('seasons.id'), nullable=True)
    show_id    = db.Column(db.Integer, db.ForeignKey('shows.id'), nullable=True)
    timestamp  = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Note by User {self.user_id}>'
