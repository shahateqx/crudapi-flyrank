const express = require("express");
const swaggerUi = require("swagger-ui-express");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const swaggerDocument = require("./openapi.json");

const app = express();
const PORT = 3000;

app.use(express.json());
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            done BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS books (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            product_url TEXT NOT NULL UNIQUE,
            price_text TEXT NOT NULL,
            price_gbp NUMERIC(10, 2) NOT NULL,
            availability_text TEXT NOT NULL,
            rating_text TEXT NOT NULL,
            description TEXT,
            source_page TEXT NOT NULL,
            fetched_at TIMESTAMPTZ NOT NULL
        )
    `);

    const result = await pool.query("SELECT COUNT(*) FROM tasks");

    if (Number(result.rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO tasks (title, done)
            VALUES
                ($1, $2),
                ($3, $4),
                ($5, $6)
        `, [
            "Learn Express", false,
            "Build CRUD API", false,
            "Push project to GitHub", false
        ]);
    }
}

async function importBooks() {
    const fs = require("fs/promises");
    const path = require("path");

    const booksPath = path.join(
        __dirname,
        "scraper",
        "output",
        "books.json"
    );

    const file = await fs.readFile(booksPath, "utf8");
    const books = JSON.parse(file);

    console.log(`Importing ${books.length} books...`);

    for (const book of books) {
        await pool.query(
            `
            INSERT INTO books (
                title,
                product_url,
                price_text,
                price_gbp,
                availability_text,
                rating_text,
                description,
                source_page,
                fetched_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (product_url)
            DO UPDATE SET
                title = EXCLUDED.title,
                price_text = EXCLUDED.price_text,
                price_gbp = EXCLUDED.price_gbp,
                availability_text = EXCLUDED.availability_text,
                rating_text = EXCLUDED.rating_text,
                description = EXCLUDED.description,
                source_page = EXCLUDED.source_page,
                fetched_at = EXCLUDED.fetched_at
            `,
            [
                book.title,
                book.product_url,
                book.price_text,
                book.price_gbp,
                book.availability_text,
                book.rating_text,
                book.description || null,
                book.source_page,
                book.fetched_at
            ]
        );
    }

    console.log(`Imported ${books.length} books.`);
}

async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Missing or invalid authorization header"
        });
    }

    const token = authHeader.substring(7);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }

    req.user = data.user;
    req.accessToken = token;

    next();
}

app.get("/", (req, res) => {
    res.json({
        name: "CRUD API",
        version: "1.0",
        endpoints: ["/tasks"]
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

app.get("/public/info", (req, res) => {
    res.json({
        message: "This is a public route"
    });
});

app.get("/protected/profile", requireAuth, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email
    });
});

app.post("/auth/signup", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        email.trim() === "" ||
        typeof password !== "string" ||
        password === ""
    ) {
        return res.status(400).json({
            error: "Email and password are required"
        });
    }

    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password
    });

    if (error) {
        return res.status(400).json({
            error: error.message
        });
    }

    res.status(201).json({
        user: data.user,
        access_token: data.session?.access_token ?? null
    });
});

app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        email.trim() === "" ||
        typeof password !== "string" ||
        password === ""
    ) {
        return res.status(400).json({
            error: "Email and password are required"
        });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
    });

    if (error) {
        return res.status(400).json({
            error: error.message
        });
    }

    res.json({
        user: data.user,
        access_token: data.session.access_token
    });
});

app.post("/auth/logout", requireAuth, async (req, res) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        return res.status(400).json({
            error: error.message
        });
    }

    res.sendStatus(204);
});

app.get("/tasks", async (req, res) => {
    const result = await pool.query("SELECT * FROM tasks");

    res.json(result.rows);
});

app.get("/books", async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = String(req.query.search || "").trim();
    const sort = String(req.query.sort || "id_asc");

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        return res.status(400).json({
            error: "Invalid page or limit"
        });
    }

    const allowedSorts = {
        id_asc: "id ASC",
        id_desc: "id DESC",
        title_asc: "title ASC",
        title_desc: "title DESC",
        price_asc: "price_gbp ASC",
        price_desc: "price_gbp DESC"
    };

    if (!allowedSorts[sort]) {
        return res.status(400).json({
            error: "Invalid sort option"
        });
    }

    const offset = (page - 1) * limit;
    const orderBy = allowedSorts[sort];

    const countResult = await pool.query(
        `
        SELECT COUNT(*)
        FROM books
        WHERE title ILIKE $1
        `,
        [`%${search}%`]
    );

    const total = Number(countResult.rows[0].count);

    const result = await pool.query(
        `
        SELECT *
        FROM books
        WHERE title ILIKE $1
        ORDER BY ${orderBy}
        LIMIT $2 OFFSET $3
        `,
        [`%${search}%`, limit, offset]
    );

    res.json({
        page,
        limit,
        total,
        search,
        sort,
        books: result.rows
    });
});

app.get("/books/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Invalid book ID"
        });
    }

    const result = await pool.query(
        "SELECT * FROM books WHERE id = $1",
        [id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            error: `Book ${id} not found`
        });
    }

    res.json(result.rows[0]);
});

app.get("/tasks/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Invalid task ID"
        });
    }

    const result = await pool.query(
        "SELECT * FROM tasks WHERE id = $1",
        [id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            error: `Task ${id} not found`
        });
    }

    res.json(result.rows[0]);
});

app.post("/tasks", async (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({
            error: "Title is required"
        });
    }

    const result = await pool.query(
        `
        INSERT INTO tasks (title, done)
        VALUES ($1, $2)
        RETURNING *
        `,
        [title.trim(), false]
    );

    res.status(201).json(result.rows[0]);
});

app.put("/tasks/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Invalid task ID"
        });
    }
    const { title, done } = req.body;

    if (
        typeof title !== "string" ||
        title.trim() === "" ||
        typeof done !== "boolean"
    ) {
        return res.status(400).json({
            error: "Title and done are required"
        });
    }

    const result = await pool.query(
        `
        UPDATE tasks
        SET title = $1, done = $2
        WHERE id = $3
        RETURNING *
        `,
        [title.trim(), done, id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            error: `Task ${id} not found`
        });
    }

    res.json(result.rows[0]);
});

app.delete("/tasks/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Invalid task ID"
        });
    }

    const result = await pool.query(
        "DELETE FROM tasks WHERE id = $1",
        [id]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({
            error: `Task ${id} not found`
        });
    }

    res.sendStatus(204);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

if (require.main === module) {
    initializeDatabase()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Server running on http://localhost:${PORT}`);
                console.log("Connected to Supabase");
            });
        })
        .catch((error) => {
            console.error("Database initialization failed:", error);
            process.exit(1);
        });
}

module.exports = {
    importBooks
};