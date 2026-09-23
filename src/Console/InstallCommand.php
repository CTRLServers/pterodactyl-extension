<?php

namespace CTRLServers\PterodactylExtension\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class InstallCommand extends Command
{
    protected $signature = 'ctrlservers:install {--revert : Remove the injected script tag and restore backups}';

    protected $description = 'Inject (or revert) the CTRLServers dashboard script into the Pterodactyl panel layout';

    private const SNIPPET = '<script src="/vendor/ctrlservers/ctrlservers-dashboard.js" defer></script>';
    private const MARKER = 'ctrlservers-dashboard';

    public function handle(): int
    {
        $this->call('vendor:publish', [
            '--tag' => 'ctrlservers-assets',
            '--force' => true,
        ]);

        $layouts = $this->findLayouts();
        $this->removeLegacyInjections();

        if (empty($layouts)) {
            $this->warn('Client wrapper resources/views/templates/wrapper.blade.php was not found. Publish manually: copy the package resources/js/ctrlservers-dashboard.js to public/vendor/ctrlservers/ and add the script tag before </body> in the client wrapper.');
            return self::SUCCESS;
        }

        foreach ($layouts as $layout) {
            $contents = File::get($layout);

            if ($this->option('revert')) {
                $restored = str_replace(self::SNIPPET, '', $contents);
                $backup = $layout . '.ctrlservers.bak';
                if (File::exists($backup)) {
                    File::put($layout, File::get($backup));
                    File::delete($backup);
                    $this->info("Reverted: {$layout} (backup restored)");
                } else {
                    File::put($layout, $restored);
                    $this->info("Reverted: {$layout}");
                }
                continue;
            }

            if (str_contains($contents, self::MARKER)) {
                $this->info("Already installed: {$layout}");
                continue;
            }

            if (!str_contains($contents, '</body>')) {
                $this->warn("Skipped (no </body>): {$layout}");
                continue;
            }

            File::put($layout . '.ctrlservers.bak', $contents);
            File::put($layout, str_replace('</body>', self::SNIPPET . "\n</body>", $contents));
            $this->info("Installed: {$layout} (backup at {$layout}.ctrlservers.bak)");
        }

        return self::SUCCESS;
    }

    /**
     * The client React app is rendered through resources/views/templates/wrapper.blade.php
     * (React root via templates such as base/core.blade.php). The admin panel uses
     * resources/views/layouts/admin.blade.php and must never receive this script.
     */
    private const CLIENT_WRAPPER = 'views/templates/wrapper.blade.php';

    private const LEGACY_LAYOUTS = [
        'views/layouts/admin.blade.php',
    ];

    /** @return string[] */
    private function findLayouts(): array
    {
        $wrapper = resource_path(self::CLIENT_WRAPPER);
        if (File::exists($wrapper)) {
            return [$wrapper];
        }

        $this->warn('Expected client wrapper not found: ' . $wrapper . '. No fallback scan is performed; refusing to guess.');

        return [];
    }

    private function removeLegacyInjections(): void
    {
        foreach (self::LEGACY_LAYOUTS as $relative) {
            $path = resource_path($relative);
            if (!File::exists($path)) {
                continue;
            }
            $contents = File::get($path);
            if (!str_contains($contents, self::MARKER)) {
                continue;
            }
            File::put($path . '.ctrlservers.bak', $contents);
            File::put($path, str_replace(self::SNIPPET, '', $contents));
            $this->info("Removed legacy injection: {$path} (backup at {$path}.ctrlservers.bak)");
        }
    }
}
