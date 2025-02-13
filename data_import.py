import re
import os
import urllib.request
from urllib.parse import urlparse
from datetime import datetime
from decimal import Decimal

from cinemagoerng import web  # Using CinemagoerNG
from app import create_app, db
from app.models import Show, Season, Episode, Movie

app = create_app()
app.app_context().push()

def download_image(url, prefix):
    """
    Download an image from the given URL and save it to app/static/images with a filename based on the prefix.
    Returns the relative path (e.g., "images/filename.jpg") or the original URL if download fails.
    """
    if not url:
        return None
    try:
        parsed_url = urlparse(url)
        _, ext = os.path.splitext(parsed_url.path)
        if not ext:
            ext = ".jpg"
        filename = f"{prefix}{ext}"
        images_folder = os.path.join(app.root_path, 'static', 'images')
        if not os.path.exists(images_folder):
            os.makedirs(images_folder)
        file_path = os.path.join(images_folder, filename)
        if os.path.exists(file_path):
            return f"images/{filename}"
        urllib.request.urlretrieve(url, file_path)
        return f"images/{filename}"
    except Exception as e:
        print(f"Error downloading image from {url}: {e}")
        return url

def parse_air_date(air_date_str):
    """
    Parse a date string (e.g. '16 Jan 1966' or '1 January 1966') into a datetime object.
    """
    if not air_date_str:
        return None
    clean_date = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', air_date_str)
    for fmt in ('%d %b %Y', '%d %B %Y'):
        try:
            return datetime.strptime(clean_date, fmt)
        except ValueError:
            continue
    return None

def fetch_show_and_episodes(imdb_id, order, max_seasons=25):
    """
    Fetch a TV series using the "reference" page from cinemagoerng,
    then for each season (from 1 to max_seasons) update the object with episode data.
    Print out the raw episodes structure for debugging,
    and save the series, seasons, and episodes into the database.
    """
    # Fetch the series using the "reference" page.
    series = web.get_title(imdb_id=imdb_id, page="reference")
    if not series:
        print(f"Could not retrieve series with IMDb ID: {imdb_id}")
        return
    title = series.title
    description = series.plot if hasattr(series, 'plot') and series.plot else ""
    if isinstance(description, dict):
        description = description.get('en-US', next(iter(description.values()), ""))
    artwork_url = series.cover_url if hasattr(series, 'cover_url') else None
    if artwork_url:
        artwork_url = download_image(artwork_url, f"series_{imdb_id}")
    series_rating = series.rating if hasattr(series, 'rating') else None
    print(f"Fetched series: {title} (Rating: {series_rating})")

    show = Show(
        title=title,
        description=description,
        order=order,
        artwork_url=artwork_url,
        imdb_rating=series_rating
    )
    try:
        db.session.add(show)
        db.session.commit()
    except Exception as e:
        print(f"Error inserting show {title}: {e}")
        db.session.rollback()
        return

    # Loop through seasons (as strings) until no episodes are returned.
    for season_number in range(1, max_seasons + 1):
        season_str = str(season_number)
        # Update the series object with episode data for the given season.
        web.update_title(series, page="episodes", keys=["episodes"], season=season_str)
        # Check if the series now has an 'episodes' attribute and the current season key exists.
        if not hasattr(series, "episodes"):
            print(f"No 'episodes' attribute found after updating season {season_str}.")
            break
        if season_str not in series.episodes or not series.episodes[season_str]:
            print(f"Season {season_str} has no episodes; assuming no more seasons available.")
            break

        episodes_for_season = series.episodes[season_str]
        print(f"Season {season_str} raw episodes data:")
        for ep_key, ep in episodes_for_season.items():
            print(f"  Episode key: {ep_key}, type: {type(ep)}, data: {ep}")

        # Create a Season record in the database.
        episode_ratings = []
        season = Season(number=season_number, show_id=show.id)
        try:
            db.session.add(season)
            db.session.commit()
        except Exception as e:
            print(f"Error inserting season {season_str} for {title}: {e}")
            db.session.rollback()
            continue

        # Process each episode.
        for ep_key, ep in episodes_for_season.items():
            # Here, ep should be a TVEpisode object (an instance of model.TVEpisode)
            try:
                ep_title = ep.title
            except AttributeError:
                ep_title = ""
            # Assume air_date is a date object already; if it's a string, try to parse it.
            air_date = getattr(ep, "release_date", None)
            if air_date and isinstance(air_date, str):
                air_date = parse_air_date(air_date)
            ep_artwork = getattr(ep, "primary_image", None)
            if ep_artwork:
                ep_artwork = download_image(ep_artwork, f"series_{imdb_id}_season_{season_number}_ep_{ep.episode}")
            ep_rating = getattr(ep, "rating", None)
            if ep_rating is not None:
                try:
                    ep_rating = float(ep_rating)
                    episode_ratings.append(ep_rating)
                except Exception as e:
                    print(f"Error converting rating for episode {ep_key}: {e}")
                    ep_rating = None

            episode = Episode(
                title=ep_title,
                episode_number=getattr(ep, "episode", None),
                season_id=season.id,
                air_date=air_date,
                artwork_url=ep_artwork,
                imdb_rating=ep_rating
            )
            try:
                db.session.add(episode)
            except Exception as e:
                print(f"Error adding episode {ep_title}: {e}")
        try:
            db.session.commit()
        except Exception as e:
            print(f"Error committing episodes for season {season_str}: {e}")
            db.session.rollback()
            continue

        if episode_ratings:
            avg_rating = sum(episode_ratings) / len(episode_ratings)
            season.imdb_rating = avg_rating
            try:
                db.session.commit()
            except Exception as e:
                print(f"Error updating season rating for season {season_str}: {e}")
                db.session.rollback()
            print(f"Season {season_str} average rating: {avg_rating}")

def fetch_movie(imdb_id, order):
    """
    Fetch a movie from IMDb using CinemagoerNG, process its fields,
    and save it into the database.
    """
    movie = web.get_title(imdb_id=imdb_id)
    if not movie:
        print(f"Could not retrieve movie with IMDb ID: {imdb_id}")
        return
    title = movie.title
    description = movie.plot if hasattr(movie, 'plot') and movie.plot else ""
    if isinstance(description, dict):
        description = description.get('en-US', next(iter(description.values()), ""))
    release_year = movie.year if hasattr(movie, 'year') else None
    artwork_url = movie.cover_url if hasattr(movie, 'cover_url') else None
    if artwork_url:
        artwork_url = download_image(artwork_url, f"movie_{imdb_id}")
    movie_rating = movie.rating if hasattr(movie, 'rating') else None
    release_date = datetime(release_year, 1, 1) if release_year else None
    print(f"Fetched movie: {title} (Rating: {movie_rating})")

    mov = Movie(
        title=title,
        release_date=release_date,
        description=description,
        order=order,
        artwork_url=artwork_url,
        imdb_rating=movie_rating,
        watched=False
    )
    try:
        db.session.add(mov)
        db.session.commit()
    except Exception as e:
        print(f"Error inserting movie {title}: {e}")
        db.session.rollback()

def import_star_trek_data():
    """
    Import Star Trek TV series and movies into the database using CinemagoerNG.
    Ensure your database is set up and migrations applied before running this script.
    """
    tv_series = {
        "Star Trek: The Original Series": {"imdb_id": "tt0060028", "order": 1},
        "Star Trek: The Animated Series": {"imdb_id": "tt0069637", "order": 2},
        "Star Trek: The Next Generation": {"imdb_id": "tt0092455", "order": 9},
        "Star Trek: Deep Space Nine": {"imdb_id": "tt0106145", "order": 11},
        "Star Trek: Voyager": {"imdb_id": "tt0112178", "order": 12},
        "Star Trek: Enterprise": {"imdb_id": "tt0244365", "order": 16},
        "Star Trek: Discovery": {"imdb_id": "tt5171438", "order": 20},
        "Star Trek: Short Treks": {"imdb_id": "tt9059594", "order": 21},
        "Star Trek: Picard": {"imdb_id": "tt8806524", "order": 22},
        "Star Trek: Lower Decks": {"imdb_id": "tt9184820", "order": 23},
        "Star Trek: Prodigy": {"imdb_id": "tt9795876", "order": 24},
        "Star Trek: Strange New Worlds": {"imdb_id": "tt12327578", "order": 25},
    }
    
    for series_name, info in tv_series.items():
        print(f"Importing TV series: {series_name}")
        try:
            fetch_show_and_episodes(info["imdb_id"], info["order"])
        except Exception as e:
            print(f"Error importing {series_name}: {e}")
    
    movies = {
        "Star Trek: The Motion Picture": {"imdb_id": "tt0079945", "order": 3},
        "Star Trek II: The Wrath of Khan": {"imdb_id": "tt0084726", "order": 4},
        "Star Trek III: The Search for Spock": {"imdb_id": "tt0088170", "order": 5},
        "Star Trek IV: The Voyage Home": {"imdb_id": "tt0092007", "order": 6},
        "Star Trek V: The Final Frontier": {"imdb_id": "tt0098382", "order": 7},
        "Star Trek VI: The Undiscovered Country": {"imdb_id": "tt0102975", "order": 8},
        "Star Trek: Generations": {"imdb_id": "tt0111280", "order": 10},
        "Star Trek: First Contact": {"imdb_id": "tt0117731", "order": 13},
        "Star Trek: Insurrection": {"imdb_id": "tt0120844", "order": 14},
        "Star Trek: Nemesis": {"imdb_id": "tt0253754", "order": 15},
        "Star Trek (2009)": {"imdb_id": "tt0796366", "order": 17},
        "Star Trek Into Darkness": {"imdb_id": "tt1408101", "order": 18},
        "Star Trek Beyond": {"imdb_id": "tt2660888", "order": 19},
        "Star Trek: Section 31": {"imdb_id": "tt9603060", "order": 26},
    }
    
    for movie_title, info in movies.items():
        print(f"Importing movie: {movie_title}")
        try:
            fetch_movie(info["imdb_id"], info["order"])
        except Exception as e:
            print(f"Error importing movie {movie_title}: {e}")
    
    print("Star Trek data import complete.")

if __name__ == '__main__':
    import_star_trek_data()
