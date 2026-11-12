---
name: local-environment
description: "Advise how a project's local development environment could be set up and written down: its own named container group, local HTTPS on a .test domain, one ports registry, and a wiki and API reference where there is an API. Use it for a new project, a project with no written local setup, or two projects clashing on one machine. It advises; the project's owner decides."
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
   so the image can change without renaming anything. Bind every published port to `127.0.0.1`:
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
   projects share one machine, each registry avoids the others' ports.
4. **A wiki and an API reference**, when the project has an API. Advise them as part of the same
   page set: the wiki for what people need to do and understand, the reference generated from the
   code or the contract (an OpenAPI document, for instance) and never typed by hand, so it cannot
   drift. Serving the reference on its own `.test` hostname makes it part of the local setup.

## What to write down

A local-development page, linked from `AGENTS.md`, holding:

- the start and stop commands, and what `down -v` deletes (the database, and the certificate
  authority with it);
- the ports table, and the three rules under it: add the row with the commit that opens the port, bind to
  loopback (`127.0.0.1`) only, and remap the outside of a container port rather than the inside;
- the hosts block, with a comment line at each end so it can be removed cleanly;
- the certificate-trust step for each operating system the team uses (see below);
- a short "when something looks wrong" list: a browser warning (authority not trusted, or recreated
  after a volume was deleted), a handshake that fails outright (hostname missing from the proxy
  config), a hostname that does not resolve (hosts block missing), and a proxy dial error (the dev
  server listens only on loopback, so a proxy in a container cannot reach it).

### Trusting the local certificate authority

Copy the root certificate out of the proxy's container once, then trust it. The path below is
Caddy's; another proxy keeps its own.

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
- **Create any of this unasked.** If the project has a setup that works, leave it; mention the
  gaps and let the owner choose.
