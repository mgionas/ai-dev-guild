---
name: stack-advice
description: Help a newcomer choose a stack and online services for their project — a few plain questions, then a written proposal per layer (hosting, database, auth, storage, email, payments, monitoring, CI, previews) with current free tiers checked online, regions, lock-in, monthly cost and how to build and test. Use when a project has no stack yet, or before adding a hosted service.
argument-hint: "<what you want to build, in your own words>"
---

The project: $ARGUMENTS

People new to building often stall before the first line of code: which host, which database, how
to test without breaking anything? This skill turns a plain description into a short, sourced
proposal the user can accept or change. It advises; the user decides and signs up themselves.

## 1. Ask what you need, once

Read the description and anything already in the repository. Then ask only what is missing, in
one round of at most four multiple-choice questions, each with a sensible default:

- **What it is and who uses it**: a website, a web app, a mobile app with an API, an internal tool.
- **Where the users are**: a country or region. It decides server regions, privacy law and which
  payment providers are available.
- **Budget to start**: free only, a small monthly amount, or not a concern yet.
- **Who builds it**: experience with code, and which languages they already know.

Also note, if the description says so: personal or sensitive data, payments, file uploads, email
or SMS, expected size. Never ask for names, keys or account details.

## 2. Brief the advisor

Write `.work/stack/brief.md`: the description in the user's words, their answers, what is already
chosen, **today's date** (the advisor dates every price with it), and the output path
(`docs/stack.md`). No personal data goes in the brief. Dispatch the `stack-advisor` agent with that path.

## 3. Read the proposal before the user does

Send it back once if it:

- quotes a price, a free-tier limit or a region without a link and a date;
- has a layer with no alternative;
- skips how to test (preview per change, database branches, staging with fake data);
- uses a payment provider or a region without checking it for the user's country;
- does not say, per service, where the data is stored and whether that fits the privacy law of
  the users' country;
- does not explain each layer in one plain sentence a newcomer understands;
- adds a layer the project does not need yet.

## 4. Let the user decide

Show the proposal's table and its cost lines, then ask the decisions as one batch
(`decision-batch`): "Accept all" or change some. Write the accepted choices into the Stack section
of `AGENTS.md` with exact versions where they apply, and add a decision log entry with the date.

You and the advisor never sign up for anything, never see or handle keys, and never copy
production data into a test environment. The user creates every account and enters every key
themselves. Keys go into the provider's
secret store or a local `.env` file that is never committed, never into chat.

## Examples of what it may suggest

These are examples of categories, not endorsements and not a full list; they lean towards web
projects and imply no language. The advisor checks current terms every time and always gives an
alternative.

| Layer | What it means | Examples |
| --- | --- | --- |
| Web hosting with a preview per change | where the site runs; every change gets its own test link | Vercel, Netlify, Cloudflare Workers (static assets) |
| Functions near users, CDN, DNS, file storage | small server code run close to users; fast delivery of files; your domain name; uploaded files | Cloudflare (Workers, R2), AWS (Lambda, CloudFront, S3) |
| PostgreSQL with a branch per preview | the database, with a throwaway copy for each test link | Neon, Supabase |
| Containers and long-running servers | for code that must keep running, like workers and queues | Fly.io, Render, Railway |
| Sign-in (auth) | accounts, passwords, sign-in with other services | your framework's own library, Better Auth, Clerk, Supabase Auth |
| Email | sending sign-up and notification emails | Resend, Postmark, Amazon SES |
| Payments | taking money from customers | a provider that supports the business's and the customers' countries, checked by name |
| Errors and monitoring | being told when something breaks | Sentry, Grafana Cloud |
| CI | running the tests on every change | GitHub Actions, GitLab CI |
