<?php

namespace CTRLServers\PterodactylExtension;

use CTRLServers\PterodactylExtension\Http\Controllers\ExtensionConfigController;
use CTRLServers\PterodactylExtension\Console\InstallCommand;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class CTRLServersServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/ctrlservers.php', 'ctrlservers');
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__ . '/../resources/js/ctrlservers-dashboard.js' => public_path('vendor/ctrlservers/ctrlservers-dashboard.js'),
        ], 'ctrlservers-assets');

        $this->publishes([
            __DIR__ . '/../config/ctrlservers.php' => config_path('ctrlservers.php'),
        ], 'ctrlservers-config');

        if ($this->app->runningInConsole()) {
            $this->commands([InstallCommand::class]);
        }

        Route::middleware(['web', 'auth'])->get(
            '/ctrlservers-extension/config',
            [ExtensionConfigController::class, 'show']
        )->name('ctrlservers.config');
    }
}
