# Templates for the local-environment skill

Starting points to copy and adapt. Replace `<project>` and each `<…-port>` placeholder; every port
comes from the project's ports table, never from here. Image tags were checked on 2026-11-12
against the registries (`docker manifest inspect`); check them again before you rely on them, and
pin the exact tag you use.

## Compose file (`docker-compose.yml`)

```yaml
# Names are spelled out in full, so the folder holding the checkout does not matter.
name: <project>

services:
  database:
    container_name: <project>-database
    image: postgres:17.6-alpine
    environment:
      POSTGRES_DB: <project>
      POSTGRES_USER: <project>
      POSTGRES_PASSWORD: <dev-only-password>
    ports:
      # The password above is committed, so the port must not leave this machine.
      - "127.0.0.1:<database-port>:5432"
    networks: [<project>-local]
    volumes:
      - <project>-database-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U <project> -d <project>"]
      interval: 4s
      timeout: 3s
      retries: 20

  proxy:
    container_name: <project>-proxy
    image: caddy:2.10.2-alpine
    ports:
      # On macOS a host process needs root for ports under 1024; a container does not.
      - "127.0.0.1:80:80"
      - "127.0.0.1:443:443"
    volumes:
      # The local certificate authority lives here. A new volume means a new root, and the
      # root you already trusted no longer matches.
      - <project>-proxy-data:/data
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    extra_hosts:
      # Docker Desktop answers for this name itself; Docker Engine on Linux needs the line.
      - "host.docker.internal:host-gateway"
    networks: [<project>-local]

  # Optional, off by default; the `telemetry` profile starts it.
  telemetry:
    container_name: <project>-telemetry
    image: grafana/otel-lgtm:0.33.0
    profiles: [telemetry]
    ports:
      # Remap the outside only; the UI keeps listening on 3000 in the container.
      - "127.0.0.1:<telemetry-ui-port>:3000"
      - "127.0.0.1:4317:4317" # OTLP over gRPC
      - "127.0.0.1:4318:4318" # OTLP over HTTP
    networks: [<project>-local]

  # Optional, off by default. Speaks the S3 protocol and forgets everything on restart,
  # so it suits generated fixtures only. Create the bucket from the app or the test setup.
  object-store:
    container_name: <project>-object-store
    image: adobe/s3mock:5.2.2
    profiles: [object-store]
    ports:
      - "127.0.0.1:<object-store-port>:9090"
    networks: [<project>-local]

# Give each network and volume its own `name:`. Without it Compose prepends the project
# name, and `docker volume rm <project>-database-data` would find nothing to remove.
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
	# Sign with the proxy's own authority; no public one will issue for `.test`.
	local_certs
}

<project>.test,
app.<project>.test {
	# The app is a host process, so this hop leaves the Compose network.
	reverse_proxy host.docker.internal:<web-port>
}

api.<project>.test {
	# Same idea: the API is a host process too.
	reverse_proxy host.docker.internal:<api-port>
}

# A container on the same network is addressed by service name and its inside port.
grafana.<project>.test {
	reverse_proxy telemetry:3000
}

# A hostname with no block here is answered by the proxy itself and never reaches the app.
```

Add the hosts block below, then `docker compose up -d`.

## Ports table (in the local-development page)

```markdown
**This table is the single source of truth for local ports.** The commit that opens a port adds
its row. Bind to loopback (`127.0.0.1`) only.

| Port         | Who                       | Notes                                              |
| ------------ | ------------------------- | -------------------------------------------------- |
| `<web-port>` | web app                   | Reserved, running or not                           |
| `<api-port>` | API                       | `PORT` default in its config                       |
| `<free>`     | reserved for the next app | Take it before opening a new range                 |
| `<ui-port>`  | telemetry UI              | Published on this port, listens on 3000 inside     |
| `4317/4318`  | OTLP receivers            | The OpenTelemetry defaults; keep them              |
| `<db-port>`  | database, `<project>-…`   | The database default, unless another project has it |
| `80 / 443`   | proxy, `<project>-proxy`  | `<project>.test` and its subdomains                |

Ranges: application processes, developer tooling, telemetry receivers, datastores. Name the
number range for each. The proxy alone uses ports under 1024. When other projects share the
machine, list theirs here and avoid them.
```

## Hosts block (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts` on Windows)

```text
# --- <project> local setup (remove this block to undo it) ---
127.0.0.1 <project>.test # bare domain
127.0.0.1 app.<project>.test # web app
127.0.0.1 grafana.<project>.test # telemetry UI
127.0.0.1 api.<project>.test # API
# --- end <project> ---
```

One line per name: hosts files have no wildcards. A resolver such as dnsmasq can answer for a whole
`*.<project>.test` from one rule, if the list becomes tiresome.
