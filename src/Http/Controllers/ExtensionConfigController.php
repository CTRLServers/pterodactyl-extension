<?php

namespace CTRLServers\PterodactylExtension\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class ExtensionConfigController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'desktopEndpoint' => config('ctrlservers.desktop_endpoint', 'http://127.0.0.1:12747/accept-servers'),
            'keyDescription' => config('ctrlservers.key_description', 'CTRLServers Desktop'),
            'version' => '1.0.0',
        ]);
    }
}
