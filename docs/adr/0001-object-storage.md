# 1. Object storage for photos

- **Status:** accepted
- **Date:** 2026-11-20
- **Issue:** #36 (epic #35, photos on status updates)

## Context

Workers attach photos to status updates: before and after, damage, a finished enclosure. Photos are large and binary, so they don't belong in PostgreSQL. The `Photo` table only stores the object key.

What the store has to offer:

- **EU location.** The users and the shipyards are in Germany.
- **Low cost** for a portfolio project: a small free tier, and no bill that grows every time someone views a photo.
- **Signed URLs**, so the bucket stays private. The browser uploads and downloads directly with short-lived URLs, instead of every photo passing through the API.
- **Local development** without a cloud account, and tests without a network.
- **A size limit** that the storage itself enforces, not just the browser.

## Decision

**Cloudflare R2** in production, in a bucket with **EU jurisdiction**. **RustFS** (from `docker-compose.yml`) for local development. The API talks to both through the plain S3 API (`@aws-sdk/client-s3`), wrapped in a small `StorageService`, so switching providers is a change of environment variables, not code.

**Uploads are presigned PUTs with a signed `Content-Length` and `Content-Type`:**

1. The web app asks the API for an upload URL and states the file's type and size.
2. The API refuses types it doesn't accept and sizes over the limit, then signs a PUT for exactly that size and type. The URL lives for a few minutes.
3. The browser uploads straight to the bucket. If the body has another size or type than was signed, the signature doesn't match and the store rejects it with 403. This was checked against RustFS: a 1,000-byte signature with a 5,000-byte body was refused.
4. When the photo is attached to a status update (#37), the API checks the stored object (`HeadObject`) before saving the `Photo` row.

**Downloads** are presigned GETs that also expire after a few minutes. The bucket has no public access.

## Alternatives considered

| Option | Why not |
|---|---|
| **AWS S3** (Frankfurt) | Has everything, including presigned POST. But every download is billed as egress, which grows with each photo viewed. |
| **A Railway bucket**, next to the API | Same host as the API, but a less established S3 offering, and we would be tied more closely to one host. |
| **Photos in PostgreSQL** (`bytea`) | No extra service, but it bloats the database, its backups and the nightly demo reset, and every photo goes through the API. |
| **Upload through the API** (multipart to NestJS) | Easy to enforce limits, but the API buffers every photo and the phone's upload waits on two hops. |
| **Presigned POST** with a `content-length-range` policy | The textbook way to limit size. R2 doesn't support POST uploads, and the size and type can be enforced just as well with a signed PUT (above). |
| **MinIO** locally | The usual choice, but its community edition was archived in 2026 and its images are no longer published. RustFS is a drop-in, Apache-2.0 replacement. |

## Consequences

- The API needs five new variables (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_REGION`). They are validated at startup, so the API doesn't start without them. Set them on the host **before** deploying this change (see `DEPLOYMENT.md`).
- Signing a URL is computed locally and needs no connection, so unit tests mock the S3 client and CI needs no storage service.
- The browser uploads straight to the bucket, so the bucket needs a CORS rule for the web app's origin. That is set up together with the upload UI (#38).
- The client always uses path-style URLs (`endpoint/bucket/key`). R2 accepts them, and RustFS needs them on `localhost`.
- Objects whose upload never gets attached to a status update stay in the bucket. Cleaning them up (e.g. an R2 lifecycle rule on an `uploads/` prefix) is left for later.
