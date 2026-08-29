const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");
const { z } = require("zod");

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

    if (encoded.length > 150) {
        const hash = crypto
            .createHash("sha256")
            .update(url)
            .digest("hex");

        return path.join(CACHE_DIR, `${hash}.html`);
    }

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

        await fs.mkdir(CACHE_DIR, { recursive: true });
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

function extractBookDetails(html, productUrl, sourcePage) {
    const $ = cheerio.load(html);

    const title = $("div.product_main h1").text().trim();

    const priceText = $("p.price_color").first().text().trim();

    const availabilityText = $("p.availability").first().text().replace(/\s+/g, " ").trim();

    const ratingText = $("p.star-rating").first().attr("class") || "";

    const description = $("#product_description")
        .next("p")
        .text()
        .trim();

    return {
        title,
        product_url: productUrl,
        price_text: priceText,
        availability_text: availabilityText,
        rating_text: ratingText,
        description,
        source_page: sourcePage,
        fetched_at: new Date().toISOString()
    };
}

async function extractAllBooks(bookUrls, sourcePage) {
    const books = [];

    for (let index = 0; index < bookUrls.length; index++) {
        const productUrl = bookUrls[index];

        console.log(
            `Extracting book ${index + 1}/${bookUrls.length}`
        );

        const result = await fetchHtml(productUrl);

        const book = extractBookDetails(
            result.html,
            productUrl,
            sourcePage
        );

        books.push(book);
    }

    return books;
}

function normalizeBook(book) {
    const priceMatch = book.price_text.match(/£\s*([0-9]+(?:\.[0-9]+)?)/);

    const price_gbp = priceMatch
        ? Number(priceMatch[1])
        : null;

    return {
        ...book,
        price_gbp
    };
}

const bookSchema = z.object({
    title: z.string().min(1),
    product_url: z.string().url().startsWith("https://"),
    price_text: z.string().min(1),
    price_gbp: z.number().nonnegative(),
    availability_text: z.string().min(1),
    rating_text: z.string().min(1),
    description: z.string(),
    source_page: z.string().url().startsWith("https://"),
    fetched_at: z.string().datetime()
});

function validateBooks(books) {
    const validBooks = [];
    const errors = [];

    for (const book of books) {
        const normalized = normalizeBook(book);

        const result = bookSchema.safeParse(normalized);

        if (result.success) {
            validBooks.push(result.data);
        } else {
            errors.push({
                record: normalized,
                reason: result.error.issues
                    .map(issue => `${issue.path.join(".")}: ${issue.message}`)
                    .join("; ")
            });
        }
    }

    return {
        validBooks,
        errors
    };
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

async function saveBooks(books) {
    await ensureDirectories();

    const outputPath = path.join(OUTPUT_DIR, "books.json");

    await fs.writeFile(
        outputPath,
        JSON.stringify(books, null, 2),
        "utf8"
    );

    return outputPath;
}

async function saveErrors(errors) {
    await ensureDirectories();

    const outputPath = path.join(OUTPUT_DIR, "errors.json");

    await fs.writeFile(
        outputPath,
        JSON.stringify(errors, null, 2),
        "utf8"
    );

    return outputPath;
}

async function main() {
    const startUrl = "https://books.toscrape.com/";

    console.log("Discovering catalogue pages...");

    const cataloguePages = await discoverCataloguePages(startUrl, 3);

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

    await saveBookUrls(bookUrls);

    console.log("Extracting book details...");

    const books = await extractAllBooks(
        bookUrls,
        cataloguePages[0]
    );

    console.log(`Extracted ${books.length} books.`);

    const { validBooks, errors } = validateBooks(books);

    console.log(`Valid records: ${validBooks.length}`);
    console.log(`Invalid records: ${errors.length}`);

    const booksPath = await saveBooks(validBooks);
    const errorsPath = await saveErrors(errors);

    console.log(`Saved books to ${booksPath}`);
    console.log(`Saved errors to ${errorsPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error("Stage 3 failed:", error);
        process.exit(1);
    });
}

module.exports = {
    fetchHtml,
    discoverCataloguePages,
    discoverBookUrls,
    extractBookDetails,
    extractAllBooks
};
