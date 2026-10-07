<?php

use App\Http\Controllers\Api\Admin\ShortUrlsController as AdminShortUrlsController;
use App\Http\Controllers\Api\Admin\TeamMembersController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InvitationController;
use App\Http\Controllers\Api\Superadmin\ClientsController;
use App\Http\Controllers\Api\Superadmin\ShortUrlsController;
use Illuminate\Support\Facades\Route;

// Auth Routes
Route::post('/login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
Route::middleware('auth:sanctum')->post('/user', [AuthController::class, 'user']);

// Invitaiton Code
Route::post('/invitation/{code}/register', [InvitationController::class, 'register']);
Route::post('/invitation/{code}', [InvitationController::class, 'invitation']);

// Superadmin Routes
Route::prefix('superadmin')->middleware('auth:sanctum')->group(function () {
    // Clients
    Route::post('/clients/invite', [ClientsController::class, 'invite']);
    Route::post('/clients', [ClientsController::class, 'index']);

    // Short Urls
    Route::post('/urls/download', [ShortUrlsController::class, 'download']);
    Route::post('/urls', [ShortUrlsController::class, 'index']);
});

// Admin Routes
Route::prefix('admin')->middleware('auth:sanctum')->group(function () {
    // Team Members
    Route::post('/team-members/invite', [TeamMembersController::class, 'invite']);
    Route::post('/team-members', [TeamMembersController::class, 'index']);

    // Short Urls
    Route::post('/urls/generate', [AdminShortUrlsController::class, 'generate']);
    Route::post('/urls/download', [AdminShortUrlsController::class, 'download']);
    Route::post('/urls', [AdminShortUrlsController::class, 'index']);
});
