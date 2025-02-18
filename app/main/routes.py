from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.models import Show, Season, Episode, Movie, Rating, Note
from app import db
from sqlalchemy.orm import joinedload
from flask import jsonify
from app.models import Show, Season, Episode, Movie, Rating, Note, User
from flask import Response
from sqlalchemy.orm import joinedload




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
        # Query only unwatched movies from the database.
        movies = Movie.query.filter_by(watched=False).order_by(Movie.order).all()
        
        # For shows, fetch all and then filter seasons/episodes using a database query.
        shows_all = Show.query.options(joinedload(Show.seasons)).order_by(Show.order).all()
        filtered_shows = []
        for show in shows_all:
            new_seasons = []
            for season in show.seasons:
                # Offload filtering of unwatched episodes to the database.
                unwatched_eps = Episode.query.filter_by(season_id=season.id, watched=False)\
                                             .order_by(Episode.episode_number).all()
                if unwatched_eps:
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
        note_text = request.form.get('note')
        if content_type == 'episode':
            existing_note = Note.query.filter_by(episode_id=content.id, user_id=current_user.id).first()
        elif content_type == 'movie':
            existing_note = Note.query.filter_by(movie_id=content.id, user_id=current_user.id).first()
        elif content_type == 'season':
            existing_note = Note.query.filter_by(season_id=content.id, user_id=current_user.id).first()
        elif content_type == 'show':
            existing_note = Note.query.filter_by(show_id=content.id, user_id=current_user.id).first()
        else:
            existing_note = None
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
            if content_type == 'episode':
                existing_rating = Rating.query.filter_by(episode_id=content.id, user_id=current_user.id).first()
            elif content_type == 'movie':
                existing_rating = Rating.query.filter_by(movie_id=content.id, user_id=current_user.id).first()
            elif content_type == 'season':
                existing_rating = Rating.query.filter_by(season_id=content.id, user_id=current_user.id).first()
            elif content_type == 'show':
                existing_rating = Rating.query.filter_by(show_id=content.id, user_id=current_user.id).first()
            else:
                existing_rating = None
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

    # ---- Build aggregated reviews (notes + ratings) using a bulk user query ----
    user_ids = {r.user_id for r in content.ratings}.union({n.user_id for n in content.notes})
    users = {u.id: u for u in User.query.filter(User.id.in_(user_ids)).all()}
    reviews_dict = {}
    for rating in content.ratings:
        reviews_dict.setdefault(rating.user_id, {})['rating'] = rating.value
    for note in content.notes:
        reviews_dict.setdefault(note.user_id, {})['note'] = note.content
    all_reviews = []
    for user_id, review in reviews_dict.items():
        review['user'] = users.get(user_id)
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
        # Bulk update all episodes in the season
        Episode.query.filter_by(season_id=content_id)\
                     .update({"watched": new_status}, synchronize_session='fetch')
    elif content_type == 'show':
        # Bulk update all episodes in every season of the show
        show = Show.query.get_or_404(content_id)
        season_ids = [season.id for season in show.seasons]
        if season_ids:
            Episode.query.filter(Episode.season_id.in_(season_ids))\
                         .update({"watched": new_status}, synchronize_session='fetch')
    else:
        flash("Invalid content type for toggling watched status.", "danger")
        return redirect(url_for('main.dashboard'))
    db.session.commit()
    flash(f"{content_type.capitalize()} watched status updated.", "success")
    return redirect(url_for('main.dashboard'))


@main_bp.route('/export_notes')
@login_required
def export_notes():
    """
    Compile all notes for the current user into a single markdown file.
    The top-level header is "# Star Trek Notes: <USERNAME>".
    Movies and Shows are ordered by their 'order' value.
    For movies, a level-2 header ("##") is used.
    For shows, a level-2 header is used for the show,
    level-3 ("###") for seasons (ordered by season.number),
    and level-4 ("####") for episodes (ordered by episode_number).
    Content with no note is skipped.
    """
    user = current_user
    markdown_lines = []
    markdown_lines.append(f"# Star Trek Notes: {user.username}")
    markdown_lines.append("")

    # Get all movies and shows ordered by their 'order' value.
    movies = Movie.query.order_by(Movie.order).all()
    shows = Show.query.order_by(Show.order).all()
    combined = movies + shows
    combined.sort(key=lambda x: x.order if x.order is not None else 9999)

    for item in combined:
        if item.__class__.__name__ == 'Movie':
            user_note = None
            for note in item.notes:
                if note.user_id == user.id and note.content.strip():
                    user_note = note.content.strip()
                    break
            if user_note:
                markdown_lines.append(f"## {item.title}")
                markdown_lines.append("")
                markdown_lines.append(user_note)
                markdown_lines.append("")
        elif item.__class__.__name__ == 'Show':
            show_note = None
            for note in item.notes:
                if note.user_id == user.id and note.content.strip():
                    show_note = note.content.strip()
                    break
            # Check if any child note exists (in seasons or episodes)
            has_child_note = False
            seasons = sorted(item.seasons, key=lambda s: s.number)
            for season in seasons:
                season_has_note = any(n.user_id == user.id and n.content.strip() for n in season.notes)
                episodes = sorted(season.episodes, key=lambda ep: ep.episode_number)
                episode_has_note = any(
                    any(n.user_id == user.id and n.content.strip() for n in ep.notes)
                    for ep in episodes
                )
                if season_has_note or episode_has_note:
                    has_child_note = True
                    break
            if show_note or has_child_note:
                markdown_lines.append(f"## {item.title}")
                markdown_lines.append("")
                if show_note:
                    markdown_lines.append(show_note)
                    markdown_lines.append("")
                seasons = sorted(item.seasons, key=lambda s: s.number)
                for season in seasons:
                    season_note = None
                    for note in season.notes:
                        if note.user_id == user.id and note.content.strip():
                            season_note = note.content.strip()
                            break
                    episodes = sorted(season.episodes, key=lambda ep: ep.episode_number)
                    episode_lines = []
                    for ep in episodes:
                        ep_note = None
                        for note in ep.notes:
                            if note.user_id == user.id and note.content.strip():
                                ep_note = note.content.strip()
                                break
                        if ep_note:
                            episode_lines.append(f"#### Episode {ep.episode_number}: {ep.title}")
                            episode_lines.append("")
                            episode_lines.append(ep_note)
                            episode_lines.append("")
                    if season_note or episode_lines:
                        markdown_lines.append(f"### Season {season.number}")
                        markdown_lines.append("")
                        if season_note:
                            markdown_lines.append(season_note)
                            markdown_lines.append("")
                        markdown_lines.extend(episode_lines)
    content = "\n".join(markdown_lines)
    response = Response(content, mimetype='text/markdown')
    response.headers["Content-Disposition"] = f"attachment; filename=star_trek_notes_{user.username}.md"
    return response
