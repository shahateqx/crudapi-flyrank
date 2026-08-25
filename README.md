# CRUD API

A RESTful CRUD API built with Node.js, Express.js, and PostgreSQL.

This project is an upgrade of the previous CRUD API.

The API endpoints remain the same, but task data is now stored in PostgreSQL and the application can run with Docker Compose.

## Technologies

- Node.js
- Express.js
- PostgreSQL
- `pg`
- Docker
- Docker Compose
- Swagger UI
- OpenAPI 3.0

## Database

The application uses PostgreSQL.

The database configuration is provided through the `DATABASE_URL` environment variable.

For local development, create a `.env` file:

```env
DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
```

A template is provided in:

```text
.env.example
```

The `.env` file is ignored by Git.

The application automatically creates the `tasks` table when it starts.

If the table is empty, the application inserts three initial tasks.

## Running Locally

Install dependencies:

```bash
npm install
```

Start the API:

```bash
node --env-file=.env index.js
```

The API runs at:

```text
http://localhost:3000
```

Swagger documentation is available at:

```text
http://localhost:3000/docs
```

## Running with Docker Compose

Make sure Docker Desktop is running.

Start the complete stack:

```bash
docker compose up --build
```

This starts:

* the Node.js API
* PostgreSQL

The API connects to PostgreSQL using the Compose service name:

```text
db
```

The API is available at:

```text
http://localhost:3000
```

Stop the stack with:

```bash
docker compose down
```

## API Endpoints

| Method | Endpoint      | Description             |
| ------ | ------------- | ----------------------- |
| GET    | `/`           | API information         |
| GET    | `/health`     | Health check            |
| GET    | `/tasks`      | Get all tasks           |
| GET    | `/tasks/{id}` | Get task by ID          |
| POST   | `/tasks`      | Create a new task       |
| PUT    | `/tasks/{id}` | Update an existing task |
| DELETE | `/tasks/{id}` | Delete a task           |

## Example Request

Create a new task:

```bash
curl -i -X POST http://localhost:3000/tasks \
-H "Content-Type: application/json" \
-d '{"title":"Buy milk"}'
```

Example response:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 4,
  "title": "Buy milk",
  "done": false
}
```

## HTTP Status Codes

| Status Code | Meaning                       |
| ----------- | ----------------------------- |
| 200         | Successful request            |
| 201         | Resource created              |
| 204         | Resource deleted successfully |
| 400         | Invalid request               |
| 404         | Task not found                |

## Swagger UI

Interactive API documentation is available at:

```text
http://localhost:3000/docs
```

## Project Structure

```text
crud-api/
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── compose.yaml
├── index.js
├── openapi.json
├── package.json
├── package-lock.json
└── screenshots/
```

## Author

**Md. Shajjat Hossain Shahat**