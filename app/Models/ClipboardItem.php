<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ClipboardItem extends Model
{
    protected $fillable = ['uuid', 'room_id', 'text', 'device'];

    protected static function booted(): void
    {
        static::creating(function (ClipboardItem $item) {
            if (empty($item->uuid)) {
                $item->uuid = (string) Str::uuid();
            }
        });
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function toBroadcast(): array
    {
        return [
            'id' => $this->uuid,
            'text' => $this->text,
            'device' => $this->device,
            'createdAt' => $this->created_at?->valueOf(),
        ];
    }
}
