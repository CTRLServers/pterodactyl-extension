<?php

namespace CTRLServers\PterodactylExtension\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;
use Throwable;

class ReinstallCommand extends Command
{
    protected $signature = 'ctrlservers:reinstall';

    protected $description = 'Download the latest CTRLServers extension and reinstall its files';

    private const PACKAGE = 'ctrlservers/pterodactyl-extension';

    public function handle(): int
    {
        if (!File::exists(base_path('composer.json'))) {
            $this->error('Run this command from a Pterodactyl panel installation.');
            return self::FAILURE;
        }

        $this->info('Downloading the latest CTRLServers extension...');
        if (!$this->runCommand([
            ...$this->composerCommand(),
            'update',
            self::PACKAGE,
            '--no-interaction',
            '--prefer-dist',
        ])) {
            $this->error('Composer could not update the CTRLServers extension.');
            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Publishing the updated extension files...');
        if (!$this->runArtisan('ctrlservers:install')) {
            $this->error('The extension was updated, but its files could not be published.');
            return self::FAILURE;
        }

        if (!$this->runArtisan('optimize:clear')) {
            $this->error('The extension was updated, but the panel cache could not be cleared.');
            return self::FAILURE;
        }

        $this->newLine();
        $this->info('CTRLServers is up to date.');
        return self::SUCCESS;
    }

    private function composerCommand(): array
    {
        $localComposer = base_path('composer.phar');

        return File::exists($localComposer)
            ? [PHP_BINARY, $localComposer]
            : ['composer'];
    }

    private function runArtisan(string $command): bool
    {
        return $this->runCommand([
            PHP_BINARY,
            base_path('artisan'),
            $command,
            '--no-interaction',
        ]);
    }

    private function runCommand(array $command): bool
    {
        try {
            $process = new Process($command, base_path());
            $process->setTimeout(null);
            $process->run(function (string $type, string $output): void {
                $this->output->write($output);
            });

            return $process->isSuccessful();
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());
            return false;
        }
    }
}
