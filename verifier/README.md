# Verifier index

This directory is independent of the application artifacts it checks. Versions are append-only; runs are recorded even when they fail.

## v1 — 2026-11-02

Measures the agreed MVP-preview acceptance criteria: required Phase 3 artifacts and Goose handoff, parseable replacement-only content templates, safe Worker names, absence of tracked secret-shaped assignments, and final validation evidence files. This is the first version, so there is no prior criteria set.

Run with `node verifier/v1/check.mjs`. Exit 0 means every static acceptance check passed. Runtime, browser, security, Cloudflare, and human checks still require their own raw evidence; a green static check is not a release approval.
