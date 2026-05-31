#!/usr/bin/env python3
"""
Enrich Wikipedia dataset with images and trivia from Wikipedia API.
Uses batch queries (50 pages at a time) for efficiency. No API key needed.
"""
import json, time, urllib.request, urllib.parse, urllib.error
from collections import Counter

with open('wikipedia_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

actors = data['actors']
movies = data['movies']

actor_by_name = {a['name']: a for a in actors}
movie_by_title = {m['title']: m for m in movies}

# Build co-occurrence map for trivia generation
co_stars = {a['name']: Counter() for a in actors}
for m in movies:
    cast = m.get('cast', [])
    for i, actor1 in enumerate(cast):
        if actor1 not in co_stars:
            continue
        for actor2 in cast[i+1:]:
            co_stars[actor1][actor2] += 1
            if actor2 not in co_stars:
                co_stars[actor2] = Counter()
            co_stars[actor2][actor1] += 1


def wiki_batch_query(titles, retry=3):
    """Fetch Wikipedia data for up to 50 titles at once."""
    encoded = '|'.join(urllib.parse.quote(t.replace(' ', '_')) for t in titles)
    url = (
        f"https://en.wikipedia.org/w/api.php?action=query&titles={encoded}"
        f"&prop=pageimages|extracts&pithumbsize=320"
        f"&exsentences=3&explaintext&exlimit=max&format=json"
        f"&redirects=1&origin=*"
    )
    for attempt in range(retry):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'BollywoodConnectBot/1.0 (educational project)',
                'Accept': 'application/json',
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                obj = json.loads(resp.read().decode('utf-8'))
                pages = obj.get('query', {}).get('pages', {})
                result = {}
                for page_id, page in pages.items():
                    if 'missing' in page:
                        continue
                    title = page.get('title', '')
                    thumbnail = page.get('thumbnail', {})
                    image_url = thumbnail.get('source')
                    extract = page.get('extract', '')
                    result[title] = {'image': image_url, 'extract': extract}
                return result
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retry - 1:
                wait = 5 * (attempt + 1)
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"    Batch fail ({len(titles)} titles): {e}")
                return {}
        except Exception as e:
            print(f"    Batch fail ({len(titles)} titles): {e}")
            return {}
    return {}


def batch_process(items, key_fn, is_actor=True):
    """Process items in batches of 40 with delays."""
    batch_size = 40
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        titles = [key_fn(item) for item in batch]
        print(f"  Batch {i//batch_size + 1}/{(len(items) + batch_size - 1)//batch_size} ({len(titles)} items)")

        results = wiki_batch_query(titles)
        time.sleep(1.5)  # be nice to Wikipedia

        for item in batch:
            key = key_fn(item)
            info = results.get(key, {})
            if is_actor:
                item['profileImageUrl'] = info.get('image') or None
                item['description'] = info.get('extract') or None
            else:
                item['posterUrl'] = info.get('image') or None
                item['description'] = info.get('extract') or None

        # Save progress every batch
        with open('wikipedia_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


print(f"Enriching {len(actors)} actors and {len(movies)} movies...")
print("=" * 60)

# --- ACTORS ---
print("\nProcessing actors...")
batch_process(actors, lambda a: a['name'], is_actor=True)

# --- MOVIES ---
print("\nProcessing movies...")
batch_process(movies, lambda m: m['title'], is_actor=False)

# --- GENERATE TRIVIA ---
print("\nGenerating trivia...")

for actor in actors:
    trivia = []
    film_count = len(actor.get('movies', []))
    trivia.append(f"Has appeared in {film_count} movie{'s' if film_count != 1 else ''} in our database.")

    years = []
    for t in actor.get('movies', []):
        m = movie_by_title.get(t)
        if m and m.get('year'):
            years.append(m['year'])
    if years:
        debut = min(years)
        latest = max(years)
        trivia.append(f"Active from {debut} to {latest}.")
        genres = Counter()
        for t in actor.get('movies', []):
            m = movie_by_title.get(t)
            if m and m.get('genre'):
                genres[m['genre']] += 1
        if genres:
            top_genre = genres.most_common(1)[0][0]
            trivia.append(f"Most frequently appears in {top_genre} films.")

    if actor['name'] in co_stars and co_stars[actor['name']]:
        top_co = co_stars[actor['name']].most_common(1)[0]
        trivia.append(f"Frequently co-starred with {top_co[0]} ({top_co[1]} movies together).")

    actor['trivia'] = trivia

for movie in movies:
    trivia = []
    cast = movie.get('cast', [])
    trivia.append(f"Features {len(cast)} actor{'s' if len(cast) != 1 else ''} in the cast.")

    year = movie.get('year')
    genre = movie.get('genre')
    if year and genre:
        trivia.append(f"Released in {year} — a {genre} film.")
    elif year:
        trivia.append(f"Released in {year}.")

    if len(cast) >= 2:
        trivia.append(f"Starred {cast[0]} and {cast[1]}.")

    extras = []
    for a in actors:
        if movie['title'] in a.get('movies', []) and a['name'] not in cast:
            extras.append(a['name'])
    if extras:
        trivia.append(f"Also associated with: {', '.join(extras[:3])}.")

    movie['trivia'] = trivia

# Final save
with open('wikipedia_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Stats
actors_with_img = sum(1 for a in actors if a.get('profileImageUrl'))
movies_with_img = sum(1 for m in movies if m.get('posterUrl'))
actors_with_desc = sum(1 for a in actors if a.get('description'))
movies_with_desc = sum(1 for m in movies if m.get('description'))

print("=" * 60)
print(f"Actors with images: {actors_with_img}/{len(actors)}")
print(f"Movies with images: {movies_with_img}/{len(movies)}")
print(f"Actors with descriptions: {actors_with_desc}/{len(actors)}")
print(f"Movies with descriptions: {movies_with_desc}/{len(movies)}")
print("Done!")
