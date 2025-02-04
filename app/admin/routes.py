from flask import Blueprint, render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import User
from app import db

admin_bp = Blueprint('admin', __name__, url_prefix='/admin', template_folder='templates')

@admin_bp.route('/')
@login_required
def admin_panel():
    if not current_user.is_admin:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.dashboard'))
    pending_users = User.query.filter_by(is_approved=False).all()
    return render_template('admin.html', pending_users=pending_users)

@admin_bp.route('/approve/<int:user_id>')
@login_required
def approve_user(user_id):
    if not current_user.is_admin:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.dashboard'))
    user = User.query.get_or_404(user_id)
    user.is_approved = True
    db.session.commit()
    flash(f'User {user.username} approved.', 'success')
    return redirect(url_for('admin.admin_panel'))
