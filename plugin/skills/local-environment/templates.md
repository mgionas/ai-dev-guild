# Templates for the local-environment skill

Starting points to copy and adapt. Replace `<project>` and each `<…-port>` placeholder; every port
comes from the project's ports table, never from here. Image tags were checked on 2026-11-12
against the registries (`docker manifest inspect`); check them again before you rely on them, and
pin the exact tag you use.

## Compose file (`docker-compose.yml`)

```yaml
# Every name is written out, so none depends on the folder the checkout sits in.
name: <project>

services:
  database:
    image: postgres:17.6-alpine
    container_name: <project>-database
    environment:
      POSTGRES_USER: <project>
      POSTGRES_PASSWORD: <dev-only-password>
      POSTGRES_DB: <project>
    ports:
      # Loopback only: the password above is in the repository.
      - '127.0.0.1:<database-port>:5432'
    volumes:
      - <project>-database-data:/var/lib/postgresql/data
    networks:
      - <project>-local
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U <project> -d <project>']
      interval: 5s
      timeout: 5s
      retries: 10

  proxy:
    image: caddy:2.11.4-alpine
    container_name: <project>-proxy
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      # Holds the local certificate authority. Losing it means a new root, and the one you
      # trusted stops matching.
      - <project>-proxy-data:/data
    ports:
      # Ports below 1024 are refused to a non-root process on macOS, so the proxy runs here.
      - '127.0.0.1:80:80'
      - '127.0.0.1:443:443'
    extra_hosts:
      # Docker Engine on Linux does not resolve this name by itself; Docker Desktop does.
      - 'host.docker.internal:host-gateway'
    networks:
      - <project>-local

  # Optional: start with `docker compose --profile telemetry up -d`.
  telemetry:
    image: grafana/otel-lgtm:0.33.1
    container_name: <project>-telemetry
    profiles: ['telemetry']
    ports:
      # Published outside on <telemetry-ui-port>; inside it stays 3000.
      - '127.0.0.1:<telemetry-ui-port>:3000'
      - '127.0.0.1:4317:4317' # OTLP gRPC
      - '127.0.0.1:4318:4318' # OTLP HTTP
    networks:
      - <project>-local

  # Optional: an S3-compatible stand-in. It keeps nothing between restarts, so it is for fixtures.
  object-store:
    image: adobe/s3mock:5.2.3
    container_name: <project>-object-store
    profiles: ['object-store']
    environment:
      COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS: <project>-local
    ports:
      - '127.0.0.1:<object-store-port>:9090'
    networks:
      - <project>-local

# `name:` on each, or Compose prefixes the project name and the real names differ from the docs.
networks:
  <project>-local:
    name: <project>-local

volumes:
  <project>-database-data:
    name: <project>-database-data
  <project>-proxy-data:
    name: <project>-proxy-data
```

## Proxy config (`Caddyfile`)

```caddyfile
{
	# Use the proxy's own authority. No public authority issues for `.test`.
	local_certs
}

<project>.test,
app.<project>.test {
	# The app runs on the host, so the proxy leaves the Compose network to reach it.
	reverse_proxy host.docker.internal:<web-port>
}

api.<project>.test {
	reverse_proxy host.docker.internal:<api-port>
}

# A container on the same network is reached by service name and its inside port.
grafana.<project>.test {
	reverse_proxy telemetry:3000
}

# Any other hostname gets Caddy's empty 200 and is never forwarded to the app.
```

Run the hosts block below first, then `docker compose up -d`.

## Ports table (in the local-development page)

```markdown
**This table is the only place a local port is decided.** Add your row in the same change that
opens the port. Publish on `127.0.0.1` only.

| Port         | Who                       | Notes                                              |
| ------------ | ------------------------- | -------------------------------------------------- |
| `<web-port>` | web app                   | Reserved, running or not                           |
| `<api-port>` | API                       | `PORT` default in its config                       |
| `<free>`     | reserved for the next app | Allocate here before reaching for a new range      |
| `<ui-port>`  | telemetry UI              | Published on this port, listens on 3000 inside     |
| `4317/4318`  | OTLP receivers            | The OpenTelemetry defaults; keep them              |
| `<db-port>`  | database, `<project>-…`   | The database default, unless another project has it |
| `80 / 443`   | proxy, `<project>-proxy`  | `<project>.test` and its subdomains                |

Ranges: application processes, developer tooling, telemetry receivers, datastores. Name the
number range for each. Ports below 1024 belong to the proxy alone. When other projects share the
machine, list theirs here and avoid them.
```

## Hosts block (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts` on Windows)

```text
# --- <project> local development (delete this block to undo) ---
127.0.0.1 <project>.test
127.0.0.1 app.<project>.test
127.0.0.1 api.<project>.test
127.0.0.1 grafana.<project>.test
# --- end <project> ---
```

One line per name: hosts files have no wildcards. A resolver such as dnsmasq can answer for a whole
`*.<project>.test` from one rule, if the list becomes tiresome.
