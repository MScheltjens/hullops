# Core flows

How the main flows in HullOps work, as diagrams with links to the code that implements each step. GitHub renders the [Mermaid](https://mermaid.js.org) diagrams in place.

Keep these in step with the code: a PR that changes one of these flows updates its diagram.

- [Login and auth](#login-and-auth)
- [Which vessels a user sees](#which-vessels-a-user-sees)
- [Order status](#order-status)
- [Photo upload](#photo-upload)

## Login and auth

The browser never holds the API token. The web app keeps it in an httpOnly cookie and calls the API on the server, so a script injected into the page has nothing to steal.

```mermaid
sequenceDiagram
    autonumber
    actor U as User (browser)
    participant P as proxy.ts
    participant W as Web server<br/>(Server Action, page, DAL)
    participant A as API<br/>(AuthGuard)
    participant DB as Postgres

    Note over U,DB: Log in
    U->>W: login form (Server Action)
    W->>A: mutation login(email, password)
    A->>DB: user by email, with password hash
    A-->>W: JWT and expiry<br/>(wrong password and deactivated user get the same error)
    W-->>U: Set-Cookie: session (httpOnly), redirect to /

    Note over U,DB: Every later page
    U->>P: GET /orders (cookie sent automatically)
    alt no session cookie
        P-->>U: redirect to /login
    else cookie present (not checked yet)
        P->>W: render the page
        W->>A: query me, Authorization: Bearer JWT<br/>(getCurrentUser, at most once per request)
        A->>A: verify the JWT signature and expiry
        A->>DB: user by id, still active?
        alt invalid, expired or deactivated
            A-->>W: UNAUTHENTICATED
            W-->>U: redirect to /login
        else valid
            A-->>W: user (id, name, role, locale)
            W->>A: page queries via apiAsUser, same Bearer token
            A->>A: AuthGuard again on each request: JWT, active user, @Roles
            A->>DB: query filtered by visibleVesselsWhere
            A-->>W: data
            W-->>U: HTML in the user's language
        end
    end
```

- **Two checks, on purpose.** [`proxy.ts`](../apps/web/src/proxy.ts) (Next.js 16's middleware) only checks that a cookie exists. That's cheap and catches visitors who were never logged in. The real check is in the data access layer, [`dal.ts`](../apps/web/src/lib/server/dal.ts), which asks the API who the token belongs to.
- **The API trusts no one.** The global [`AuthGuard`](../apps/api/src/auth/auth.guard.ts) runs on every request except those marked `@Public()`. It verifies the JWT and then loads the user ([`auth.service.ts`](../apps/api/src/auth/auth.service.ts)), so deactivating a user ends their sessions at once, not when the token expires. `@Roles(...)` then limits endpoints to certain roles.
- **Language.** After login the UI uses the user's `locale` setting, not the browser's.

## Which vessels a user sees

One rule decides what someone sees of the work: [`visibleVesselsWhere`](../apps/api/src/vessels/vessel-scope.ts). It returns a Prisma filter, which every query on orders, vessels, staffing and the crew plan includes. So it's one database query, and the rule can't drift apart between screens.

```mermaid
flowchart TD
    R{"Role of the user"}
    R -->|"Project lead, Admin"| ALL["All vessels"]
    R -->|"Team lead"| TL["The vessels he leads<br/>(Vessel.teamLeadId)"]
    R -->|"Worker"| WK["The vessels he is planned on<br/>this week or next week<br/>(CrewAssignment)"]
    R -->|"HR, or a role added later"| NONE["No vessels<br/>(HR manages people, not the work)"]

    ALL --> Q["Applied as a filter inside the<br/>orders, vessels, staffing and crew plan queries"]
    TL --> Q
    WK --> Q
    NONE --> Q
    Q --> OUT["Out of sight: null or an empty list,<br/>the same as if it didn't exist"]
```

- **Out of sight looks like missing.** An order on a vessel you can't see gives the same answer as an order that doesn't exist, never a "forbidden". So the API doesn't reveal what exists elsewhere.
- **The worker's window moves on its own.** The project lead's weekly crew plan decides it, so a worker sees next week's vessel as soon as he is planned there, and loses last week's without anyone changing a setting.
- **Safe default.** The `switch` ends with "no vessels", so a new role sees nothing until someone decides what it should see.

## Order status

An order moves forward one step at a time. Each status update is kept as history (`StatusUpdate`), with an optional note and photos.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> PLANNED: order created
    PLANNED --> IN_PROGRESS: work started
    IN_PROGRESS --> DONE: work finished
    PLANNED --> PLANNED: note or photos
    IN_PROGRESS --> IN_PROGRESS: note or photos
    DONE --> DONE: note or photos
    DONE --> [*]

    note right of DONE
        No skipping (PLANNED to DONE)
        and no going back
    end note
```

- **The rules** are plain functions in [`order-rules.ts`](../apps/api/src/orders/order-rules.ts): `isAllowedStatusChange` allows the same status or one step forward. An update that keeps the status needs a note or photos, otherwise it says nothing.
- **Who may post an update** (`canUpdateOrder`): project leads on every order, the order's team, and the team lead of the order's vessel. Administrators manage the app, not the work, so they can't.
- **Overdue** is not a status. An order is overdue when its due date has passed and it isn't `DONE` (`isOverdue`). It's computed whenever it's needed, never stored, so it can't go stale.

## Photo upload

Photos go from the phone straight to object storage. They don't pass through the web server or the API, which matters on a slow connection on the yard. The API only hands out permissions to upload and records what was uploaded.

```mermaid
sequenceDiagram
    autonumber
    actor U as Worker (browser)
    participant W as Web server<br/>(Server Actions)
    participant A as API
    participant DB as Postgres
    participant S as Object storage<br/>(RustFS / R2)

    U->>U: pick or take photos
    U->>U: shrinkPhoto: JPEG, max 2000 px<br/>photoProblem: type, size, max 5
    Note over U: previews, a photo can be removed

    U->>W: send the update: requestPhotoUploads(orderId, type and size per photo)
    W->>A: mutation requestPhotoUploads (Bearer token)
    A->>DB: order visible to this user? (visibleVesselsWhere)
    A->>A: canUpdateOrder, validatePhotoUploads
    A->>DB: one PhotoUpload row per key (user, order)
    A->>A: sign one PUT URL per key (valid 5 minutes)
    A-->>W: storage key and signed URL per photo
    W-->>U: storage key and signed URL per photo

    par for each photo
        U->>S: PUT the file to its signed URL (progress bar)
        S-->>U: 200
    end

    U->>W: updateStatus(status, note, storage keys)
    W->>A: mutation addStatusUpdate (Bearer token)
    rect rgba(127, 127, 127, 0.12)
        Note over A,DB: one transaction
        A->>DB: order visible? canUpdateOrder? isAllowedStatusChange?
        A->>DB: keys are this user's PhotoUploads for this order? (validatePhotoKeys)
        A->>DB: create the StatusUpdate with its Photos
        A->>DB: delete the used PhotoUpload rows (a key attaches once)
        A->>DB: set the order's status
    end
    A-->>W: updated order
    W-->>U: history with thumbnails
    Note over U,S: Thumbnails and full photos load from storage<br/>with signed GET URLs (valid 5 minutes), signed on every page load
```

- **Checked twice.** The browser checks type, size and count with the same limits as the API ([`photos.ts`](../apps/web/src/lib/photos.ts)), so a worker hears about a wrong file before waiting for an upload. The API checks again ([`photos.service.ts`](../apps/api/src/photos/photos.service.ts)), because a browser can be bypassed.
- **Only keys the API handed out.** Every key is recorded as a `PhotoUpload` for this user and order before its URL is signed. `addStatusUpdate` ([`orders.service.ts`](../apps/api/src/orders/orders.service.ts)) accepts only those keys, and only once, so no one can attach someone else's file or a file from another order.
- **Nothing half done.** If an upload fails, nothing has been attached yet, and the worker tries again from the start. The status update and its photos are saved in one transaction.
- **CORS.** Because the browser talks to the bucket directly, the bucket must allow the web app's origin (`storage-init` in [`docker-compose.yml`](../docker-compose.yml) locally, [DEPLOYMENT.md](../DEPLOYMENT.md) for R2). The trade-offs of object storage are in [ADR 0001](adr/0001-object-storage.md).
