from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.models import Show, Season, Episode, Movie, Rating, Note
from app import db
from sqlalchemy.orm import joinedload
from flask import jsonify
from app.models import Show, Season, Episode, Movie, Rating, Note, User


main_bp = Blueprint('main', __name__, template_folder='templates')

@main_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return render_template('index.html')

@main_bp.route('/dashboard')
@login_required
def dashboard():
    filter_option = request.args.get('filter', 'all')
    # Eager load seasons and episodes in one query to avoid N+1 queries
    shows = Show.query.options(
        joinedload(Show.seasons).joinedload(Season.episodes)
    ).order_by(Show.order).all()
    movies = Movie.query.order_by(Movie.order).all()

    if filter_option == 'unwatched':
        # For movies: keep only unwatched movies
        movies = [movie for movie in movies if not movie.watched]

        # For each show, filter seasons and episodes
        filtered_shows = []
        for show in shows:
            new_seasons = []
            for season in show.seasons:
                unwatched_eps = [ep for ep in season.episodes if not ep.watched]
                if unwatched_eps:
                    # Temporarily attach the filtered episodes list
                    season.filtered_episodes = unwatched_eps
                    new_seasons.append(season)
            if new_seasons:
                show.filtered_seasons = new_seasons
                filtered_shows.append(show)
        shows = filtered_shows

    combined = shows + movies
    combined.sort(key=lambda x: x.order if x.order is not None else 9999)
    return render_template('dashboard.html', combined=combined, filter_option=filter_option)


@main_bp.route('/content/<string:content_type>/<int:content_id>', methods=['GET', 'POST'])
@login_required
def content_detail(content_type, content_id):
    if content_type == 'episode':
        content = Episode.query.get_or_404(content_id)
    elif content_type == 'movie':
        content = Movie.query.get_or_404(content_id)
    elif content_type == 'show':
        content = Show.query.get_or_404(content_id)
    elif content_type == 'season':
        content = Season.query.get_or_404(content_id)
    else:
        flash('Invalid content type', 'danger')
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        # Process note for current user
        note_text = request.form.get('note')
        existing_note = None
        for note in content.notes:
            if note.user_id == current_user.id:
                existing_note = note
                break
        if existing_note:
            existing_note.content = note_text
        else:
            new_note = Note(content=note_text, user_id=current_user.id)
            if content_type == 'episode':
                new_note.episode_id = content.id
            elif content_type == 'movie':
                new_note.movie_id = content.id
            elif content_type == 'season':
                new_note.season_id = content.id
            elif content_type == 'show':
                new_note.show_id = content.id
            db.session.add(new_note)

        # Process rating for current user
        rating_value = request.form.get('rating')
        if rating_value:
            try:
                rating_value = float(rating_value)
                if not (0 <= rating_value <= 10):
                    raise ValueError("Rating must be between 0 and 10.")
            except ValueError as e:
                flash(str(e), 'danger')
                return redirect(url_for('main.content_detail', content_type=content_type, content_id=content_id))
            existing_rating = None
            for r in content.ratings:
                if r.user_id == current_user.id:
                    existing_rating = r
                    break
            if existing_rating:
                existing_rating.value = rating_value
            else:
                new_rating = Rating(value=rating_value, user_id=current_user.id)
                if content_type == 'episode':
                    new_rating.episode_id = content.id
                elif content_type == 'movie':
                    new_rating.movie_id = content.id
                elif content_type == 'season':
                    new_rating.season_id = content.id
                elif content_type == 'show':
                    new_rating.show_id = content.id
                db.session.add(new_rating)
        db.session.commit()
        flash('Your note and rating have been saved.', 'success')
        return redirect(url_for('main.content_detail', content_type=content_type, content_id=content_id))

    # ---- Build aggregated reviews (notes + ratings) ----
    # Create a dictionary keyed by user_id
    reviews_dict = {}
    for rating in content.ratings:
        reviews_dict.setdefault(rating.user_id, {})['rating'] = rating.value
    for note in content.notes:
        reviews_dict.setdefault(note.user_id, {})['note'] = note.content
    all_reviews = []
    for user_id, review in reviews_dict.items():
        # Pull the user object via relationship (note that Note and Rating have backrefs to user)
        user = User.query.get(user_id)
        review['user'] = user
        all_reviews.append(review)
    # Compute aggregated average rating (if any)
    if content.ratings:
        avg_rating = sum(r.value for r in content.ratings) / len(content.ratings)
    else:
        avg_rating = None
    # Pass aggregated reviews and average rating to the template
    return render_template('content_detail.html',
                           content=content,
                           content_type=content_type,
                           reviews=all_reviews,
                           avg_rating=avg_rating)



@main_bp.route('/toggle_watched/<string:content_type>/<int:content_id>', methods=['POST'])
@login_required
def toggle_watched(content_type, content_id):
    # Read the "watched" parameter and convert to boolean
    new_status = request.form.get('watched', 'false').lower() == 'true'
    if content_type == 'movie':
        item = Movie.query.get_or_404(content_id)
        item.watched = new_status
    elif content_type == 'episode':
        item = Episode.query.get_or_404(content_id)
        item.watched = new_status
    elif content_type == 'season':
        item = Season.query.get_or_404(content_id)
        for episode in item.episodes:
            episode.watched = new_status
    elif content_type == 'show':
        item = Show.query.options(
            joinedload(Show.seasons).joinedload(Season.episodes)
        ).get_or_404(content_id)
        for season in item.seasons:
            for episode in season.episodes:
                episode.watched = new_status
    else:
        flash("Invalid content type for toggling watched status.", "danger")
        return redirect(url_for('main.dashboard'))
    db.session.commit()
    flash(f"{content_type.capitalize()} watched status updated.", "success")
    return redirect(url_for('main.dashboard'))



