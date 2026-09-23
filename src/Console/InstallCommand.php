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

        if (empty($layouts)) {
            $this->warn('No Blade layout containing </body> was found. Publish manually: copy resources/js/ctrlservers-dashboard.js to public/vendor/ctrlservers/ and add the script tag to your layout.');
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

    /** @return string[] */
    private function findLayouts(): array
    {
        $candidates = [
            resource_path('views/layouts/app.blade.php'),
            resource_path('views/layouts/admin.blade.php'),
            resource_path('views/layouts/base.blade.php'),
        ];

        $found = [];
        foreach ($candidates as $path) {
            if (File::exists($path)) {
                $found[] = $path;
            }
        }
        if (empty($found) && File::isDirectory(resource_path('views'))) {
            foreach (File::allFiles(resource_path('views')) as $file) {
                if ($file->getExtension() !== 'php') {
                    continue;
                }
                $path = $file->getPathname();
                if (!str_ends_with($path, '.blade.php')) {
                    continue;
                }
                $contents = File::get($path);
                if (str_contains($contents, '</body>') && str_contains($contents, '<html')) {
                    $found[] = $path;
                }
            }
        }

        return array_values(array_unique($found));
    }
}
