---
name: local-environment
description: "Advise how a project's local development environment could be set up and written down: its own named container group, local HTTPS on a .test domain, one ports registry, a wiki and API reference where there is an API, local telemetry with dashboards kept in the repository, fake message providers locally with real ones only from staging, and one shared proxy when several projects share a machine. Use it for a new project, a project with no written local setup, or two projects clashing on one machine. It advises; the project's owner decides."
---

**This skill advises. Nothing here is required.** A project may keep a simpler setup, or none, and
that is the owner's call. Offer each point with its reason, write only what the user says yes to,
and never rewrite a setup that already works.

The templates (a compose file, a proxy config, a ports table, a hosts block) are in `templates.md`
in this skill's folder.

## What to advise

1. **A container group of its own per project** (Docker Compose). Name the project in the file
   (`name: <project>`), the containers `<project>-<service>` and the volumes
   `<project>-<service>-data`, and write every name out. Compose otherwise derives names from the
   folder, so two checkouts of one project, or two projects with a folder called `app`, share
   containers and volumes without anyone choosing that. Name services by their role (`database`,
   `proxy`, and optional ones such as `telemetry` or `object-store`), not by the image behind them,
   so the image can change without renaming anything. The proxy belongs in this group only while
   the project is alone on the machine; see "Several projects on one machine" below. Bind every
   published port to `127.0.0.1`:
   a development password is usually in the repository, and the machine is often on a network.
2. **Local HTTPS on a `.test` domain.** Most browsers treat `localhost` as a secure
   context, so it covers a lot. It falls short on subdomains, on sign-in providers that require a
   real hostname over HTTPS, on cookies scoped to a parent domain, and on matching the shape of
   production. RFC 6761 reserves `.test` and no public authority will issue for
   it, so it never collides with a real site. It takes a block in the hosts file (one line per
   name, because hosts files have no wildcards; editing it needs administrator rights), a reverse proxy that issues local certificates
   (for example Caddy with `local_certs`), and a one-time step that makes the machine trust the
   local certificate authority the proxy creates. Keep that authority in a named volume: if it is recreated,
   the one the developer trusted stops matching.
3. **A ports registry.** One table in the project's local-development page, the single source of
   truth for ports. A table that lags behind the code is worse than none, so the commit that
   opens a port also adds its row. Group ports in ranges (application processes,
   developer tooling, telemetry, datastores) so a newcomer can see where a service belongs. When several
   projects share one machine and one proxy, the shared registry takes this role (see "Several
   projects on one machine"), and the project's page points to it and names its own range.
4. **A wiki and an API reference**, when the project has an API. Advise them as part of the same
   page set: the wiki for what people need to do and understand, the reference generated from the
   code or the contract (an OpenAPI document, for instance) and never typed by hand, so it cannot
   drift. Serving the reference on its own `.test` hostname makes it part of the local setup.
5. **A supervisor that says which version it runs.** A long-running dev supervisor, one that
   follows a branch and restarts the programs it runs, picks up their new code but keeps running
   its own old code. A change to the supervisor itself can then sit unused for days with nothing
   to show it. Have it print its own commit when it starts, or restart itself when its own files
   change.
6. **Local telemetry, one stack per project.** One all-in-one container (Grafana with logs,
   traces and metrics behind it) under an optional profile, on its own `grafana.<project>.test`
   host. Give each project its own rather than sharing one across projects: data, dashboards
   and restarts then stay apart, and wiping one project's data never touches another's. Its
   UI and OTLP ports go in the registry like any other: two projects both publishing the
   OpenTelemetry defaults (4317, 4318) cannot run at once, so the second remaps the outside.
   - **Start telemetry only when an endpoint is set.** The app's tracing setup does nothing
     unless the standard `OTEL_EXPORTER_OTLP_ENDPOINT` variable is set, so a developer without
     the container, and every test run, pays nothing. Load it before the app's own code (Node's
     `--import`, for example), or the libraries it should trace are already loaded unpatched.
   - **Tag every span with the environment** (`deployment.environment.name`), read from the
     same variable that decides everything else about the environment, so local, staging and
     production data never mix on a dashboard. Set it in code from that variable, or with
     `OTEL_RESOURCE_ATTRIBUTES`. Older SDKs and dashboards use `deployment.environment`; query
     the key your SDK writes.
   - **Scrub before export, not in the dashboard.** Client addresses, request bodies and
     headers, error messages and SQL parameters can all carry personal data or secrets. Strip
     them in the app, where every exporter benefits, and test the scrubbers.
   - **Logs as one JSON line per entry on standard output.** In production the platform
     collects them. Locally, a small forwarder can send them to the container's log store;
     give it a batch size, a bounded queue that drops the oldest, and a short timeout, so a
     stopped container never slows the app. Parse the JSON after any prefix the runner adds
     (`[api] {…}`), or every line arrives as raw text.
   - **Export only what the dashboards read.** A project that builds its dashboards on traces
     can turn the metrics and logs exporters off (`OTEL_METRICS_EXPORTER=none`,
     `OTEL_LOGS_EXPORTER=none`) and derive request rates and durations from spans.
7. **Dashboards kept in the repository.** Dashboard JSON files and a provider file in a
   `grafana/` folder, mounted read-only into the container, with UI edits switched off
   (`allowUiUpdates: false`). An edit made in the browser is otherwise lost at the next
   recreate, or kept on one machine only. Mount the provider over the image's own provider
   file to drop the stock dashboards. Grafana rereads the dashboards folder every few seconds,
   so an edited or added dashboard file shows without a restart. The provider file is read at
   start only: a change to it, or a new mount, needs the container recreated, and if it has no
   data volume that also wipes the collected data. The page should say so.
8. **Fake message providers locally, real ones only from staging.** Every outside provider
   that sends something to a person (text messages, email, push) gets a fake chosen by
   configuration. The fake writes one JSON line per message (time, recipient, text) to a file
   the configuration names: the delivery log, which a developer or an end-to-end test reads
   instead of a phone. A fixed sign-in code, allowed in development only, saves reading even
   that. Staging uses the providers' sandbox or test accounts; production the real ones.
   - **Refuse to start with a fake outside development.** At boot, check that the environment
     is development, and that the runtime is not in production mode, before accepting any
     fake provider or the fixed code; otherwise stop with a message naming the environment.
     Check both, so one wrong variable is not enough. Fail closed at every step: an unknown or
     missing environment name counts as not development, and nothing else in the app may
     default a missing one to development; an unknown or empty provider name stops the start
     rather than falling back to the fake; an empty fixed code still counts as set. Every
     process that builds providers (API, worker, scripts) calls the same check. Test the
     guard, and break it once to see the test fail.
   - **Name it a fake everywhere.** The provider's name in configuration, logs and the
     delivery log says fake, so nobody mistakes a log line for a message that went out.
9. **A strict content security policy, loosened only for the dev server.** A policy with a
   nonce and no `'unsafe-inline'` blocks the inline styles a framework's dev overlay injects, so
   the overlay renders broken in development. Some frameworks' development builds also call
   `eval()`, which a policy without `'unsafe-eval'` refuses. Loosen only the directives that need
   it, and only when the runtime mode is exactly development (`NODE_ENV === 'development'`,
   strict equality). Read the mode the framework's own dev command sets, never a separate flag
   that a deployed environment could also switch on, and decide it on the server where the policy
   header is built. Any other value, unset included, keeps the strict policy, so it fails closed.
   - **Styles:** in the loosened style directive write `'unsafe-inline'` and drop the nonce and
     any hash. Current browsers ignore `'unsafe-inline'` when a nonce or hash is in the same
     directive, and a nonce never covers `style=""` attributes anyway.
   - **`eval()`:** only if a development build needs it, add `'unsafe-eval'` to the script
     directive and keep its nonce and `'strict-dynamic'`. A nonce does not cancel
     `'unsafe-eval'`.
   - **Test it:** a non-development value returns the strict header; break the check once to see
     the test fail.
   - Staging and production run a production build, never the dev server, so the loosening
     cannot reach them. Write that rule in the local-development page.

## What to write down

A local-development page, linked from `AGENTS.md`, holding:

- the start and stop commands, and what `down -v` deletes (the database, and the certificate
  authority with it, unless the proxy is shared and its authority lives in the shared folder);
- how to run the end-to-end tests, with every switch they need that is off by default (a feature
  flag that holds back outgoing messages, say). A first run that fails on configuration alone costs
  more than the line that would have prevented it;
- what a database reset wipes, including data the owner made by hand, so that an agent asking for
  a reset can say so first and remind the owner afterwards what to recreate;
- the ports table (or, with a shared proxy, a pointer to the shared registry and the project's
  range), and the three rules under it: add the row with the commit that opens the port, bind to
  loopback (`127.0.0.1`) only, and remap the outside of a container port rather than the inside;
- the hosts block, with a comment line at each end so it can be removed cleanly;
- the certificate-trust step for each operating system the team uses (see below);
- a short "when something looks wrong" list: a browser warning (authority not trusted, or recreated
  after a volume was deleted), a handshake that fails outright (hostname missing from the proxy
  config, or from the project's sites file when the proxy is shared), a hostname that does not
  resolve (hosts block missing), and a proxy dial error (the dev
  server listens only on loopback, so a proxy in a container cannot reach it). Where the project
  has them, add: a dashboard that still does not show after a minute (check its JSON is valid
  and its folder is mounted; a changed provider file needs the container recreated), a new
  mount a container ignores (`restart` keeps the old mounts; `up -d` recreates the container
  with the new ones), and a blank page with no error (when a certificate already covers the
  name, Caddy answers a hostname it has no block for with an empty 200, which looks like
  success; with no certificate, the handshake fails as above);
- the telemetry start command, the dashboards folder, and the variables that switch tracing on;
- where the delivery log is, the fixed sign-in code's variable, and the test accounts to use.

### Trusting the local certificate authority

Copy the root certificate out of the proxy's container once, then trust it. The path below is
Caddy's; another proxy keeps its own. With a shared proxy, the container is `<shared>-proxy`.

```
docker cp <project>-proxy:/data/caddy/pki/authorities/local/root.crt ./root.crt
```

Where Caddy runs on the host instead of in a container, `caddy trust` does the copy and the
trusting in one step.

- **macOS:** `sudo security add-trusted-cert -k /Library/Keychains/System.keychain -r trustRoot root.crt`.
- **Linux:** copy it to `/usr/local/share/ca-certificates/<project>.crt` and run
  `sudo update-ca-certificates` (Debian and Ubuntu); Fedora and similar use
  `/etc/pki/ca-trust/source/anchors/` and `sudo update-ca-trust`.
- **Windows:** in an administrator PowerShell,
  `Import-Certificate -FilePath root.crt -CertStoreLocation Cert:\LocalMachine\Root`.
- **Firefox** keeps its own store on every system: import the file under Settings, Privacy and
  Security, Certificates, or enable `security.enterprise_roots.enabled` in `about:config`.

Say plainly what this does, and how to undo it: the machine will believe any certificate that authority signs, for any
hostname. So the authority's key stays in its volume. Nobody commits the root file or passes it around:
every developer trusts the one their own machine generated.

To undo the trust, remove the certificate again:

- **macOS:** `sudo security delete-certificate -c "Caddy Local Authority" /Library/Keychains/System.keychain`
  (add `-Z <sha1>` when several roots carry that name).
- **Linux:** delete the file you copied, then `sudo update-ca-certificates --fresh` (Debian and
  Ubuntu) or `sudo update-ca-trust` (Fedora and similar).
- **Windows:** in an administrator PowerShell,
  `Get-ChildItem Cert:\LocalMachine\Root | Where-Object Subject -like '*Caddy Local*' | Remove-Item`.
- **Firefox:** remove the imported entry under Certificates, or switch the setting back.

## Several projects on one machine

Only one proxy can hold ports 80 and 443. When a second project arrives on a machine that already
runs one, move the proxy and the ports registry out of both projects into a small folder that
belongs to neither, best its own git repository so every change shows in a diff. A project alone
on its machine keeps the setup above. The templates are under "Shared proxy" in `templates.md`.

- **What the folder holds.** One compose file with one proxy container on `127.0.0.1:80` and
  `:443` and no project's network; the main proxy config (local certificates, an import of
  `sites/*`, and the answer every unknown host gets); one sites file per project; the one ports
  registry, with a number range per project, which replaces each project's own table as the place
  a port is decided; and a short README: start, hosts lines, certificate trust, validate and
  reload, adding a project. Each project's own data services (database, object store, telemetry)
  stay in its own container group.
- **Every upstream is a host port**, reached through `host.docker.internal`, a telemetry UI
  included. Never a container name: that needs the proxy on the project's network, and a network
  that does not exist yet stops the proxy from starting, so one project being down takes every
  project's addresses down. Never `127.0.0.1` either: inside the proxy's container that is the
  container itself.
- **On Linux, `host.docker.internal` does not reach a port bound to `127.0.0.1`.** Docker
  Desktop (macOS, Windows) forwards it to the host's loopback; Docker Engine on Linux resolves it
  to the bridge gateway, where a loopback-only port is closed, and the proxy answers 502. On
  Linux, run the proxy with `network_mode: host` and use `127.0.0.1:<port>` upstreams instead.
  Host mode drops the compose file's `127.0.0.1` port bindings, so add `default_bind 127.0.0.1`
  to the main config's global options, or the proxy listens on every interface.
  Widening a bind to every interface would expose development passwords to the network, so that
  is the owner's decision, never an agent's fix for a 502.
- **Who owns what.** The compose file, the main config and the list of ranges belong to the
  owner. A project's agent edits only its own sites file and its own rows in the registry. The
  answer for unknown hosts sits in the main config, never in a project's file, because it decides
  what every project's missing or misspelt host gets.
- **Check every edit before it reaches the proxy.** One bad sites file refuses the whole config,
  for every project. A sites file names only `<project>.test` and its subdomains, and no host
  appears in two files (Caddy refuses a duplicate as an "ambiguous site definition"). Validate the
  full config in a throwaway container of the same image, then reload the running proxy. Never
  restart it: a failed reload keeps the old config serving, while a restart with a bad config
  leaves every project with no proxy at all. Validation checks syntax and duplicates, not
  upstreams: after the reload, `curl -sI` the project's own hosts.
- **Agents never stop or recreate the shared proxy, and never start a second one.** When Docker
  refuses port 443, that is the shared proxy doing its job; it is not something to fix by
  stopping it. Put this in each project's rules about containers an agent did not start. A change
  to the compose file itself (a new image, a new mount) needs a recreate; the owner does that,
  after validating, and expects a short gap for every project.
- **Adding a project:** claim a range in the registry first, in its own commit; then add the
  sites file and the hosts block, validate and reload. The new project's compose file has no
  proxy service.

### Moving an existing proxy out

Plan for a gap of about a minute, with the owner present for the hosts lines and the trust step.

1. Build the shared folder (compose file, main config, every project's sites file, the registry)
   and validate it. Merge every project's existing ports into the shared registry and check that
   no port appears twice: moving is when ports collide.
2. Copy the root certificate out of the old proxy (as under "Trusting the local certificate
   authority") and keep it as `old-root.crt`: the check in step 4 compares against it.
3. Stop the old proxy (`docker compose stop proxy`, never `down -v`). While it is stopped, copy
   its data volume into a new, empty one with a neutral name, so the certificate authority moves
   with it. Copy from **one** project's volume only, the one whose root the machine trusts, and
   check first that the target is empty: a second copy, or a shared proxy started once before,
   overwrites the root and every address stops matching. Another project that had its own proxy
   does not copy; its old root stays trusted until someone removes it.
4. Start the shared proxy on the new volume and check that it serves the same root: compare
   `openssl x509 -noout -fingerprint -sha256 -in` on `old-root.crt` and on the root copied out
   of the new proxy, then `curl -sI --cacert old-root.crt https://<project>.test`. The machine's
   trust then holds without trusting anything again.
5. Check every host of every project, in a browser and with `curl -sI`.
6. Only then remove the proxy service from each project and point its local-development page to
   the shared folder.

Keep the old volume, and the old proxy service on a branch or commented out, until every
project's addresses have worked through the new proxy for a while; deleting them is a later step
for the owner. **Rollback:** stop the shared proxy and start the old one, which still has the
same volume and the same root. It works only while that volume and that service exist.

## How to check for a clash

Before choosing a port, and when something fails to start, ask what is already listening.

- **macOS and Linux:** `lsof -nP -iTCP -sTCP:LISTEN` (or `ss -ltnp` on Linux); add `sudo` to see
  other users' processes.
- **Windows (PowerShell):** `Get-NetTCPConnection -State Listen | Sort-Object LocalPort`, or
  `netstat -ano | findstr LISTENING`.
- **Containers on every system:** `docker ps --format '{{.Names}}\t{{.Ports}}'`.

Then read the other projects' registries on the same machine and pick a port none of them uses.
A port that merely looked free today is not a decision.

## What not to do

- **Bind to all interfaces** (`"5432:5432"`). Write the loopback address in front: `"127.0.0.1:5432:5432"`.
- **Depend on the folder name.** Name the project, containers, volumes and network explicitly.
- **Decide a port anywhere but the registry**: not in a script, a compose file or a chat message
  first. The registry is edited first, and the rest reads from it.
- **Commit the certificate authority's key or root file**, or put a real credential in the compose
  file. Development-only passwords are fine in it and nowhere else.
- **Share one telemetry stack between projects**, or edit a dashboard in the browser and expect
  it to stay.
- **Let a fake provider decide for itself whether it may run.** The check lives at boot, in one
  place, and refuses; a fake that only logs a warning outside development has already failed.
- **Put a catch-all, or another project's host, in a project's sites file.** The first decides
  for every project; the second refuses the whole config.
- **Loosen the content security policy by a separate setting a deployed environment can carry.**
  Key it to the mode the dev command sets.
- **Keep the nonce beside `'unsafe-inline'`.** The browser then ignores `'unsafe-inline'`, and
  the loosening does nothing.
- **Create any of this unasked.** If the project has a setup that works, leave it; mention the
  gaps and let the owner choose.
