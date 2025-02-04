from flask import Blueprint, render_template, redirect, url_for, flash, request
from app import db
from app.models import User
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from app.auth.forms import RegistrationForm, LoginForm

auth_bp = Blueprint('auth', __name__, template_folder='templates')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    form = RegistrationForm()
    if form.validate_on_submit():
        # Check if user already exists
        existing_user = User.query.filter(
            (User.username == form.username.data) | (User.email == form.email.data)
        ).first()
        if existing_user:
            flash('Username or email already exists', 'danger')
            return redirect(url_for('auth.register'))
        # If this is the very first user, make admin and auto-approved.
        if User.query.count() == 0:
            is_admin    = True
            is_approved = True
        else:
            is_admin    = False
            is_approved = False  # Require admin approval
        new_user = User(
            username    = form.username.data,
            email       = form.email.data,
            password    = generate_password_hash(form.password.data),
            is_admin    = is_admin,
            is_approved = is_approved
        )
        db.session.add(new_user)
        db.session.commit()
        if is_admin:
            flash('Registration successful! You have been set as admin.', 'success')
        else:
            flash('Registration successful! Await admin approval to log in.', 'success')
        return redirect(url_for('auth.login'))
    return render_template('register.html', form=form)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and check_password_hash(user.password, form.password.data):
            if not user.is_approved:
                flash('Your account is pending admin approval.', 'warning')
                return redirect(url_for('auth.login'))
            login_user(user, remember=form.remember.data)
            flash('Logged in successfully!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('main.dashboard'))
        else:
            flash('Invalid username or password.', 'danger')
    return render_template('login.html', form=form)

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))
