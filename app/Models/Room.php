<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Room extends Model
{
    protected $fillable = ['code', 'last_active_at'];

    protected $casts = [
        'last_active_at' => 'datetime',
    ];

    public const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    public const MAX_ITEMS = 100;

    public function items(): HasMany
    {
        return $this->hasMany(ClipboardItem::class)->latest('id');
    }

    public static function generateCode(): string
    {
        do {
            $code = '';
            for ($i = 0; $i < 6; $i++) {
                $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
        } while (self::where('code', $code)->exists());

        return $code;
    }

    public static function findOrCreateByCode(string $code): self
    {
        $code = strtoupper($code);
        $room = self::firstOrCreate(
            ['code' => $code],
            ['last_active_at' => now()]
        );

        if (! $room->wasRecentlyCreated) {
            $room->forceFill(['last_active_at' => now()])->save();
        }

        return $room;
    }

    public function touchActivity(): void
    {
        $this->forceFill(['last_active_at' => now()])->save();
    }

    public function trimItems(): void
    {
        $excessIds = $this->items()
            ->skip(self::MAX_ITEMS)
            ->take(PHP_INT_MAX)
            ->pluck('id');

        if ($excessIds->isNotEmpty()) {
            ClipboardItem::whereIn('id', $excessIds)->delete();
        }
    }
}
