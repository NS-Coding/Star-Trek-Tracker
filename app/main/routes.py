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
    # Get shows and movies ordered by their 'order' field
    shows  = Show.query.order_by(Show.order).all()
    movies = Movie.query.order_by(Movie.order).all()
    return render_template('dashboard.html', shows=shows, movies=movies)

@main_bp.route('/content/<string:content_type>/<int:content_id>', methods=['GET', 'POST'])
@login_required
def content_detail(content_type, content_id):
    # Determine if we’re showing an episode or a movie
    if content_type == 'episode':
        content = Episode.query.get_or_404(content_id)
    elif content_type == 'movie':
        content = Movie.query.get_or_404(content_id)
    else:
        flash('Invalid content type', 'danger')
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        # Handle note submission (simplified example)
        note_text = request.form.get('note')
        # Check if the user already has a note for this content
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
            else:
                new_note.movie_id = content.id
            db.session.add(new_note)
        db.session.commit()
        flash('Your note has been saved.', 'success')
        return redirect(url_for('main.content_detail', content_type=content_type, content_id=content_id))
    return render_template('content_detail.html', content=content, content_type=content_type)
