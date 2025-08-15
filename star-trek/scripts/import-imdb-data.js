// Import IMDb data using CinemagoerNG
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

// Initialize Prisma client
// Load environment variables from .env file
require('dotenv').config();

// Use DATABASE_URL from environment or fall back to local development
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/startrekdb?schema=public';

// Initialize Prisma client with the database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

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

def fetch_show_and_episodes(imdb_id, order, max_seasons=25):
    """
    Fetch a TV series using the "reference" page from cinemagoerng,
    then for each season (from 1 to max_seasons) update the object with episode data.
    Return a JSON structure with all the data.
    """
    result = {
        "show": None,
        "seasons": []
    }
    try:
        # Fetch series metadata (page="reference" or "main")
        meta = web.get_title(imdb_id=imdb_id, page="reference")
        if not meta:
            print(f"Could not retrieve series with IMDb ID: {imdb_id}")
            return result
        # Get the original title and then apply renaming based on order
        original_title = meta.title
        
        # Rename based on order
        if order == 1:
            title = "Star Trek: The Original Series"
        elif order == 2:
            title = "Star Trek: The Animated Series"
        else:
            title = original_title
            
        description = meta.plot if hasattr(meta, 'plot') and meta.plot else ""
        if isinstance(description, dict):
            description = description.get('en-US', next(iter(description.values()), ""))
            
        # For TOS and TAS, ensure we have a good description if it's missing
        if order == 1 and not description:
            description = "In the 23rd Century, Captain James T. Kirk and the crew of the U.S.S. Enterprise explore the galaxy and defend the United Federation of Planets in this groundbreaking original series that started it all."
        elif order == 2 and not description:
            description = "The further adventures of Captain James T. Kirk and the crew of the USS Enterprise, as they explore the galaxy and defend the United Federation of Planets in this animated series that continues the five-year mission."
            
        artwork_url = meta.primary_image if hasattr(meta, 'primary_image') else None
        if artwork_url:
            artwork_url = download_image(artwork_url, f"series_{imdb_id}")
        series_rating = meta.rating if hasattr(meta, 'rating') else None

        result["show"] = {
            "title": title,
            "description": description,
            "order": order,
            "artworkUrl": artwork_url,
            "imdbRating": float(series_rating) if series_rating else None
        }

        for season_number in range(1, max_seasons + 1):
            season_str = str(season_number)
            # Fetch episodes for this season
            series = web.get_title(imdb_id=imdb_id, page="episodes", season=season_str)
            if not hasattr(series, "episodes") or season_str not in series.episodes or not series.episodes[season_str]:
                print(f"Season {season_str} has no episodes; assuming no more seasons available.")
                break

            episodes_for_season = series.episodes[season_str]
            print(f"Season {season_str} has {len(episodes_for_season)} episodes")
            season_data = {
                "number": season_number,
                "imdbRating": None,
                "episodes": []
            }
            episode_ratings = []
            for ep_key, ep in episodes_for_season.items():
                ep_title = getattr(ep, "title", "")
                air_date = getattr(ep, "release_date", None)
                if air_date is not None and not isinstance(air_date, str):
                  # Convert date/datetime to ISO string
                  air_date = air_date.isoformat()
                ep_artwork = getattr(ep, "primary_image", None)
                if ep_artwork:
                    ep_artwork = download_image(ep_artwork, f"series_{imdb_id}_season_{season_number}_ep_{getattr(ep, 'episode', '')}")
                ep_rating = getattr(ep, "rating", None)
                if ep_rating is not None:
                    try:
                        ep_rating = float(ep_rating)
                        episode_ratings.append(ep_rating)
                    except Exception as e:
                        print(f"Error converting rating for episode {ep_key}: {e}")
                        ep_rating = None

                episode_data = {
                    "title": ep_title,
                    "episodeNumber": getattr(ep, "episode", None),
                    "airDate": air_date,
                    "artworkUrl": ep_artwork,
                    "imdbRating": ep_rating
                }
                season_data["episodes"].append(episode_data)

            if episode_ratings:
                avg_rating = sum(episode_ratings) / len(episode_ratings)
                season_data["imdbRating"] = avg_rating
                print(f"Season {season_str} average rating: {avg_rating}")

            result["seasons"].append(season_data)

        return result

    except Exception as e:
        print(f"Error importing {title if 'title' in locals() else imdb_id}: {e}")
        return result

def fetch_movie(imdb_id, order):
    """
    Fetch a movie from IMDb using CinemagoerNG, process its fields,
    and return a JSON object with the data.
    """
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
    release_date = datetime(release_year, 1, 1).isoformat() if release_year else None
    print(f"Fetched movie: {title} (Rating: {movie_rating})")

    return {
        "title": title,
        "releaseDate": release_date,
        "description": description,
        "order": order,
        "artworkUrl": artwork_url,
        "imdbRating": float(movie_rating) if movie_rating else None
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

// Function to update or create a Show
async function upsertShow(showData) {
  const { title, description, order, artworkUrl, imdbRating } = showData;
  
  try {
    const show = await prisma.show.upsert({
      where: { title },
      update: {
        description,
        order,
        artworkUrl,
        imdbRating,
      },
      create: {
        title,
        description,
        order,
        artworkUrl,
        imdbRating,
      },
    });
    
    return show;
  } catch (error) {
    console.error(`Error upserting show ${title}:`, error);
    throw error;
  }
}

// Function to update or create a Season
async function upsertSeason(seasonData, showId) {
  const { number, imdbRating } = seasonData;
  
  try {
    const season = await prisma.season.upsert({
      where: {
        showId_number: {
          showId,
          number,
        },
      },
      update: {
        imdbRating,
      },
      create: {
        number,
        imdbRating,
        showId,
      },
    });
    
    return season;
  } catch (error) {
    console.error(`Error upserting season ${number} for show ${showId}:`, error);
    throw error;
  }
}

// Function to update or create an Episode
async function upsertEpisode(episodeData, seasonId) {
  const { title, episodeNumber, airDate, artworkUrl, imdbRating } = episodeData;
  const episodeNumberInt =
    episodeNumber != null && episodeNumber !== "" ? parseInt(episodeNumber, 10) : null;
  
  try {
    const episode = await prisma.episode.upsert({
      where: {
        seasonId_episodeNumber: {
          seasonId,
          episodeNumber: episodeNumberInt,
        },
      },
      update: {
        title,
        airDate: airDate ? new Date(airDate) : null,
        artworkUrl,
        imdbRating,
      },
      create: {
        title,
        episodeNumber: episodeNumberInt,
        airDate: airDate ? new Date(airDate) : null,
        artworkUrl,
        imdbRating,
        seasonId,
      },
    });
    
    return episode;
  } catch (error) {
    console.error(`Error upserting episode ${title} (${episodeNumber}) for season ${seasonId}:`, error);
    throw error;
  }
}

// Function to update or create a Movie
async function upsertMovie(movieData) {
  const { title, releaseDate, description, order, artworkUrl, imdbRating } = movieData;
  
  try {
    const movie = await prisma.movie.upsert({
      where: { title },
      update: {
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        description,
        order,
        artworkUrl,
        imdbRating,
      },
      create: {
        title,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        description,
        order,
        artworkUrl,
        imdbRating,
      },
    });
    
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
      const show = await upsertShow(seriesData.show);
      
      for (const seasonData of seriesData.seasons) {
        console.log(`  Processing season ${seasonData.number}`);
        const season = await upsertSeason(seasonData, show.id);
        
        for (const episodeData of seasonData.episodes) {
          console.log(`    Processing episode ${episodeData.episodeNumber}: ${episodeData.title}`);
          await upsertEpisode(episodeData, season.id);
        }
      }
    }
    
    // Process movie data
    for (const movieData of moviesData) {
      console.log(`Processing movie: ${movieData.title}`);
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
  
  await prisma.$disconnect();
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
