<?php

use App\Http\Controllers\ClipboardItemController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('clipboard'))->name('clipboard');

Route::prefix('api')->group(function () {
    Route::post('/rooms', [ClipboardItemController::class, 'createRoom']);
    Route::get('/rooms/{code}/items', [ClipboardItemController::class, 'index']);
    Route::post('/rooms/{code}/items', [ClipboardItemController::class, 'store']);
    Route::delete('/rooms/{code}/items/{uuid}', [ClipboardItemController::class, 'destroy']);
    Route::delete('/rooms/{code}/items', [ClipboardItemController::class, 'clear']);
});
