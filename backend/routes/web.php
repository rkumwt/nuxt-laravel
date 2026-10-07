<?php

use App\Http\Controllers\ShortUrlRedirectController;
use Illuminate\Support\Facades\Route;

Route::get('/s/{code}', [ShortUrlRedirectController::class, 'redirect'])
    ->name('short.redirect');

// The UI lives in the Nuxt frontend; send browser visits there
Route::get('/', function () {
    return redirect(config('app.frontend_url'));
});
