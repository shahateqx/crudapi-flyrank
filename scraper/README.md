# Polite Scraper

A small scraping pipeline for the FlyRank Backend Track Week 5 Assignment A9.

## Target Classification

### Target

[Books to Scrape](https://books.toscrape.com/)

Books to Scrape is a public practice sandbox created for learning and practicing web scraping.

### Scope

This scraper will collect data from the first three catalogue pages only.

The three catalogue pages contain 60 unique books in total. The scraper will discover the book links from those catalogue pages and visit the individual book pages.

### Data Collected

For each book, the scraper will collect:

- title
- product URL
- price text
- availability text
- rating text
- description
- source page
- fetched timestamp

The data will later be normalized, validated, and stored as JSON.

### Robots Check

I requested:

https://books.toscrape.com/robots.txt

The server returned:

```text
HTTP/1.1 404 Not Found
```

Therefore:

```text
no robots file found
```

A missing robots file is not treated as permission to scrape. This assignment targets Books to Scrape because it is explicitly provided as a public practice sandbox.

### Politeness

The scraper will:

- identify itself with an honest User-Agent
- use a request timeout
- check HTTP status codes
- wait at least 500 ms between real requests
- cache downloaded HTML during development
- avoid repeatedly requesting pages that have already been cached

I will not reuse this code on another site without checking its rules and terms first.