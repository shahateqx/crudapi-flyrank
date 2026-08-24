const express = require("express");
const swaggerUi = require("swagger-ui-express");
const Database = require("better-sqlite3");
const swaggerDocument = require("./openapi.json");

const app = express();
const PORT = 3000;

app.use(express.json());

const db = new Database("tasks.db");

db.prepare(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0
    )
`).run();

const taskCount = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();

if (taskCount.count === 0) {
    const insert = db.prepare(`
        INSERT INTO tasks (title, done)
        VALUES (?, ?)
    `);

    insert.run("Learn Express", 0);
    insert.run("Build CRUD API", 0);
    insert.run("Push project to GitHub", 0);
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

app.get("/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks").all();

    res.json(
        tasks.map(task => ({
            ...task,
            done: Boolean(task.done)
        }))
    );
});

app.get("/tasks/:id", (req, res) => {
    const id = Number(req.params.id);

    const task = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(id);

    if (!task) {
        return res.status(404).json({
            error: `Task ${id} not found`
        });
    }

    res.json({
        ...task,
        done: Boolean(task.done)
    });
});

app.post("/tasks", (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({
            error: "Title is required"
        });
    }

    const result = db
        .prepare(`
            INSERT INTO tasks (title, done)
            VALUES (?, ?)
        `)
        .run(title.trim(), 0);

    const newTask = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(result.lastInsertRowid);

    res.status(201).json({
        ...newTask,
        done: Boolean(newTask.done)
    });
});

app.put("/tasks/:id", (req, res) => {
    const id = Number(req.params.id);
    const { title, done } = req.body;

    const task = tasks.find(task => task.id === id);

    if (!task) {
        return res.status(404).json({
            error: `Task ${id} not found`
        });
    }

    if (
        title === undefined ||
        title.trim() === "" ||
        typeof done !== "boolean"
    ) {
        return res.status(400).json({
            error: "Title and done are required"
        });
    }

    task.title = title;
    task.done = done;

    res.json(task);
});

app.delete("/tasks/:id", (req, res) => {
    const id = Number(req.params.id);

    const taskIndex = tasks.findIndex(task => task.id === id);

    if (taskIndex === -1) {
        return res.status(404).json({
            error: `Task ${id} not found`
        });
    }

    tasks.splice(taskIndex, 1);

    res.sendStatus(204);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});