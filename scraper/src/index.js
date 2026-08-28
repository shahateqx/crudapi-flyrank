const fs = require("fs/promises");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "..", "cache");

const USER_AGENT = "FlyRank-Week5-Scraper/1.0 (educational assignment)";
const REQUEST_TIMEOUT_MS = 10000;
const MIN_REQUEST_INTERVAL_MS = 500;

let lastRequestAt = 0;

async function ensureCacheDirectory() {
    await fs.mkdir(CACHE_DIR, { recursive: true });
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
    await ensureCacheDirectory();

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

module.exports = {
    fetchHtml
};