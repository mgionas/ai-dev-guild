# Templates for the local-environment skill

Starting points to copy and adapt. Replace `<project>` and each `<…-port>` placeholder; every port
comes from the project's ports table, never from here. Image tags were each the newest stable
release on 2026-11-12 (`docker manifest inspect <image>:<tag>` and the registry's tag list);
check them again before you rely on them, and pin the exact tag you use.

## Compose file (`docker-compose.yml`)

```yaml
# Names are spelled out in full, so the folder holding the checkout does not matter.
name: <project>

services:
  database:
    container_name: <project>-database
    image: postgres:17.11-alpine
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
    image: caddy:2.11.9-alpine
    ports:
      # 80 and 443 must be free on the host (another project's proxy, a local web server). To
      # remap, change the outside number; the URLs then carry that port.
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
    profiles: [telemetry]
    ports:
      # Remap the outside only; the UI keeps listening on 3000 in the container.
      - "127.0.0.1:<telemetry-ui-port>:3000"
      # The OTLP defaults are 4317 and 4318; a second project on the machine remaps the outside.
      - "127.0.0.1:<otlp-grpc-port>:4317" # OTLP over gRPC
      - "127.0.0.1:<otlp-http-port>:4318" # OTLP over HTTP
    networks: [<project>-local]
    # 0.41.0 checked on 2026-11-21: the provider path below is this version's. Read the image's
    # own provisioning folder again when you change the tag.
    image: grafana/otel-lgtm:0.41.0
    volumes:
      # Mounted over the image's own provider file, so the stock dashboards go and only the
      # repository's load. Read-only: dashboards change in the repository, not in the browser.
      - ./grafana/dashboards.yaml:/otel-lgtm/grafana/conf/provisioning/dashboards/grafana-dashboards.yaml:ro
      - ./grafana/dashboards:/<project>-dashboards:ro
    # Dashboard files reload by themselves within seconds. A changed provider file or a new
    # mount needs a recreate, and with no data volume a recreate wipes the data.

  # Optional, off by default. Speaks the S3 protocol and forgets everything on restart,
  # so it suits generated fixtures only.
  object-store:
    container_name: <project>-object-store
    image: adobe/s3mock:5.2.3
    profiles: [object-store]
    environment:
      # Creates this bucket at every start, since nothing survives a restart.
      COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS: <project>-local
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

## Dashboard provider (`grafana/dashboards.yaml`)

```yaml
apiVersion: 1

providers:
  - name: <project>
    folder: <project>
    type: file
    # Edits in the browser are refused, so the repository stays the only copy.
    allowUiUpdates: false
    options:
      path: /<project>-dashboards
```

Export a dashboard's JSON from Grafana once and save it in `grafana/dashboards/`; Grafana picks
it up within seconds. Only after changing this provider file, or adding a mount, run
`docker compose --profile telemetry up -d --force-recreate telemetry`.

## Telemetry variables (the app's local environment file)

```bash
# Unset means no tracing at all, which is what tests and a developer without the container get.
# A base endpoint: the SDK appends /v1/traces itself. A signal-specific one
# (OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) is used exactly as written.
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:<otlp-http-port>
# Some SDKs default to gRPC, which fails against the HTTP port with no clear error.
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=<project>-api
# Local file only: staging and production set their own value, or set it in code from the
# project's own environment variable.
OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=development
# Only traces are exported here; drop these two lines if the dashboards read metrics or logs.
OTEL_METRICS_EXPORTER=none
OTEL_LOGS_EXPORTER=none
```

## Fake providers and their guard (in the app's boot code)

```text
in every process that builds providers (API, worker, scripts), before it builds any:
  env      = the project's environment variable   (development | staging | production),
             read in one function that never defaults a missing value to development
  runtime  = the runtime's own production flag    (NODE_ENV=production, say)
  isDev    = env == "development" and runtime is not production
             (an unknown or missing env is not development)

  if a provider name is empty or not in the known list:
      stop: "Unknown message provider <name>"   (never fall back to the fake)
  if any provider is a fake and not isDev:
      stop: "Refusing to start in <env> with fake message providers"
  if the fixed sign-in code variable is present at all (even empty) and not isDev:
      stop: "Refusing to start in <env> with a fixed sign-in code"

fake provider, per message:
  append one JSON line to the file in the delivery-log variable:
  {"at": <time>, "provider": "fake-sms", "to": <recipient>, "text": <text>}
```

The delivery log holds the recipients and texts of test accounts only; keep it out of the
repository (`.gitignore`) like any other local data.

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

# A hostname with no block here never reaches the app. When a certificate already covers the
# name, the proxy answers it with an empty 200, so a blank page with no error usually means a
# missing block; with no certificate, the handshake fails instead.
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
| `<otlp-ports>` | OTLP receivers          | 4317/4318 by default; a second project remaps them |
| `<db-port>`  | database, `<project>-…`   | The database default, unless another project has it |
| `80 / 443`   | proxy, `<project>-proxy`  | `<project>.test` and its subdomains                |

Ranges: application processes, developer tooling, telemetry receivers, datastores. Name the
number range for each. When other projects share the machine, list theirs here and avoid them.
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

Editing this file needs administrator rights: `sudo` on macOS and Linux, an editor started as
administrator on Windows. If a name still does not resolve afterwards, flush the DNS cache
(`sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` on macOS,
`sudo resolvectl flush-caches` on Linux with systemd-resolved, `ipconfig /flushdns` on Windows) and
restart the browser, which may remember a failed lookup.

One line per name: hosts files have no wildcards. A resolver such as dnsmasq can answer for a whole
`*.<project>.test` from one rule, if the list becomes tiresome.

## Shared proxy (one folder for several projects)

For "Several projects on one machine" in the skill. The folder is named `<shared>` here (for
example `local-proxy`); it belongs to no project.

`<shared>/docker-compose.yml`:

```yaml
name: <shared>

services:
  proxy:
    container_name: <shared>-proxy
    image: caddy:2.11.9-alpine
    ports:
      - "127.0.0.1:80:80"
      - "127.0.0.1:443:443"
    volumes:
      # The certificate authority every project's addresses depend on. Copied from the old
      # project proxy's volume when moving, so the root the machine trusts stays the same.
      - <shared>-proxy-data:/data
      # The whole folder, as the validate command mounts it. A single-file mount of the
      # Caddyfile keeps the old file when an editor or git replaces it, and reload would then
      # apply the old content without an error.
      - .:/etc/caddy:ro
    extra_hosts:
      - "host.docker.internal:host-gateway"
    # No project network: every upstream is a host port, so no project has to be up for the
    # proxy to start. On Linux, loopback-only ports are not reachable this way: use
    # `network_mode: host` instead of `ports` and `extra_hosts`, and 127.0.0.1 upstreams.

volumes:
  <shared>-proxy-data:
    name: <shared>-proxy-data
```

`<shared>/Caddyfile`, the owner's:

```caddyfile
{
	local_certs
}

# One file per project; each names only <project>.test and its subdomains.
import sites/*.caddy

# What every host with no block gets, decided once for all projects. Over HTTPS such a host
# has no certificate, so the handshake fails before this is reached.
http:// {
	respond "No site for this host: check sites/ and the hosts file" 404
}
```

`<shared>/sites/<project>.caddy`, the project's own:

```caddyfile
<project>.test,
app.<project>.test {
	reverse_proxy host.docker.internal:<web-port>
}

grafana.<project>.test {
	# A host port, never a container name or 127.0.0.1.
	reverse_proxy host.docker.internal:<telemetry-ui-port>
}
```

Before every reload, check that each sites file names only its own project's hosts and that no
host appears in two files, then validate and reload:

```bash
# A throwaway container of the same image reads the whole config; nothing is served.
docker run --rm -v "$PWD":/etc/caddy:ro caddy:2.11.9-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# Only after "Valid configuration": a failed reload keeps the old config serving.
docker exec <shared>-proxy caddy reload --config /etc/caddy/Caddyfile
```

Copying the certificate authority when moving out of a project (the old proxy stopped first):

```bash
# The target must be empty; this prints nothing when it is. Anything listed means stop.
docker run --rm -v <shared>-proxy-data:/to alpine:3.24.4 ls -A /to
docker run --rm -v <project>-proxy-data:/from -v <shared>-proxy-data:/to alpine:3.24.4 \
  cp -a /from/. /to/
# After the shared proxy starts: the two fingerprints must match.
docker cp <shared>-proxy:/data/caddy/pki/authorities/local/root.crt ./new-root.crt
openssl x509 -noout -fingerprint -sha256 -in old-root.crt
openssl x509 -noout -fingerprint -sha256 -in new-root.crt
```
