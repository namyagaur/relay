# Relay Frontend

The Relay console is a React application built with Vite. It connects to the
project-scoped Express API in `../backend`; all API calls use the centralized
client in `src/services/api/client.js`.

## Local setup

```sh
npm install
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend API
base URL. The default local backend listens at
`http://localhost:3000/api/v1`.

```sh
npm run dev
npm run lint
npm run build
```

The dashboard accepts a Relay API key. Keys are held in browser session storage
for the active tab and sent in the `Authorization: Bearer <key>` header. They
are never added to request URLs or application logs. A project can be created
from the access screen; its initial key is displayed once.
