# CTRLServers Pterodactyl Extension

Adds an **Add to CTRLServers** button to the Pterodactyl **client** dashboard (`/`, never `/admin/*`).
A wizard creates a Pterodactyl **client** API key (`ptlc_…`, description `CTRLServers Desktop Integration`)
via the existing core route `POST /api/client/account/api-keys`, lets the user pick servers from the
existing core route `GET /api/client`, and POSTs them to the local CTRLServers Desktop app at
`http://127.0.0.1:12747/accept-servers`.

No core files are modified by hand. Pterodactyl core has no supported client-dashboard extension slot,
so `php artisan ctrlservers:install` performs a **reversible** one-line `<script>` injection into the
panel Blade layout (backup `*.ctrlservers.bak`, `--revert` restores). All server/key logic reuses core APIs.

## Payload sent to Desktop (POST 127.0.0.1:12747/accept-servers)

```json
{
  "type": "pterodactyl",
  "panel": { "url": "https://panel.example.com", "apiKey": "ptlc_…" },
  "servers": [
    { "identifier": "abc123", "uuid": "full-uuid", "name": "Survival",
      "description": "", "node": "", "limits": {},
      "panelUrl": "https://panel.example.com", "apiKey": "ptlc_…" }
  ]
}
```

Identifiers come from the Client API (`attributes.identifier` short ID + `attributes.uuid` full UUID);
the Desktop accepts either. `panelUrl`/`apiKey` are duplicated per server because the Desktop
normalizer reads per-server fields (with `panel.*` as fallback).

## CORS / localhost requirements (Desktop side, already implemented in CTRLServers app `electron.cjs`)

The browser page (https) calling `http://127.0.0.1:12747` triggers CORS + Private Network Access preflight.
The Desktop answers `OPTIONS /accept-servers` with `204` plus:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

and includes `Access-Control-Allow-Origin: *` on POST responses. The extension sends a plain
`fetch(url, { mode: 'cors' })` with only `Content-Type: application/json` (no credentials),
so no browser security is disabled. Binding stays on `127.0.0.1`, never `0.0.0.0`.

## Install (from panel root)

```bash
composer config repositories.ctrlservers vcs https://github.com/CTRLServers/pterodactyl-extension
composer require ctrlservers/pterodactyl-extension
php artisan ctrlservers:install
```

If the package is already on Packagist, the first line is unnecessary.

## Uninstall / revert

```bash
php artisan ctrlservers:install --revert
composer remove ctrlservers/pterodactyl-extension
```

## Security notes

- Secret (`meta.secret_token`) kept in JS memory only, never localStorage/URL/logs; cleared after handoff.
- Cancelling after key creation DELETEs the unused key.
- Existing keys' secrets cannot be recovered — a new key is created each run.
- Key is POSTed only to `127.0.0.1:12747`, never to cloud hosts.
- Client key only (`ptlc_`); no admin/Application API usage.
