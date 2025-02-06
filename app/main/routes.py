from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.models import Show, Season, Episode, Movie, Rating, Note
from app import db

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
    shows = Show.query.order_by(Show.order).all()
    movies = Movie.query.order_by(Movie.order).all()
    combined = shows + movies
    # Sort by the 'order' field (if missing, use a high default)
    combined.sort(key=lambda x: x.order if x.order is not None else 9999)
    
    if filter_option == 'unwatched':
        filtered = []
        for item in combined:
            if item.__class__.__name__ == 'Movie' and not item.watched:
                filtered.append(item)
            elif item.__class__.__name__ == 'Show' and not item.watched:
                filtered.append(item)
        combined = filtered
        
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
        db.session.commit()
        flash('Your note has been saved.', 'success')
        return redirect(url_for('main.content_detail', content_type=content_type, content_id=content_id))
    return render_template('content_detail.html', content=content, content_type=content_type)

@main_bp.route('/toggle_watched/<string:content_type>/<int:content_id>', methods=['POST'])
@login_required
def toggle_watched(content_type, content_id):
    if content_type == 'movie':
        item = Movie.query.get_or_404(content_id)
        item.watched = not item.watched
    elif content_type == 'episode':
        item = Episode.query.get_or_404(content_id)
        item.watched = not item.watched
    elif content_type == 'season':
        item = Season.query.get_or_404(content_id)
        new_status = not item.watched
        for episode in item.episodes:
            episode.watched = new_status
    elif content_type == 'show':
        item = Show.query.get_or_404(content_id)
        new_status = not item.watched
        for season in item.seasons:
            for episode in season.episodes:
                episode.watched = new_status
    else:
        flash("Invalid content type for toggling watched status.", "danger")
        return redirect(url_for('main.dashboard'))
    db.session.commit()
    flash(f"{content_type.capitalize()} watched status updated.", "success")
    return redirect(url_for('main.dashboard'))
