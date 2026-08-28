const fs = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");

const CACHE_DIR = path.join(__dirname, "..", "cache");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

const USER_AGENT = "FlyRank-Week5-Scraper/1.0 (educational assignment)";
const REQUEST_TIMEOUT_MS = 10000;
const MIN_REQUEST_INTERVAL_MS = 500;

let lastRequestAt = 0;

async function ensureDirectories() {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function cacheFileName(url) {
    const encoded = Buffer.from(url).toString("base64url");
    return path.join(CACHE_DIR, `${encoded}.html`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPoliteness() {
    const elapsed = Date.now() - lastRequestAt;

    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
    }
}

async function fetchHtml(url) {
    await ensureDirectories();

    const cachePath = cacheFileName(url);

    try {
        const cachedHtml = await fs.readFile(cachePath, "utf8");

        console.log(`[CACHE] ${url}`);

        return {
            url,
            html: cachedHtml,
            cached: true
        };
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    await waitForPoliteness();

    const startedAt = Date.now();

    console.log(`[FETCH] ${url}`);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT
            },
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status} ${response.statusText}`
            );
        }

        const html = await response.text();

        await fs.writeFile(cachePath, html, "utf8");

        lastRequestAt = Date.now();

        console.log(
            `[FETCHED] ${url} (${Date.now() - startedAt} ms)`
        );

        return {
            url,
            html,
            cached: false
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function discoverCataloguePages(startUrl, pageLimit = 3) {
    const pages = [];
    let currentUrl = startUrl;

    while (currentUrl && pages.length < pageLimit) {
        const result = await fetchHtml(currentUrl);
        const $ = cheerio.load(result.html);

        pages.push(currentUrl);

        const nextHref = $("li.next a").attr("href");

        if (!nextHref) {
            currentUrl = null;
            break;
        }

        currentUrl = new URL(nextHref, currentUrl).href;
    }

    return pages;
}

async function discoverBookUrls(cataloguePages) {
    const bookUrls = new Set();

    for (const pageUrl of cataloguePages) {
        const result = await fetchHtml(pageUrl);
        const $ = cheerio.load(result.html);

        $("article.product_pod h3 a").each((index, element) => {
            const href = $(element).attr("href");

            if (href) {
                const bookUrl = new URL(href, pageUrl).href;
                bookUrls.add(bookUrl);
            }
        });
    }

    return [...bookUrls];
}

async function saveBookUrls(bookUrls) {
    await ensureDirectories();

    const outputPath = path.join(OUTPUT_DIR, "book-urls.json");

    await fs.writeFile(
        outputPath,
        JSON.stringify(bookUrls, null, 2),
        "utf8"
    );

    return outputPath;
}

async function main() {
    const startUrl = "https://books.toscrape.com/";

    console.log("Discovering catalogue pages...");

    const cataloguePages = await discoverCataloguePages(startUrl, 3);

    console.log("Catalogue pages:");

    for (const pageUrl of cataloguePages) {
        console.log(`- ${pageUrl}`);
    }

    if (cataloguePages.length !== 3) {
        throw new Error(
            `Expected 3 catalogue pages, found ${cataloguePages.length}`
        );
    }

    console.log("Discovering book URLs...");

    const bookUrls = await discoverBookUrls(cataloguePages);

    console.log(`Discovered ${bookUrls.length} unique book URLs.`);

    if (bookUrls.length !== 60) {
        throw new Error(
            `Expected 60 unique book URLs, found ${bookUrls.length}`
        );
    }

    const outputPath = await saveBookUrls(bookUrls);

    console.log(`Saved book URLs to ${outputPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error("Stage 2 failed:", error);
        process.exit(1);
    });
}

module.exports = {
    fetchHtml,
    discoverCataloguePages,
    discoverBookUrls
};