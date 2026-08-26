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