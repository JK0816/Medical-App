import httpx
from bs4 import BeautifulSoup
import urllib.parse
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Module-level shared HTTP client with connection pooling
_http_client = httpx.Client(
    headers=HEADERS, 
    timeout=10.0, 
    follow_redirects=True,
    limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
)

def search_ddg(query: str, num_results: int = 5) -> list:
    """
    Searches DuckDuckGo HTML and returns a list of results:
    [{'title': ..., 'url': ..., 'snippet': ...}]
    """
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    try:
        response = _http_client.get(url)
        if response.status_code != 200:
            logger.error(f"DDG search returned status {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.text, "html.parser")
        results = []
        
        # DuckDuckGo HTML search results are typically in class 'result'
        for idx, result in enumerate(soup.find_all("div", class_="result")):
            if len(results) >= num_results:
                break
            
            title_el = result.find("a", class_="result__url")
            snippet_el = result.find("a", class_="result__snippet")
            
            if not title_el:
                continue
            
            title = title_el.get_text(strip=True)
            raw_url = title_el.get("href", "")
            
            # Extract clean target URL from DDG redirect url
            # e.g., //duckduckgo.com/l/?kh=-1&uddg=https%3A%2F%2Fwww.cancer.org%2F
            parsed_url = urllib.parse.urlparse(raw_url)
            qs = urllib.parse.parse_qs(parsed_url.query)
            clean_url = qs.get("uddg", [None])[0]
            if not clean_url:
                clean_url = raw_url
            
            # Skip results with no usable URL
            if not clean_url or not clean_url.startswith("http"):
                continue
            
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            
            results.append({
                "title": title,
                "url": clean_url,
                "snippet": snippet
            })
        
        return results
    except Exception as e:
        logger.error(f"Error searching DuckDuckGo: {str(e)}")
        return []

def scrape_page_content(url: str) -> str:
    """
    Fetches the content of a target URL and extracts readable text.
    """
    if not url.startswith("http"):
        return ""
    try:
        response = _http_client.get(url, timeout=7.0)
        if response.status_code != 200:
            return ""
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Remove scripts, styles, forms, and nav elements
        for element in soup(["script", "style", "nav", "footer", "header", "form"]):
            element.decompose()
        
        # Get text and clean spacing
        text = soup.get_text(separator=" ")
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Limit context size per page to avoid overflowing token window
        return text[:6000]
    except Exception as e:
        logger.error(f"Error scraping {url}: {str(e)}")
        return ""

from concurrent.futures import ThreadPoolExecutor

def get_web_context(query: str, max_pages: int = 3) -> list:
    """
    Runs a search, scrapes the top pages, and returns:
    [{'title': ..., 'url': ..., 'content': ..., 'snippet': ...}]
    """
    search_results = search_ddg(query, num_results=max_pages + 2)
    
    # Filter search results first to get valid URLs to scrape
    valid_results = [
        res for res in search_results
        if not res["url"].lower().endswith((".pdf", ".doc", ".docx", ".zip"))
    ][:max_pages]
    
    if not valid_results:
        return []
        
    logger.info(f"Scraping {len(valid_results)} pages in parallel...")
    
    # Run scraping in a thread pool to avoid sequential HTTP blocking
    with ThreadPoolExecutor(max_workers=len(valid_results)) as executor:
        contents = list(executor.map(lambda res: scrape_page_content(res["url"]), valid_results))
        
    scraped_data = []
    for res, content in zip(valid_results, contents):
        if len(content) > 200:
            scraped_data.append({
                "title": res["title"],
                "url": res["url"],
                "content": content,
                "snippet": res["snippet"]
            })
        else:
            # Fallback to snippet if scraping fails or is blocked
            scraped_data.append({
                "title": res["title"],
                "url": res["url"],
                "content": res["snippet"],
                "snippet": res["snippet"]
            })
            
    return scraped_data


if __name__ == "__main__":
    # Quick debug
    print("Testing DDG Search...")
    res = get_web_context("Adenoid cystic carcinoma latest treatments 2026", max_pages=2)
    for r in res:
        print(f"Title: {r['title']}")
        print(f"URL: {r['url']}")
        print(f"Snippet: {r['snippet']}")
        print(f"Content Length: {len(r['content'])}")
        print("---")
