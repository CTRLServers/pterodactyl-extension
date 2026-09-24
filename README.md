# CTRLServers Pterodactyl Extension

Adds an **Add to CTRLServers** action to the Pterodactyl client dashboard. The extension uses the signed-in user's Client API to create a `ptlc_` key, choose servers, and send them to the CTRLServers desktop app at `http://127.0.0.1:12747/accept-servers`.

The key stays in the browser's memory during the wizard. CTRLServers receives it over the local endpoint and stores it for later panel requests. A key created by a cancelled import is deleted when the wizard closes; a successful import leaves the key in Pterodactyl.

## Install

From the Pterodactyl panel directory:

```sh
composer config repositories.ctrlservers vcs https://github.com/CTRLServers/pterodactyl-extension
composer require ctrlservers/pterodactyl-extension:dev-main
php artisan ctrlservers:install
php artisan optimize:clear
```

The install command publishes the JavaScript asset and adds one script tag to `resources/views/templates/wrapper.blade.php`. It does not inject into the admin layout. The command removes the old CTRLServers tag from `resources/views/layouts/admin.blade.php` if a previous install left one there.

## Update

Once the extension is installed, update it from GitHub and republish its files with:

```sh
php artisan ctrlservers:reinstall
```

The command updates `ctrlservers/pterodactyl-extension` through Composer, reruns the installer, and clears the panel cache.

## Remove

```sh
php artisan ctrlservers:install --revert
composer remove ctrlservers/pterodactyl-extension
```

Revert restores the wrapper backup, removes the old admin injection if present, and deletes the published JavaScript asset.

## Configuration

The optional `config/ctrlservers.php` file sets the local endpoint and the description shown for newly created API keys:

```dotenv
CTRLSERVERS_DESKTOP_ENDPOINT=http://127.0.0.1:12747/accept-servers
CTRLSERVERS_KEY_DESCRIPTION=CTRLServers Desktop Integration
```

The desktop listener binds to `127.0.0.1`. The browser request uses CORS preflight and sends the key only to that local endpoint.
