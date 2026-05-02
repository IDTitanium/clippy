<?php

namespace App\Http\Controllers;

use App\Models\ClipboardItem;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ClipboardItemController extends Controller
{
    public function createRoom(): JsonResponse
    {
        $code = Room::generateCode();
        Room::findOrCreateByCode($code);

        return response()->json(['code' => $code]);
    }

    public function index(string $code): JsonResponse
    {
        if (! preg_match('/^[A-Z0-9]{6}$/', strtoupper($code))) {
            return response()->json(['error' => 'invalid room code'], 422);
        }

        $room = Room::findOrCreateByCode($code);

        $items = $room->items()
            ->take(Room::MAX_ITEMS)
            ->get()
            ->map(fn (ClipboardItem $item) => $item->toBroadcast());

        return response()->json([
            'room' => $room->code,
            'items' => $items,
        ]);
    }

    public function store(Request $request, string $code): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'text' => ['required', 'string', 'max:200000'],
            'device' => ['nullable', 'string', 'max:64'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (! preg_match('/^[A-Z0-9]{6}$/', strtoupper($code))) {
            return response()->json(['error' => 'invalid room code'], 422);
        }

        $room = Room::findOrCreateByCode($code);

        $item = $room->items()->create([
            'text' => $request->input('text'),
            'device' => $request->input('device') ?: 'device',
        ]);

        $room->trimItems();
        $room->touchActivity();

        return response()->json(['item' => $item->toBroadcast()]);
    }

    public function destroy(string $code, string $uuid): JsonResponse
    {
        if (! preg_match('/^[A-Z0-9]{6}$/', strtoupper($code))) {
            return response()->json(['error' => 'invalid room code'], 422);
        }

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return response()->json(['ok' => true]);
        }

        $room->items()->where('uuid', $uuid)->delete();
        $room->touchActivity();

        return response()->json(['ok' => true]);
    }

    public function clear(string $code): JsonResponse
    {
        if (! preg_match('/^[A-Z0-9]{6}$/', strtoupper($code))) {
            return response()->json(['error' => 'invalid room code'], 422);
        }

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return response()->json(['ok' => true]);
        }

        $room->items()->delete();
        $room->touchActivity();

        return response()->json(['ok' => true]);
    }
}
