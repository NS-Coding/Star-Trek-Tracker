import re
from datetime import datetime
from imdb import Cinemagoer
from app import create_app, db
from app.models import Show, Season, Episode, Movie

app = create_app()
app.app_context().push()

def parse_air_date(air_date_str):
    """
    Parse IMDb's 'original air date' strings.
    IMDb may return strings like "16 Jan. 1966" or "1 January 1966".
    This function cleans ordinal suffixes and tries common formats.
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

def fetch_show_and_episodes(imdb_id, order):
    """Fetch a TV series (and its episodes) from IMDb and save to the database, including ratings."""
    ia = Cinemagoer()
    series = ia.get_movie(imdb_id)
    title = series.get('title')
    description = series.get('plot outline') or (series.get('plot')[0] if series.get('plot') else '')
    artwork_url = series.get('cover url')  # Poster image URL
    series_rating = series.get('rating')    # Overall series rating (e.g., 8.5)
    print(f"Fetched series: {title} (Rating: {series_rating})")

    show = Show(
        title=title,
        description=description,
        order=order,
        artwork_url=artwork_url,
        imdb_rating=series_rating
    )
    db.session.add(show)
    db.session.commit()

    print("I am here")
    print("Series Info: ", series.data)
    ia.update(series, 'episodes')
    print("Got here!")
    print("Series Info Episodes: ", series.data)
    episodes_dict = series.data.get('episodes')
    print("Hope im here")
    if not episodes_dict:
        print(f"No episodes found for series: {title}")
        episodes_dict = ia.get_movie_episodes(imdb_id)
        if not episodes_dict:
            print("Still nothing...")
        else:
            print("episodes_dict: ", episodes_dict)
        return
    else:
        print("List of Episodes: ", episodes_dict)

    # Iterate over seasons.
    for season_number, episodes in episodes_dict.items():
        print(f"On current Season number: {season_number}")
        try:
            season_num_int = int(season_number)
        except ValueError:
            continue  # Skip non-numeric season identifiers

        # Prepare to compute the average rating for this season.
        episode_ratings = []
        season = Season(number=season_num_int, show_id=show.id)
        db.session.add(season)
        db.session.commit()
        print(f"  Added Season {season_num_int} for {title}")

        # Iterate over episodes within the season.
        for ep_number, ep in episodes.items():
            ep_title = ep.get('title')
            air_date_str = ep.get('original air date')
            air_date = parse_air_date(air_date_str)
            ep_artwork = ep.get('cover url')
            ep_rating = ep.get('rating')  # Retrieve episode rating, if available.
            if ep_rating is not None:
                try:
                    ep_rating = float(ep_rating)
                    episode_ratings.append(ep_rating)
                except Exception:
                    ep_rating = None

            episode = Episode(
                title=ep_title,
                episode_number=ep_number,
                season_id=season.id,
                air_date=air_date,
                artwork_url=ep_artwork,
                imdb_rating=ep_rating
            )
            db.session.add(episode)
        db.session.commit()

        # Calculate and store the average season rating (if any episode ratings were found).
        if episode_ratings:
            avg_rating = sum(episode_ratings) / len(episode_ratings)
            season.imdb_rating = avg_rating
            db.session.commit()
            print(f"    Season {season_num_int} average rating: {avg_rating}")

def fetch_movie(imdb_id, order):
    """Fetch a movie from IMDb and save to the database, including its rating."""
    ia = Cinemagoer()
    movie = ia.get_movie(imdb_id)
    title = movie.get('title')
    description = movie.get('plot outline') or (movie.get('plot')[0] if movie.get('plot') else '')
    release_year = movie.get('year')
    artwork_url = movie.get('cover url')
    movie_rating = movie.get('rating')
    release_date = datetime(release_year, 1, 1) if release_year else None
    print(f"Fetched movie: {title} (Rating: {movie_rating})")

    mov = Movie(
        title=title,
        release_date=release_date,
        description=description,
        order=order,
        artwork_url=artwork_url,
        imdb_rating=movie_rating
    )
    db.session.add(mov)
    db.session.commit()

def import_star_trek_data():
    # Configuration dictionaries for TV series and movies.
    # To add new content, add an entry with the title’s IMDb ID and desired checklist order.
    tv_series = {
        "Star Trek: The Original Series": {"imdb_id": "0060028", "order": 1},
        "Star Trek: The Animated Series": {"imdb_id": "0069637", "order": 2},
        "Star Trek: The Next Generation": {"imdb_id": "0092455", "order": 9},
        "Star Trek: Deep Space Nine": {"imdb_id": "0106145", "order": 11},
        "Star Trek: Voyager": {"imdb_id": "0112178", "order": 12},
        "Star Trek: Enterprise": {"imdb_id": "0244365", "order": 16},
        "Star Trek: Discovery": {"imdb_id": "5171438", "order": 20},
        "Star Trek: Short Treks": {"imdb_id": "9059594", "order": 21},
        "Star Trek: Picard": {"imdb_id": "8806524", "order": 22},
        "Star Trek: Lower Decks": {"imdb_id": "9184820", "order": 23},
        "Star Trek: Prodigy": {"imdb_id": "9795876", "order": 24},
        "Star Trek: Strange New Worlds": {"imdb_id": "12327578", "order": 25},
        # Additional series can be added here.
        # For example: "Star Trek: Deep Space Nine": {"imdb_id": "tt0106145", "order": 6},
    }
    
    for series_name, info in tv_series.items():
        print(f"Importing TV series: {series_name}")
        try:
            fetch_show_and_episodes(info["imdb_id"], info["order"])
        except Exception as e:
            print(f"Error importing {series_name}: {e}")
    
    movies = {
        "Star Trek: The Motion Picture": {"imdb_id": "0079945", "order": 3},
        "Star Trek II: The Wrath of Khan": {"imdb_id": "0084726", "order": 4},
        "Star Trek III: The Search for Spock": {"imdb_id": "0088170", "order": 5},
        "Star Trek IV: The Voyage Home": {"imdb_id": "0092007", "order": 6},
        "Star Trek V: The Final Frontier": {"imdb_id": "0098382", "order": 7},
        "Star Trek VI: The Undiscovered Country": {"imdb_id": "0102975", "order": 8},
        "Star Trek: Generations": {"imdb_id": "0111280", "order": 10},
        "Star Trek: First Contact": {"imdb_id": "0117731", "order": 13},
        "Star Trek: Insurrection": {"imdb_id": "0120844", "order": 14},
        "Star Trek: Nemesis": {"imdb_id": "0253754", "order": 15},
        "Star Trek (2009)": {"imdb_id": "0796366", "order": 17},
        "Star Trek Into Darkness": {"imdb_id": "1408101", "order": 18},
        "Star Trek Beyond": {"imdb_id": "2660888", "order": 19},
        "Star Trek: Section 31": {"imdb_id": "9603060", "order": 26},
        # Additional movies can be added here.
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
