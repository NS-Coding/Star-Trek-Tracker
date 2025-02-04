import re
from datetime import datetime
from imdb import IMDb
from app import create_app, db
from app.models import Show, Season, Episode, Movie

app = create_app()
app.app_context().push()

def parse_air_date(air_date_str):
    """
    Attempt to parse IMDb's 'original air date' string.
    IMDb may return strings like "16 Jan. 1966" or "1 January 1966".
    We'll remove ordinal suffixes if needed and try a few formats.
    """
    if not air_date_str:
        return None
    # Remove ordinal suffixes (st, nd, rd, th)
    clean_date = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', air_date_str)
    for fmt in ('%d %b %Y', '%d %B %Y'):
        try:
            return datetime.strptime(clean_date, fmt)
        except ValueError:
            continue
    return None

def fetch_show_and_episodes(imdb_id, order):
    """Fetch a TV series and its episodes from IMDb and save to the database."""
    ia = IMDb()
    # Get the TV series details
    series = ia.get_movie(imdb_id)
    title = series.get('title')
    # Use plot outline if available, otherwise a short version of the full plot
    description = series.get('plot outline') or (series.get('plot')[0] if series.get('plot') else '')
    artwork_url = series.get('cover url')  # This should be the poster image
    print(f"Fetched series: {title}")

    # Create the Show record in the database.
    show = Show(
        title=title,
        description=description,
        order=order,
        artwork_url=artwork_url
    )
    db.session.add(show)
    db.session.commit()

    # Fetch the episodes data. This returns a dict keyed by season numbers.
    episodes_dict = ia.get_movie_episodes(imdb_id)
    if not episodes_dict:
        print(f"No episodes found for series: {title}")
        return

    for season_number, episodes in episodes_dict.items():
        try:
            season_num_int = int(season_number)
        except ValueError:
            continue  # Skip if season number is not a valid integer

        season = Season(number=season_num_int, show_id=show.id)
        db.session.add(season)
        db.session.commit()
        print(f"  Added Season {season_num_int} for {title}")

        for ep_number, ep in episodes.items():
            ep_title = ep.get('title')
            air_date_str = ep.get('original air date')
            air_date = parse_air_date(air_date_str)
            ep_artwork = ep.get('cover url')
            episode = Episode(
                title=ep_title,
                episode_number=ep_number,
                season_id=season.id,
                air_date=air_date,
                artwork_url=ep_artwork
            )
            db.session.add(episode)
        db.session.commit()
        print(f"    Added {len(episodes)} episodes for Season {season_num_int}")

def fetch_movie(imdb_id, order):
    """Fetch a movie from IMDb and save to the database."""
    ia = IMDb()
    movie = ia.get_movie(imdb_id)
    title = movie.get('title')
    description = movie.get('plot outline') or (movie.get('plot')[0] if movie.get('plot') else '')
    release_year = movie.get('year')
    artwork_url = movie.get('cover url')
    # Since IMDb may not supply the full release date, we use January 1st of the release year.
    release_date = datetime(release_year, 1, 1) if release_year else None
    print(f"Fetched movie: {title}")

    mov = Movie(
        title=title,
        release_date=release_date,
        description=description,
        order=order,
        artwork_url=artwork_url
    )
    db.session.add(mov)
    db.session.commit()

def import_star_trek_data():
    ia = IMDb()  # This instance is optional; each helper creates its own if needed.
    
    # Dictionary mapping TV series names to their IMDb IDs and checklist order.
    tv_series = {
        "Star Trek: The Original Series": {"imdb_id": "tt0060028", "order": 1},
        "Star Trek: The Animated Series": {"imdb_id": "tt0059604", "order": 2},
        "Star Trek: The Next Generation": {"imdb_id": "tt0092455", "order": 4},
        # Additional series (e.g., DS9, Voyager, Enterprise, etc.) can be added here.
    }
    
    for series_name, info in tv_series.items():
        print(f"Importing TV series: {series_name}")
        try:
            fetch_show_and_episodes(info["imdb_id"], info["order"])
        except Exception as e:
            print(f"Error importing {series_name}: {e}")
    
    # Dictionary mapping movie titles to their IMDb IDs and checklist order.
    movies = {
        "Star Trek: The Motion Picture": {"imdb_id": "tt0079261", "order": 3},
        "Star Trek II: The Wrath of Khan": {"imdb_id": "tt0088634", "order": 3},
        "Star Trek III: The Search for Spock": {"imdb_id": "tt0089941", "order": 3},
        "Star Trek IV: The Voyage Home": {"imdb_id": "tt0092005", "order": 3},
        "Star Trek V: The Final Frontier": {"imdb_id": "tt0111282", "order": 3},
        "Star Trek VI: The Undiscovered Country": {"imdb_id": "tt0116282", "order": 3},
        "Star Trek: Generations": {"imdb_id": "tt0111283", "order": 5},  # Note: Verify the IMDb id.
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
