// Import IMDb data using CinemagoerNG and load into Postgres via node-postgres (pg)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const { Pool } = require('pg');

// Load environment variables from .env file
require('dotenv').config();

// Initialize pg Pool
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString: databaseUrl });

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// Ensure database schema exists (id as UUIDs)
async function ensureSchema() {
  // Enable uuid extension
  await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // Shows
  await query(`
    CREATE TABLE IF NOT EXISTS shows (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT UNIQUE NOT NULL,
      description TEXT,
      "order" INTEGER,
      artwork_url TEXT,
      imdb_rating REAL,
      runtime INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Seasons
  await query(`
    CREATE TABLE IF NOT EXISTS seasons (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      number INTEGER NOT NULL,
      show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      imdb_rating REAL,
      artwork_url TEXT,
      runtime INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (show_id, number)
    );
  `);

  // Episodes
  await query(`
    CREATE TABLE IF NOT EXISTS episodes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      episode_number INTEGER NOT NULL,
      season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      air_date TIMESTAMPTZ,
      artwork_url TEXT,
      imdb_rating REAL,
      description TEXT,
      runtime INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (season_id, episode_number)
    );
  `);

  // Movies
  await query(`
    CREATE TABLE IF NOT EXISTS movies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT UNIQUE NOT NULL,
      release_date TIMESTAMPTZ,
      description TEXT,
      "order" INTEGER,
      artwork_url TEXT,
      imdb_rating REAL,
      runtime INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Users (kept minimal for auth code refactor later)
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      is_approved BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Ratings
  await query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      value REAL NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
      movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
      season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
      show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, episode_id),
      UNIQUE (user_id, movie_id),
      UNIQUE (user_id, season_id),
      UNIQUE (user_id, show_id)
    );
  `);

  // Notes
  await query(`
    CREATE TABLE IF NOT EXISTS notes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      content TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
      movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
      season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
      show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Watch progress (global, not per-user to match prior schema)
  await query(`
    CREATE TABLE IF NOT EXISTS watch_progress (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      watched BOOLEAN NOT NULL DEFAULT false,
      episode_id UUID UNIQUE REFERENCES episodes(id) ON DELETE CASCADE,
      movie_id UUID UNIQUE REFERENCES movies(id) ON DELETE CASCADE,
      season_id UUID UNIQUE REFERENCES seasons(id) ON DELETE CASCADE,
      show_id UUID UNIQUE REFERENCES shows(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Install CinemagoerNG if needed
try {
  execSync('pip show cinemagoerng', { stdio: 'ignore' });
  console.log('CinemagoerNG is already installed.');
} catch (error) {
  console.log('Installing CinemagoerNG...');
  execSync('pip install --upgrade git+https://github.com/cinemagoer/cinemagoerng.git');
}

// Create a Python script file for IMDb operations
const createPythonScript = () => {
  const pythonScriptPath = path.join(__dirname, 'imdb_fetch.py');
  const pythonScript = `
import re
import os
import json
import urllib.request
from urllib.parse import urlparse
from datetime import datetime
from decimal import Decimal

from cinemagoerng import web  # Using CinemagoerNG

# Debugging control
DEBUG = True
def dbg(msg):
    if DEBUG:
        try:
            print(msg)
        except Exception:
            try:
                print(str(msg))
            except Exception:
                pass

def dump_attrs(obj, label, show_values=False):
    try:
        names = sorted([n for n in dir(obj) if not n.startswith('_')])
        print(f"[{label}] attrs=\\n  " + "\\n  ".join(names))
        # Print runtime-like field values if present
        keys = [k for k in names if any(x in k for x in ("runtime", "running_time", "duration", "length"))]
        vals = {}
        for k in keys:
            try:
                vals[k] = getattr(obj, k)
            except Exception:
                vals[k] = "<error>"
        if vals:
            print(f"[{label}] runtime-like values={vals}")
        if show_values:
            # Dangerous/noisy: print a shallow dict of simple fields
            shallow = {}
            for n in names:
                try:
                    v = getattr(obj, n)
                    if isinstance(v, (str, int, float, bool)) or v is None:
                        shallow[n] = v
                except Exception:
                    pass
            if shallow:
                try:
                    print(f"[{label}] shallow={json.dumps(shallow)[:800]}")
                except Exception:
                    print(f"[{label}] shallow=<unserializable>")
    except Exception as e:
        print(f"[{label}] <failed to dump attrs>: {e}")

def download_image(url, prefix):
    """
    Download an image from the given URL and save it to public/images with a filename based on the prefix.
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
        
        # Adjust path for Next.js public directory
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        images_folder = os.path.join(project_root, 'public', 'images')
        
        if not os.path.exists(images_folder):
            os.makedirs(images_folder)
        
        file_path = os.path.join(images_folder, filename)
        if os.path.exists(file_path):
            return f"/images/{filename}"  # Return URL path for web access
            
        urllib.request.urlretrieve(url, file_path)
        return f"/images/{filename}"  # Return URL path for web access
    except Exception as e:
        print(f"Error downloading image from {url}: {e}")
        return url

def parse_air_date(air_date_str):
    """
    Parse a date string (e.g. '16 Jan 1966' or '1 January 1966') into a datetime object.
    """
    if not air_date_str:
        return None
    clean_date = re.sub(r'(\\d+)(st|nd|rd|th)', r'\\1', air_date_str)
    for fmt in ('%d %b %Y', '%d %B %Y'):
        try:
            return datetime.strptime(clean_date, fmt).isoformat()
        except ValueError:
            continue
    return None

def normalize_runtime(value):
    """Best-effort to convert runtime field to minutes (int). Accepts int, float, str, list."""
    if value is None:
        return None
    try:
        # If it's a list like [50] or ['50'] take first
        if isinstance(value, (list, tuple)) and len(value) > 0:
            value = value[0]
        # Strings like '50', '50 min', '50mins'
        if isinstance(value, str):
            m = re.search(r"(\\d+)", value)
            if m:
                return int(m.group(1))
            return None
        # Numeric
        if isinstance(value, (int, float, Decimal)):
            return int(value)
    except Exception:
        return None
    return None

def fetch_show_and_episodes(imdb_id, order, max_seasons=25):
    """
    Fetch a TV series, then for each season update with episode data.
    Returns a JSON structure with all data.
    """
    result = {"show": None, "seasons": []}
    try:
        # Fetch series metadata (try reference, then fallback to main)
        meta = None
        try:
            dbg(f"[META] fetching reference page for {imdb_id}")
            meta = web.get_title(imdb_id=imdb_id, page="reference")
            dbg(f"[META] reference fetched type={type(meta)} title={getattr(meta,'title',None)} has_imdb_id={hasattr(meta,'imdb_id')}")
        except Exception as e:
            print(f"Error fetching reference page for {imdb_id}: {e}. Falling back to main page...")
            try:
                dbg(f"[META] fetching main page for {imdb_id}")
                meta = web.get_title(imdb_id=imdb_id, page="main")
                dbg(f"[META] main fetched type={type(meta)} title={getattr(meta,'title',None)} has_imdb_id={hasattr(meta,'imdb_id')}")
            except Exception as e2:
                print(f"Error fetching main page for {imdb_id}: {e2}")
                return result

        if not meta:
            print(f"Could not retrieve series with IMDb ID: {imdb_id}")
            return result

        # Title normalization
        original_title = getattr(meta, 'title', '')
        if order == 1:
            title = "Star Trek: The Original Series"
        elif order == 2:
            title = "Star Trek: The Animated Series"
        else:
            title = original_title

        # Show description
        description = getattr(meta, 'plot', '') or ""
        if isinstance(description, dict):
            description = description.get('en-US', next(iter(description.values()), ""))
        if order == 1 and not description:
            description = "In the 23rd Century, Captain James T. Kirk and the crew of the U.S.S. Enterprise explore the galaxy and defend the United Federation of Planets in this groundbreaking original series that started it all."
        elif order == 2 and not description:
            description = "The further adventures of Captain James T. Kirk and the crew of the USS Enterprise, as they explore the galaxy and defend the United Federation of Planets in this animated series that continues the five-year mission."

        artwork_url = getattr(meta, 'primary_image', None)
        if artwork_url:
            artwork_url = download_image(artwork_url, f"series_{imdb_id}")
        series_rating = getattr(meta, 'rating', None)

        result['show'] = {
            'title': title,
            'description': description,
            'order': order,
            'artworkUrl': artwork_url,
            'imdbRating': float(series_rating) if series_rating else None,
        }
        # Note: verbose attribute dumps removed for performance

        # Seasons and episodes
        for season_number in range(1, max_seasons + 1):
            season_str = str(season_number)
            dbg(f"[SEASON] fetching episodes page imdb_id={imdb_id} season={season_str}")
            series = web.get_title(imdb_id=imdb_id, page="episodes", season=season_str)
            dbg(f"[SEASON] fetched type={type(series)} has_attr_episodes={hasattr(series,'episodes')}")
            if not hasattr(series, 'episodes') or season_str not in series.episodes or not series.episodes[season_str]:
                print(f"[SEASON] {title} S{season_number:02}: no episodes found; stopping.")
                break

            episodes_for_season = series.episodes[season_str]
            try:
                dbg(f"[SEASON] {title} S{season_number:02}: episodes_count={len(episodes_for_season)} keys_sample={(list(episodes_for_season.keys())[:3])}")
            except Exception:
                pass
            # Minimal logging only
            # print(f"[SEASON] {title} S{season_number:02}: episode_count={len(episodes_for_season)}")
            # Determine default per-episode runtime from series meta if available
            default_ep_runtime = None
            try:
                default_ep_runtime = normalize_runtime(getattr(meta, 'runtime', None))
                dbg(f"[SEASON] default_ep_runtime={default_ep_runtime}")
            except Exception:
                default_ep_runtime = None
            season_data = {'number': season_number, 'imdbRating': None, 'episodes': [], 'runtime': None}
            episode_ratings = []
            season_total_runtime = 0
            season_has_runtime = False

            for ep_key, ep in episodes_for_season.items():
                ep_title = getattr(ep, 'title', '')
                air_date = getattr(ep, 'release_date', None)
                if air_date is not None and not isinstance(air_date, str):
                    air_date = air_date.isoformat()
                ep_artwork = getattr(ep, 'primary_image', None)
                if ep_artwork:
                    ep_artwork = download_image(ep_artwork, f"series_{imdb_id}_season_{season_number}_ep_{getattr(ep, 'episode', '')}")
                ep_rating = getattr(ep, 'rating', None)
                if ep_rating is not None:
                    try:
                        ep_rating = float(ep_rating)
                        episode_ratings.append(ep_rating)
                    except Exception as conv_err:
                        print(f"Error converting rating for episode {ep_key}: {conv_err}")
                        ep_rating = None

                ep_description = getattr(ep, 'plot', '')
                if isinstance(ep_description, dict):
                    ep_description = ep_description.get('en-US', next(iter(ep_description.values()), ''))

                # Episode runtime (attempt multiple attribute names)
                ep_runtime = None
                for attr in ('running_time', 'runtime', 'runtimes', 'runtime_minutes', 'duration'):
                    if hasattr(ep, attr):
                        ep_runtime = normalize_runtime(getattr(ep, attr))
                        if ep_runtime:
                            break
                # If not found, try fetching episode details page (silent on errors)
                if ep_runtime is None and hasattr(ep, 'imdb_id') and getattr(ep, 'imdb_id'):
                    try:
                        ep_full_id = getattr(ep, 'imdb_id')
                        dbg(f"[EP] fetch details imdb_id={ep_full_id} for S{season_number:02}E{getattr(ep,'episode', '')}")
                        ep_full = web.get_title(imdb_id=ep_full_id)
                        for attr in ('running_time', 'runtime', 'runtimes', 'runtime_minutes', 'duration'):
                            if hasattr(ep_full, attr):
                                ep_runtime = normalize_runtime(getattr(ep_full, attr))
                                if ep_runtime:
                                    break
                    except Exception:
                        pass
                if ep_runtime is None and default_ep_runtime:
                    # Use show-level runtime as per-episode fallback
                    ep_runtime = default_ep_runtime
                if ep_runtime:
                    season_total_runtime += ep_runtime
                    season_has_runtime = True
                try:
                    dbg(f"[EP] S{season_number:02}E{getattr(ep,'episode', '')}: title={ep_title} rating={ep_rating} runtime={ep_runtime} air_date={air_date} has_imdb_id={hasattr(ep,'imdb_id')}")
                except Exception:
                    pass
                # Minimal logging only

                episode_data = {
                    'title': ep_title,
                    'episodeNumber': getattr(ep, 'episode', None),
                    'airDate': air_date,
                    'artworkUrl': ep_artwork,
                    'imdbRating': ep_rating,
                    'description': ep_description,
                    'runtime': ep_runtime,
                }
                season_data['episodes'].append(episode_data)

            if episode_ratings:
                avg_rating = sum(episode_ratings) / len(episode_ratings)
                season_data['imdbRating'] = avg_rating

            if season_has_runtime:
                season_data['runtime'] = season_total_runtime
            elif default_ep_runtime and len(season_data['episodes']) > 0:
                # No episode runtimes found; compute season runtime from default per-episode runtime
                season_data['runtime'] = default_ep_runtime * len(season_data['episodes'])

            result['seasons'].append(season_data)

        # Aggregate show runtime from seasons
        total_runtime = 0
        has_any = False
        for s in result['seasons']:
            rt = s.get('runtime') if isinstance(s, dict) else None
            if rt:
                total_runtime += int(rt)
                has_any = True
        if has_any:
            result['show']['runtime'] = total_runtime
        # Minimal logging only

        return result

    except Exception as e:
        print(f"Error importing {title if 'title' in locals() else imdb_id}: {e}")
        return result

def fetch_movie(imdb_id, order):
    """
    Fetch a movie from IMDb using CinemagoerNG, process its fields,
    and return a JSON object with the data.
    """
    # Try reference page first for richer data, then fallback to main
    movie = None
    try:
        movie = web.get_title(imdb_id=imdb_id, page="reference")
    except Exception:
        try:
            movie = web.get_title(imdb_id=imdb_id, page="main")
        except Exception:
            movie = web.get_title(imdb_id=imdb_id)
    if not movie:
        print(f"Could not retrieve movie with IMDb ID: {imdb_id}")
        return None
        
    title = movie.title
    description = movie.plot if hasattr(movie, 'plot') and movie.plot else ""
    if isinstance(description, dict):
        description = description.get('en-US', next(iter(description.values()), ""))
    release_year = movie.year if hasattr(movie, 'year') else None
    artwork_url = movie.primary_image if hasattr(movie, 'primary_image') else None
    if artwork_url:
        artwork_url = download_image(artwork_url, f"movie_{imdb_id}")
    movie_rating = movie.rating if hasattr(movie, 'rating') else None
    # Movie runtime
    mv_runtime = None
    for attr in ('running_time', 'runtime', 'runtimes', 'runtime_minutes', 'duration'):
        if hasattr(movie, attr):
            mv_runtime = normalize_runtime(getattr(movie, attr))
            if mv_runtime:
                break
    # If still none, try to fetch again using alternate page
    if mv_runtime is None:
        try:
            alt = web.get_title(imdb_id=imdb_id, page="main")
            for attr in ('running_time', 'runtime', 'runtimes', 'runtime_minutes', 'duration'):
                if hasattr(alt, attr):
                    mv_runtime = normalize_runtime(getattr(alt, attr))
                    if mv_runtime:
                        break
        except Exception:
            pass
    release_date = datetime(release_year, 1, 1).isoformat() if release_year else None

    return {
        "title": title,
        "releaseDate": release_date,
        "description": description,
        "order": order,
        "artworkUrl": artwork_url,
        "imdbRating": float(movie_rating) if movie_rating else None,
        "runtime": mv_runtime
    }

def search_title(query):
    """
    Search for a title on IMDb and return the results.
    """
    from imdb import IMDb
    ia = IMDb()
    results = ia.search_movie(query)
    search_results = []
    
    for movie in results:
        title = movie.get('title')
        year = movie.get('year')
        imdb_id = movie.movieID  # IMDbPY returns the numeric id
        kind = movie.get('kind', 'unknown')
        
        search_results.append({
            "title": title,
            "year": year,
            "imdbId": f"tt{imdb_id.zfill(7)}",  # Format as tt0123456
            "kind": kind
        })
        
    return search_results

def import_star_trek_data():
    """
    Import Star Trek TV series and movies data and write to JSON files.
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
    
    tv_data = []
    for series_name, info in tv_series.items():
        print(f"Importing TV series: {series_name}")
        try:
            result = fetch_show_and_episodes(info["imdb_id"], info["order"])
            tv_data.append(result)
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
    
    movie_data = []
    for movie_title, info in movies.items():
        print(f"Importing movie: {movie_title}")
        try:
            result = fetch_movie(info["imdb_id"], info["order"])
            if result:
                movie_data.append(result)
        except Exception as e:
            print(f"Error importing movie {movie_title}: {e}")
    
    # Write data to JSON files
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(project_root, 'scripts', 'data')
    os.makedirs(output_dir, exist_ok=True)
    
    with open(os.path.join(output_dir, 'tv_series_data.json'), 'w') as f:
        json.dump(tv_data, f, indent=2)
        
    with open(os.path.join(output_dir, 'movies_data.json'), 'w') as f:
        json.dump(movie_data, f, indent=2)
    
    print("Star Trek data import complete. Data written to JSON files.")

def main():
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == 'search':
            if len(sys.argv) > 2:
                query = sys.argv[2]
            else:
                query = input("Enter a title to search on IMDb: ")
            results = search_title(query)
            print(json.dumps(results, indent=2))
        elif sys.argv[1] == 'import':
            import_star_trek_data()
    else:
        print("Usage: python imdb_fetch.py [search|import] [query]")
        print("  search [query]: Search for a title on IMDb")
        print("  import: Import all Star Trek series and movies data")

if __name__ == '__main__':
    main()
`;

  fs.writeFileSync(pythonScriptPath, pythonScript);
  return pythonScriptPath;
};

// Function to download an image
async function downloadImage(url, prefix) {
  if (!url) return null;
  
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'];
    const ext = contentType.split('/')[1] || 'jpg';
    const filename = `${prefix}.${ext}`;
    
    // Create directory if it doesn't exist
    const imagesFolder = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imagesFolder)) {
      fs.mkdirSync(imagesFolder, { recursive: true });
    }
    
    const filePath = path.join(imagesFolder, filename);
    fs.writeFileSync(filePath, Buffer.from(response.data));
    
    return `/images/${filename}`;
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    return url;
  }
}

// Function to update or create a Show (SQL upsert)
async function upsertShow(showData) {
  const { title, description, order, artworkUrl, imdbRating, runtime } = showData;
  try {
    console.log(`[UPSERT SHOW] ${title} input.runtime=${runtime}`);
    const res = await query(
      `INSERT INTO shows (title, description, "order", artwork_url, imdb_rating, runtime)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (title) DO UPDATE SET
         description = EXCLUDED.description,
         "order" = EXCLUDED."order",
         artwork_url = EXCLUDED.artwork_url,
         imdb_rating = EXCLUDED.imdb_rating,
         runtime = EXCLUDED.runtime
       RETURNING id, title, description, "order", artwork_url AS "artworkUrl", imdb_rating AS "imdbRating", runtime;`,
      [title, description ?? null, order ?? null, artworkUrl ?? null, imdbRating ?? null, runtime ?? null]
    );
    const show = res.rows[0];
    console.log(`[UPSERT SHOW] ${title} saved.runtime=${show.runtime}`);
    return show;
  } catch (error) {
    console.error(`Error upserting show ${title}:`, error);
    throw error;
  }
}

// Function to update or create a Season (SQL upsert)
async function upsertSeason(seasonData, showId) {
  const { number, imdbRating, runtime } = seasonData;
  try {
    console.log(`[UPSERT SEASON] showId=${showId} S${number} input.runtime=${runtime}`);
    const res = await query(
      `INSERT INTO seasons (number, show_id, imdb_rating, runtime)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (show_id, number) DO UPDATE SET
         imdb_rating = EXCLUDED.imdb_rating,
         runtime = EXCLUDED.runtime
       RETURNING id, number, imdb_rating AS "imdbRating", runtime, show_id AS "showId";`,
      [number, showId, imdbRating ?? null, runtime ?? null]
    );
    const season = res.rows[0];
    console.log(`[UPSERT SEASON] showId=${showId} S${number} saved.runtime=${season.runtime}`);
    return season;
  } catch (error) {
    console.error(`Error upserting season ${number} for show ${showId}:`, error);
    throw error;
  }
}

// Function to update or create an Episode (SQL upsert)
async function upsertEpisode(episodeData, seasonId) {
  const { title, episodeNumber, airDate, artworkUrl, imdbRating, description, runtime } = episodeData;
  const episodeNumberInt = episodeNumber != null && episodeNumber !== "" ? parseInt(episodeNumber, 10) : null;
  try {
    const safeTitle = title && String(title).trim().length > 0 ? title : `Episode ${episodeNumberInt ?? ''}`;
    console.log(`[UPSERT EPISODE] seasonId=${seasonId} E${episodeNumberInt} input.runtime=${runtime}`);
    const res = await query(
      `INSERT INTO episodes (title, episode_number, season_id, air_date, artwork_url, imdb_rating, description, runtime)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (season_id, episode_number) DO UPDATE SET
         title = EXCLUDED.title,
         air_date = EXCLUDED.air_date,
         artwork_url = EXCLUDED.artwork_url,
         imdb_rating = EXCLUDED.imdb_rating,
         description = EXCLUDED.description,
         runtime = EXCLUDED.runtime
       RETURNING id, title, episode_number AS "episodeNumber", season_id AS "seasonId", air_date AS "airDate", artwork_url AS "artworkUrl", imdb_rating AS "imdbRating", description, runtime;`,
      [safeTitle, episodeNumberInt, seasonId, airDate ? new Date(airDate) : null, artworkUrl ?? null, imdbRating ?? null, description ?? null, runtime ?? null]
    );
    const episode = res.rows[0];
    console.log(`[UPSERT EPISODE] seasonId=${seasonId} E${episodeNumberInt} saved.runtime=${episode.runtime}`);
    return episode;
  } catch (error) {
    console.error(`Error upserting episode ${title} (${episodeNumber}) for season ${seasonId}:`, error);
    throw error;
  }
}

// Function to update or create a Movie (SQL upsert)
async function upsertMovie(movieData) {
  const { title, releaseDate, description, order, artworkUrl, imdbRating, runtime } = movieData;
  try {
    console.log(`[UPSERT MOVIE] ${title} input.runtime=${runtime}`);
    const res = await query(
      `INSERT INTO movies (title, release_date, description, "order", artwork_url, imdb_rating, runtime)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (title) DO UPDATE SET
         release_date = EXCLUDED.release_date,
         description = EXCLUDED.description,
         "order" = EXCLUDED."order",
         artwork_url = EXCLUDED.artwork_url,
         imdb_rating = EXCLUDED.imdb_rating,
         runtime = EXCLUDED.runtime
       RETURNING id, title, release_date AS "releaseDate", description, "order", artwork_url AS "artworkUrl", imdb_rating AS "imdbRating", runtime;`,
      [title, releaseDate ? new Date(releaseDate) : null, description ?? null, order ?? null, artworkUrl ?? null, imdbRating ?? null, runtime ?? null]
    );
    const movie = res.rows[0];
    console.log(`[UPSERT MOVIE] ${title} saved.runtime=${movie.runtime}`);
    return movie;
  } catch (error) {
    console.error(`Error upserting movie ${title}:`, error);
    throw error;
  }
}

// Run Python script and process the output
async function importFromPython() {
  console.log('Creating Python script...');
  const pythonScriptPath = createPythonScript();
  
  console.log('Running Python script to import data...');
  try {
    // Ensure schema exists before loading
    await ensureSchema();
    // Execute the Python script to import data
    execSync(`python ${pythonScriptPath} import`, { stdio: 'inherit' });
    
    // Read the generated JSON files
    const dataDir = path.join(__dirname, 'data');
    const tvSeriesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'tv_series_data.json'), 'utf8'));
    const moviesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'movies_data.json'), 'utf8'));
    
    console.log(`Importing ${tvSeriesData.length} TV series and ${moviesData.length} movies to database...`);
    
    // Process TV series data
    for (const seriesData of tvSeriesData) {
      if (!seriesData.show) continue;
      
      console.log(`Processing series: ${seriesData.show.title}`);
      console.log(`[DATA SHOW] keys=${Object.keys(seriesData.show).join(',')} runtime=${seriesData.show.runtime}`)
      const show = await upsertShow(seriesData.show);
      
      for (const seasonData of seriesData.seasons) {
        console.log(`  Processing season ${seasonData.number}`);
        console.log(`  [DATA SEASON] S${seasonData.number} keys=${Object.keys(seasonData).join(',')} runtime=${seasonData.runtime}`)
        const season = await upsertSeason(seasonData, show.id);
        
        for (const episodeData of seasonData.episodes) {
          console.log(`    Processing episode ${episodeData.episodeNumber}: ${episodeData.title}`);
          console.log(`    [DATA EPISODE] S${seasonData.number}E${episodeData.episodeNumber} keys=${Object.keys(episodeData).join(',')} runtime=${episodeData.runtime}`)
          await upsertEpisode(episodeData, season.id);
        }
      }
    }
    
    // Process movie data
    for (const movieData of moviesData) {
      console.log(`Processing movie: ${movieData.title}`);
      console.log(`[DATA MOVIE] keys=${Object.keys(movieData).join(',')} runtime=${movieData.runtime}`)
      await upsertMovie(movieData);
    }
    
    console.log('Data import complete!');
  } catch (error) {
    console.error('Error during import process:', error);
  }
}

// Function to search IMDb for titles
async function searchIMDb(query) {
  console.log(`Searching IMDb for: ${query}`);
  const pythonScriptPath = createPythonScript();
  
  try {
    const output = execSync(`python ${pythonScriptPath} search "${query}"`, { encoding: 'utf8' });
    console.log(output);
    return JSON.parse(output);
  } catch (error) {
    console.error('Error searching IMDb:', error.message);
    return [];
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'import') {
    await importFromPython();
  } else if (command === 'search') {
    const query = args[1] || process.stdin.read() || 'Star Trek';
    await searchIMDb(query);
  } else if (command === 'monitor') {
    console.log('Starting monitoring process for new Star Trek content...');
    // This would be implemented for regular checking
    console.log('Monitoring is not yet implemented. Please set up a cron job to run this script regularly.');
  } else {
    console.log('Usage: node import-imdb-data.js [import|search|monitor]');
    console.log('  import - Import all Star Trek series and movies data');
    console.log('  search <query> - Search for a title on IMDb');
    console.log('  monitor - Set up monitoring for new Star Trek content');
  }
  
  await pool.end();
}

// Run the script
if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  importFromPython,
  searchIMDb
};
