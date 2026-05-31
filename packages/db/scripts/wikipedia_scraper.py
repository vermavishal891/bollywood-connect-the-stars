#!/usr/bin/env python3
"""
Wikipedia Bollywood Data Scraper
Extracts Hindi/Bollywood film and actor data from Wikipedia pages.
No API key required. Uses MediaWiki API + BeautifulSoup.
"""

import json
import sys
import time
import re
from urllib.parse import quote
from typing import Dict, List, Set, Tuple, Optional

import requests
from bs4 import BeautifulSoup

WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_BASE = "https://en.wikipedia.org/wiki/"

def wiki_api(params: dict) -> dict:
    """Call Wikipedia MediaWiki API."""
    p = {
        "format": "json",
        "origin": "*",
        **params,
    }
    r = requests.get(WIKI_API, params=p, timeout=30)
    r.raise_for_status()
    return r.json()


def get_page_html(title: str) -> Optional[BeautifulSoup]:
    """Fetch a Wikipedia page and return parsed BeautifulSoup."""
    try:
        data = wiki_api({
            "action": "parse",
            "page": title,
            "prop": "text",
            "redirects": "1",
        })
        html = data["parse"]["text"]["*"]
        return BeautifulSoup(html, "html.parser")
    except Exception as e:
        print(f"  [WARN] Could not fetch page '{title}': {e}", file=sys.stderr)
        return None


def extract_cast_from_infobox(soup: BeautifulSoup) -> List[str]:
    """Extract cast members from a film page's infobox."""
    cast = []
    infobox = soup.find("table", {"class": "infobox"})
    if not infobox:
        return cast

    for row in infobox.find_all("tr"):
        header = row.find("th")
        if header:
            text = header.get_text(strip=True).lower()
            if "starring" in text or "cast" in text:
                cell = row.find("td")
                if cell:
                    # Cast names are usually in <a> tags or <li> items
                    for link in cell.find_all("a"):
                        name = link.get_text(strip=True)
                        if name and len(name) > 2 and not name.startswith("["):
                            cast.append(name)
                    # Also check for plain text if no links
                    if not cast:
                        plain = cell.get_text(separator=",").strip()
                        for name in plain.split(","):
                            name = name.strip()
                            if name and len(name) > 2:
                                cast.append(name)
    return list(dict.fromkeys(cast))  # dedupe preserve order


def extract_cast_from_section(soup: BeautifulSoup) -> List[str]:
    """Extract cast from the 'Cast' section of a film page."""
    cast = []
    # Find the Cast heading
    for heading in soup.find_all(["h2", "h3"]):
        text = heading.get_text(strip=True).lower()
        if text.startswith("cast"):
            # Get the next sibling elements until next heading
            sibling = heading.find_next_sibling()
            while sibling and sibling.name not in ("h2", "h3"):
                if sibling.name == "ul":
                    for li in sibling.find_all("li"):
                        # First link or first bold text is usually the actor name
                        link = li.find("a")
                        if link:
                            name = link.get_text(strip=True)
                            if name and len(name) > 2:
                                cast.append(name)
                        else:
                            bold = li.find("b")
                            if bold:
                                name = bold.get_text(strip=True)
                                if name and len(name) > 2:
                                    cast.append(name)
                elif sibling.name == "table" and "cast" in sibling.get("class", []):
                    for row in sibling.find_all("tr")[1:]:
                        cells = row.find_all("td")
                        if cells:
                            name = cells[0].get_text(strip=True)
                            if name and len(name) > 2:
                                cast.append(name)
                sibling = sibling.find_next_sibling()
            break
    return list(dict.fromkeys(cast))


def extract_film_year_from_infobox(soup: BeautifulSoup) -> Optional[int]:
    """Extract release year from infobox."""
    infobox = soup.find("table", {"class": "infobox"})
    if not infobox:
        return None
    for row in infobox.find_all("tr"):
        header = row.find("th")
        if header:
            text = header.get_text(strip=True).lower()
            if "release" in text and "date" in text:
                cell = row.find("td")
                if cell:
                    date_text = cell.get_text(strip=True)
                    # Extract year from date text
                    match = re.search(r"\b(19\d{2}|20\d{2})\b", date_text)
                    if match:
                        return int(match.group(1))
    return None


def extract_genre_from_infobox(soup: BeautifulSoup) -> Optional[str]:
    """Extract genre from infobox."""
    infobox = soup.find("table", {"class": "infobox"})
    if not infobox:
        return None
    for row in infobox.find_all("tr"):
        header = row.find("th")
        if header:
            text = header.get_text(strip=True).lower()
            if text == "genre":
                cell = row.find("td")
                if cell:
                    genre = cell.get_text(strip=True).lower()
                    # Simplify genre
                    genre_map = {
                        "romance": "romance",
                        "romantic": "romance",
                        "comedy": "comedy",
                        "action": "action",
                        "drama": "drama",
                        "thriller": "thriller",
                        "horror": "horror",
                        "crime": "crime",
                        "musical": "musical",
                        "biographical": "biopic",
                        "historical": "historical",
                        "war": "war",
                        "sports": "sports",
                        "science fiction": "sci-fi",
                        "fantasy": "fantasy",
                    }
                    for key, val in genre_map.items():
                        if key in genre:
                            return val
                    return "drama"
    return None


def scrape_film_page(title: str) -> Optional[dict]:
    """Scrape a single film Wikipedia page. Returns {title, year, genre, cast}."""
    soup = get_page_html(title)
    if not soup:
        return None

    cast = extract_cast_from_infobox(soup)
    if not cast:
        cast = extract_cast_from_section(soup)

    year = extract_film_year_from_infobox(soup)
    genre = extract_genre_from_infobox(soup)

    return {
        "title": title.replace("_", " "),
        "year": year,
        "genre": genre or "drama",
        "cast": cast[:15],  # limit cast size
    }


def scrape_film_list_page(year: int) -> List[dict]:
    """
    Scrape 'List of Hindi films of YYYY' page.
    Returns list of {title, year, cast_from_table}.
    """
    page_title = f"List of Hindi films of {year}"
    soup = get_page_html(page_title)
    if not soup:
        return []

    films = []
    # Find all wikitable tables on the page
    tables = soup.find_all("table", {"class": "wikitable"})

    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        # Detect column indices
        header_row = rows[0]
        headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

        title_idx = None
        cast_idx = None
        for i, h in enumerate(headers):
            if "title" in h or "film" in h:
                title_idx = i
            if "cast" in h or "actor" in h or "starring" in h:
                cast_idx = i

        if title_idx is None:
            continue

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) <= title_idx:
                continue

            title_cell = cells[title_idx]
            title_link = title_cell.find("a")
            if title_link:
                film_title = title_link.get_text(strip=True)
                film_page = title_link.get("href", "").replace("/wiki/", "")
            else:
                film_title = title_cell.get_text(strip=True)
                film_page = None

            if not film_title or len(film_title) < 2:
                continue

            cast_from_table = []
            if cast_idx is not None and len(cells) > cast_idx:
                cast_cell = cells[cast_idx]
                for link in cast_cell.find_all("a"):
                    name = link.get_text(strip=True)
                    if name and len(name) > 2:
                        cast_from_table.append(name)
                if not cast_from_table:
                    for part in cast_cell.get_text(strip=True).split(","):
                        name = part.strip()
                        if name and len(name) > 2:
                            cast_from_table.append(name)

            films.append({
                "title": film_title,
                "year": year,
                "cast_from_table": cast_from_table,
                "page": film_page,
            })

    return films


def scrape_actors_from_category() -> List[dict]:
    """
    Scrape Indian film actors from Wikipedia category pages.
    Returns list of {name, filmography}.
    """
    # We'll scrape a few known actor pages for their filmographies
    known_actors = [
        "Shah Rukh Khan", "Salman Khan", "Aamir Khan", "Amitabh Bachchan",
        "Akshay Kumar", "Hrithik Roshan", "Ranbir Kapoor", "Deepika Padukone",
        "Priyanka Chopra", "Katrina Kaif", "Kareena Kapoor", "Alia Bhatt",
        "Ranveer Singh", "Ajay Devgn", "Shahid Kapoor", "Anushka Sharma",
        "Varun Dhawan", "Sidharth Malhotra", "Tiger Shroff", "Shraddha Kapoor",
        "Kriti Sanon", "Kiara Advani", "Janhvi Kapoor", "Sara Ali Khan",
        "Ayushmann Khurrana", "Rajkummar Rao", "Vicky Kaushal", "Kartik Aaryan",
        "Nawazuddin Siddiqui", "Pankaj Tripathi", "Irrfan Khan", "Manoj Bajpayee",
        "Bhumi Pednekar", "Taapsee Pannu", "Kangana Ranaut", "Sonam Kapoor",
        "Madhuri Dixit", "Kajol", "Rani Mukerji", "Preity Zinta",
        "Aishwarya Rai Bachchan", "Saif Ali Khan", "Sanjay Dutt", "Sunny Deol",
        "John Abraham", "Abhishek Bachchan", "Anil Kapoor", "Rishi Kapoor",
        "Dharmendra", "Govinda", "Jackie Shroff", "Mithun Chakraborty",
    ]

    actors = []
    for i, name in enumerate(known_actors):
        print(f"  Scraping actor {i+1}/{len(known_actors)}: {name}", file=sys.stderr)
        soup = get_page_html(name)
        if not soup:
            continue

        # Try to extract filmography from tables
        filmography = []
        for heading in soup.find_all(["h2", "h3", "h4"]):
            text = heading.get_text(strip=True).lower()
            if "filmography" in text or "films" in text:
                sibling = heading.find_next_sibling()
                while sibling and sibling.name not in ("h2", "h3"):
                    if sibling.name == "table" and "wikitable" in sibling.get("class", []):
                        for row in sibling.find_all("tr")[1:]:
                            cells = row.find_all("td")
                            if cells:
                                title = cells[0].get_text(strip=True)
                                if title and len(title) > 1 and not title.startswith("["):
                                    filmography.append(title)
                    sibling = sibling.find_next_sibling()
                break

        actors.append({
            "name": name,
            "filmography": filmography[:30],
        })
        time.sleep(0.3)  # Be polite to Wikipedia

    return actors


def build_dataset(years: List[int]) -> dict:
    """
    Main function: scrape Wikipedia and build a complete actor/movie dataset.
    Returns {actors: [...], movies: [...]}.
    """
    print(f"[INFO] Scraping Wikipedia for Bollywood data (years: {years})", file=sys.stderr)

    all_movies: Dict[str, dict] = {}
    actor_to_movies: Dict[str, Set[str]] = {}
    movie_to_cast: Dict[str, Set[str]] = {}

    # Step 1: Scrape film list pages for each year
    for year in years:
        print(f"[INFO] Scraping Hindi films of {year}...", file=sys.stderr)
        films = scrape_film_list_page(year)
        print(f"  Found {len(films)} films", file=sys.stderr)

        for film in films:
            title = film["title"]
            if title not in all_movies:
                all_movies[title] = {
                    "title": title,
                    "year": film["year"],
                    "genre": None,
                    "cast": set(),
                }

            # Add cast from table
            for actor_name in film["cast_from_table"]:
                all_movies[title]["cast"].add(actor_name)
                actor_to_movies.setdefault(actor_name, set()).add(title)
                movie_to_cast.setdefault(title, set()).add(actor_name)

        time.sleep(0.5)

    # Step 2: For top films, scrape individual pages for better cast data
    top_films = sorted(all_movies.values(), key=lambda f: len(f["cast"]), reverse=True)[:50]
    for i, film in enumerate(top_films):
        print(f"  Scraping film page {i+1}/{len(top_films)}: {film['title']}", file=sys.stderr)
        result = scrape_film_page(film["title"])
        if result:
            all_movies[film["title"]]["year"] = result["year"] or film["year"]
            all_movies[film["title"]]["genre"] = result["genre"]
            for actor_name in result["cast"]:
                all_movies[film["title"]]["cast"].add(actor_name)
                actor_to_movies.setdefault(actor_name, set()).add(film["title"])
        time.sleep(0.5)

    # Step 3: Also scrape known actors for their filmographies
    print("[INFO] Scraping known actors for filmographies...", file=sys.stderr)
    scraped_actors = scrape_actors_from_category()
    for actor in scraped_actors:
        actor_name = actor["name"]
        actor_to_movies.setdefault(actor_name, set())
        for film_title in actor["filmography"]:
            actor_to_movies[actor_name].add(film_title)
            if film_title in all_movies:
                all_movies[film_title]["cast"].add(actor_name)

    # Build output
    # Filter actors who appear in at least 2 movies (better graph connectivity)
    connected_actors = {name: movies for name, movies in actor_to_movies.items() if len(movies) >= 1}

    # Filter movies with at least 2 cast members
    connected_movies = {title: data for title, data in all_movies.items() if len(data["cast"]) >= 2}

    # Make sure every actor in connected_movies exists in connected_actors
    for title, data in connected_movies.items():
        for actor in list(data["cast"]):
            if actor not in connected_actors:
                connected_actors[actor] = {title}

    # Also make sure every actor has at least one movie
    connected_actors = {k: v for k, v in connected_actors.items() if len(v) > 0}

    # Build aliases (common nicknames)
    aliases_map: Dict[str, List[str]] = {
        "Shah Rukh Khan": ["SRK", "Shahrukh Khan", "King Khan", "Badshah"],
        "Salman Khan": ["Bhaijaan", "Sallu", "Bhai"],
        "Aamir Khan": ["Mr Perfectionist", "AK"],
        "Amitabh Bachchan": ["Big B", "Amitabh", "Shahenshah"],
        "Akshay Kumar": ["Khiladi", "Akki"],
        "Hrithik Roshan": ["Greek God", "Hrithik", "Duggu"],
        "Ranbir Kapoor": ["RK", "Ranbir"],
        "Deepika Padukone": ["Deepika", "DP"],
        "Priyanka Chopra": ["Priyanka", "PC", "Piggy Chops"],
        "Katrina Kaif": ["Katrina", "Kat"],
        "Kareena Kapoor": ["Kareena", "Bebo"],
        "Alia Bhatt": ["Alia", "Aloo"],
        "Ranveer Singh": ["Ranveer", "RS"],
        "Ajay Devgn": ["Ajay", "Ajay Devgan"],
        "Shahid Kapoor": ["Shahid", "Sasha"],
        "Anushka Sharma": ["Anushka", "Nushki"],
        "Varun Dhawan": ["Varun", "VD"],
        "Tiger Shroff": ["Tiger", "Jai"],
        "Shraddha Kapoor": ["Shraddha", "Shradz"],
        "Ayushmann Khurrana": ["Ayushmann"],
        "Rajkummar Rao": ["Rajkummar", "Rao"],
        "Vicky Kaushal": ["Vicky"],
        "Kartik Aaryan": ["Kartik"],
        "Nawazuddin Siddiqui": ["Nawazuddin", "Nawaz"],
        "Pankaj Tripathi": ["Pankaj", "Tripathi"],
        "Irrfan Khan": ["Irrfan", "Irfan Khan"],
        "Manoj Bajpayee": ["Manoj"],
        "Bhumi Pednekar": ["Bhumi"],
        "Taapsee Pannu": ["Taapsee"],
        "Kangana Ranaut": ["Kangana"],
        "Sonam Kapoor": ["Sonam"],
        "Madhuri Dixit": ["Madhuri", "Dhak Dhak Girl"],
        "Kajol": ["Kajol Devgn"],
        "Rani Mukerji": ["Rani"],
        "Preity Zinta": ["Preity"],
        "Aishwarya Rai Bachchan": ["Aishwarya", "Ash"],
        "Saif Ali Khan": ["Saif", "Chote Nawab"],
        "Sanjay Dutt": ["Sanju", "Baba"],
        "Sunny Deol": ["Sunny", "Dhai Kilo Ka Haath"],
        "Suniel Shetty": ["Suniel", "Anna"],
        "Bobby Deol": ["Bobby"],
        "John Abraham": ["John"],
        "Abhishek Bachchan": ["Abhishek", "AB Junior"],
        "Boman Irani": ["Boman"],
        "Anupam Kher": ["Anupam"],
        "Om Puri": ["Om"],
        "Naseeruddin Shah": ["Naseeruddin", "Naseer"],
        "Paresh Rawal": ["Paresh"],
        "Johnny Lever": ["Johnny"],
        "Arshad Warsi": ["Arshad"],
        "Riteish Deshmukh": ["Riteish"],
        "Rekha": ["Rekha"],
        "Hema Malini": ["Hema", "Dream Girl"],
        "Sridevi": ["Sridevi"],
        "Juhi Chawla": ["Juhi"],
        "Karishma Kapoor": ["Karishma", "Lolo"],
        "Tabu": ["Tabassum"],
        "Urmila Matondkar": ["Urmila"],
        "Shilpa Shetty": ["Shilpa"],
        "Bipasha Basu": ["Bipasha"],
        "Lara Dutta": ["Lara"],
        "Sushmita Sen": ["Sushmita"],
        "Raveena Tandon": ["Raveena"],
        "Sonakshi Sinha": ["Sonakshi"],
        "Parineeti Chopra": ["Parineeti"],
        "Ileana DCruz": ["Ileana"],
        "Genelia DSouza": ["Genelia"],
        "Vidya Balan": ["Vidya"],
        "Konkona Sen Sharma": ["Konkona"],
        "Radhika Apte": ["Radhika"],
        "Swara Bhasker": ["Swara"],
        "Kalki Koechlin": ["Kalki"],
        "Dimple Kapadia": ["Dimple"],
        "Ratna Pathak Shah": ["Ratna"],
        "Shefali Shah": ["Shefali"],
        "Neena Gupta": ["Neena"],
        "Gajraj Rao": ["Gajraj"],
        "Jitendra Kumar": ["Jeetu", "Jitendra"],
        "Vijay Raaz": ["Vijay"],
        "Deepak Dobriyal": ["Deepak"],
        "Sanjay Mishra": ["Sanjay M"],
        "Shabana Azmi": ["Shabana"],
        "Jaya Bachchan": ["Jaya"],
        "Waheeda Rehman": ["Waheeda"],
        "Asha Parekh": ["Asha"],
        "Helen": ["Helen"],
        "Farida Jalal": ["Farida"],
        "Kirron Kher": ["Kirron"],
        "Smita Patil": ["Smita"],
        "Nandita Das": ["Nandita"],
        "Divya Dutta": ["Divya"],
        "Tisca Chopra": ["Tisca"],
        "Amrita Singh": ["Amrita"],
        "Gracy Singh": ["Gracy"],
        "Bhagyashree": ["Bhagyashree"],
        "Meenakshi Seshadri": ["Meenakshi"],
        "Dharmendra": ["Dharmendra", "Dharm ji"],
        "Rishi Kapoor": ["Rishi", "Chintu"],
        "Amrish Puri": ["Amrish", "Mogambo"],
        "Anil Kapoor": ["Anil", "Jhakaas"],
        "Jackie Shroff": ["Jackie", "Bhidu"],
        "Mithun Chakraborty": ["Mithun", "Mithunda"],
        "Govinda": ["Govinda", "Chi Chi"],
        "Shakti Kapoor": ["Shakti"],
        "Kader Khan": ["Kader"],
        "Asrani": ["Asrani"],
        "Rajpal Yadav": ["Rajpal"],
        "Kay Kay Menon": ["Kay Kay"],
        "Vinay Pathak": ["Vinay"],
        "Ranvir Shorey": ["Ranvir"],
        "Saurabh Shukla": ["Saurabh"],
        "Ronit Roy": ["Ronit"],
        "Rajat Kapoor": ["Rajat"],
        "Aparshakti Khurana": ["Aparshakti"],
        "Mohammed Zeeshan Ayyub": ["Zeeshan"],
        "Kunal Khemu": ["Kunal"],
        "Sharman Joshi": ["Sharman"],
        "R Madhavan": ["Madhavan"],
        "Arjun Rampal": ["Arjun"],
        "Zayed Khan": ["Zayed"],
        "Fardeen Khan": ["Fardeen"],
        "Tusshar Kapoor": ["Tusshar"],
        "Aftab Shivdasani": ["Aftab"],
        "Uday Chopra": ["Uday"],
        "Jimmy Sheirgill": ["Jimmy"],
        "Ali Zafar": ["Ali Z"],
        "Aditya Roy Kapur": ["Aditya"],
        "Abhay Deol": ["Abhay"],
        "Farhan Akhtar": ["Farhan"],
        "Arjun Kapoor": ["Arjun K"],
        "Sushant Singh Rajput": ["Sushant", "SSR"],
        "Diljit Dosanjh": ["Diljit"],
        "Nushrratt Bharuccha": ["Nushrratt"],
        "Huma Qureshi": ["Huma"],
        "Yami Gautam": ["Yami"],
        "Nargis Fakhri": ["Nargis"],
        "Vaani Kapoor": ["Vaani"],
        "Mrunal Thakur": ["Mrunal"],
        "Sanya Malhotra": ["Sanya"],
        "Fatima Sana Shaikh": ["Fatima"],
        "Zaira Wasim": ["Zaira"],
        "Rashmika Mandanna": ["Rashmika"],
        "Nayanthara": ["Nayanthara", "Nayan"],
        "Tripti Dimri": ["Tripti"],
        "Nimrat Kaur": ["Nimrat"],
        "Samantha Ruth Prabhu": ["Samantha"],
        "Tamannaah Bhatia": ["Tamannaah"],
        "Kajal Aggarwal": ["Kajal"],
        "Rakul Preet Singh": ["Rakul"],
        "Pooja Hegde": ["Pooja H"],
        "Nora Fatehi": ["Nora"],
    }

    actors_out = []
    for name, movies in connected_actors.items():
        aliases = aliases_map.get(name, [])
        actors_out.append({
            "name": name,
            "aliases": aliases,
            "movies": sorted(movies),
        })

    movies_out = []
    for title, data in connected_movies.items():
        movies_out.append({
            "title": title,
            "year": data["year"],
            "genre": data["genre"] or "drama",
            "cast": sorted(data["cast"])[:15],
        })

    print(f"[INFO] Dataset: {len(actors_out)} actors, {len(movies_out)} movies", file=sys.stderr)
    return {"actors": actors_out, "movies": movies_out}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scrape Bollywood data from Wikipedia")
    parser.add_argument("--years", default="2024,2023,2022,2021,2020,2019,2018,2017,2016,2015,2014,2013,2012,2011,2010,2009,2008,2007,2006,2005,2004,2003,2002,2001,2000,1999,1998,1997,1996,1995,1994,1993,1992,1991,1990",
                        help="Comma-separated years to scrape")
    parser.add_argument("--output", default="wikipedia_data.json", help="Output JSON file")
    args = parser.parse_args()

    years = [int(y.strip()) for y in args.years.split(",")]
    dataset = build_dataset(years)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    print(f"[DONE] Saved to {args.output}")
