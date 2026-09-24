<?php

namespace CTRLServers\PterodactylExtension\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class InstallCommand extends Command
{
    protected $signature = 'ctrlservers:install {--revert : Restore the client wrapper backup}';

    protected $description = 'Install or remove the CTRLServers client dashboard script';

    private const SCRIPT = '<script src="/vendor/ctrlservers/ctrlservers-dashboard.js" defer></script>';
    private const CLIENT_WRAPPER = 'views/templates/wrapper.blade.php';
    private const OLD_ADMIN_LAYOUT = 'views/layouts/admin.blade.php';

    public function handle(): int
    {
        $wrapper = resource_path(self::CLIENT_WRAPPER);
        $adminLayout = resource_path(self::OLD_ADMIN_LAYOUT);

        if ($this->option('revert')) {
            $this->restore($wrapper);
            $this->restore($adminLayout, true);
            File::delete(public_path('vendor/ctrlservers/ctrlservers-dashboard.js'));
            return self::SUCCESS;
        }

        if (!File::exists($wrapper)) {
            $this->error("Client wrapper not found: {$wrapper}");
            return self::FAILURE;
        }

        if ($this->call('vendor:publish', ['--tag' => 'ctrlservers-assets', '--force' => true]) !== self::SUCCESS) {
            return self::FAILURE;
        }

        $this->removeOldAdminInjection($adminLayout);
        $contents = File::get($wrapper);
        if (str_contains($contents, 'ctrlservers-dashboard.js')) {
            $this->info('Already installed in the client wrapper.');
            return self::SUCCESS;
        }
        if (!str_contains($contents, '</body>')) {
            $this->error('The client wrapper has no closing </body> tag.');
            return self::FAILURE;
        }

        $this->backup($wrapper, $contents);
        File::put($wrapper, str_replace('</body>', self::SCRIPT . "\n</body>", $contents));
        $this->info("Installed in {$wrapper}");
        return self::SUCCESS;
    }

    private function removeOldAdminInjection(string $path): void
    {
        if (!File::exists($path)) {
            return;
        }

        $contents = File::get($path);
        if (!str_contains($contents, 'ctrlservers-dashboard.js')) {
            return;
        }

        $this->backup($path, $contents);
        File::put($path, str_replace(self::SCRIPT, '', $contents));
        $this->warn('Removed the old script injection from the admin layout.');
    }

    private function backup(string $path, string $contents): void
    {
        $backup = $path . '.ctrlservers.bak';
        if (!File::exists($backup)) {
            File::put($backup, $contents);
        }
    }

    private function restore(string $path, bool $removeScript = false): void
    {
        $backup = $path . '.ctrlservers.bak';
        if (!File::exists($backup)) {
            if (File::exists($path)) {
                $contents = File::get($path);
                if ($removeScript) {
                    $contents = str_replace(self::SCRIPT, '', $contents);
                }
                File::put($path, $contents);
            }
            return;
        }

        $contents = File::get($backup);
        if ($removeScript) {
            $contents = str_replace(self::SCRIPT, '', $contents);
        }
        File::put($path, $contents);
        File::delete($backup);
        $this->info("Restored {$path}");
    }
}
