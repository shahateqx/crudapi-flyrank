# CRUD API

A RESTful CRUD API built with Node.js, Express.js, PostgreSQL, and Supabase Authentication.

This project is an upgrade of the previous CRUD API.

The application now includes:

- PostgreSQL database storage
- Supabase Authentication
- User signup and login
- JWT-based authentication
- Protected routes
- Reusable authentication middleware
- Logout
- Swagger UI with Bearer authentication

## Technologies

- Node.js
- Express.js
- PostgreSQL
- `pg`
- Supabase
- `@supabase/supabase-js`
- Docker
- Docker Compose
- Swagger UI
- OpenAPI 3.0

## Database

The application uses PostgreSQL for task data.

The database configuration is provided through the `DATABASE_URL` environment variable.

For local development, create a `.env` file:

    DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
    SUPABASE_URL=
    SUPABASE_KEY=
    PORT=3000

A template can be provided in:

    .env.example

The `.env` file is ignored by Git and must not be committed.

The application automatically creates the `tasks` table when it starts.

If the table is empty, the application inserts three initial tasks.

## Supabase Authentication

Supabase is used as the authentication provider.

The application supports:

- User signup
- User login
- JWT verification
- Protected user profile
- Logout

Supabase configuration is loaded from environment variables:

    SUPABASE_URL
    SUPABASE_KEY

## Running Locally

Install dependencies:

    npm install

Start the API:

    node --env-file=.env index.js

The API runs at:

    http://localhost:3000

Swagger documentation is available at:

    http://localhost:3000/docs

## Authentication Endpoints

### Signup

Create a new user:

    curl -i -X POST http://localhost:3000/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"TestPassword123!"}'

Successful response:

    HTTP/1.1 201 Created

The response contains the authenticated user information and an access token.

### Login

Log in with an existing user:

    curl -i -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"TestPassword123!"}'

Successful response:

    HTTP/1.1 200 OK

The response contains an `access_token`.

## JWT Authentication

Protected endpoints require a valid Supabase JWT.

The token must be provided using the Bearer authentication format:

    Authorization: Bearer <access_token>

Example:

    curl -i http://localhost:3000/protected/profile \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

A valid token returns the authenticated user's information.

Missing, invalid, or expired tokens return:

    HTTP/1.1 401 Unauthorized

## Public and Protected Routes

### Public Information

    GET /public/info

This endpoint does not require authentication.

### Protected Profile

    GET /protected/profile

This endpoint requires a valid Bearer token.

Example response:

    {
      "id": "user-id",
      "email": "test@example.com"
    }

## Logout

Logout requires a valid Bearer token:

    curl -i -X POST http://localhost:3000/auth/logout \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

Successful logout returns:

    HTTP/1.1 204 No Content

## API Endpoints

| Method | Endpoint | Authentication | Description |
| ------ | -------- | -------------- | ----------- |
| GET | `/` | Public | API information |
| GET | `/health` | Public | Health check |
| GET | `/public/info` | Public | Public information |
| POST | `/auth/signup` | Public | Create a new user |
| POST | `/auth/login` | Public | Log in |
| POST | `/auth/logout` | Bearer token | Log out |
| GET | `/protected/profile` | Bearer token | Get authenticated user profile |
| GET | `/tasks` | Public | Get all tasks |
| GET | `/tasks/{id}` | Public | Get task by ID |
| POST | `/tasks` | Public | Create a new task |
| PUT | `/tasks/{id}` | Public | Update an existing task |
| DELETE | `/tasks/{id}` | Public | Delete a task |

## HTTP Status Codes

| Status Code | Meaning |
| ----------- | ------- |
| 200 | Successful request |
| 201 | Resource created |
| 204 | Resource deleted or logout successful |
| 400 | Invalid request or authentication error |
| 401 | Missing, invalid, or expired authentication |
| 404 | Task not found |

## Swagger UI

Interactive API documentation is available at:

    http://localhost:3000/docs

Swagger UI includes Bearer authentication support through the **Authorize** button.

To test protected endpoints:

1. Log in through `/auth/login`.
2. Copy the returned `access_token`.
3. Click **Authorize** in Swagger UI.
4. Enter the Bearer token.
5. Execute the protected endpoint.

The protected profile endpoint should return `200 OK` when a valid token is supplied.

## Running with Docker Compose

Make sure Docker Desktop is running.

Start the complete stack:

    docker compose up --build

This starts:

- the Node.js API
- PostgreSQL

The API connects to PostgreSQL using the Compose service name:

    db

The API is available at:

    http://localhost:3000

Stop the stack with:

    docker compose down

## Project Structure

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

## Security

Sensitive configuration must be stored in environment variables.

The following files and values must not be committed to Git:

    .env
    SUPABASE_KEY
    DATABASE_URL

The `.env` file is included in `.gitignore`.

Check whether `.env` is tracked with:

    git ls-files .env

If the command produces no output, `.env` is not tracked by Git.

## Author

**Md. Shajjat Hossain Shahat**