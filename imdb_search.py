from imdb import IMDb

def search_title(query):
    ia = IMDb()
    results = ia.search_movie(query)
    print(f"Search results for '{query}':")
    for movie in results:
        title = movie.get('title')
        year = movie.get('year')
        imdb_id = movie.movieID  # IMDbPY returns the numeric id; prepend 'tt'
        print(f"Title: {title} ({year}) - IMDb ID: {imdb_id}")

if __name__ == '__main__':
    query = input("Enter a title to search on IMDb: ")
    search_title(query)
