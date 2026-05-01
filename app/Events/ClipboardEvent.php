<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ClipboardEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $roomCode,
        public string $action,
        public array $payload = []
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('clipboard.' . $this->roomCode),
        ];
    }

    public function broadcastAs(): string
    {
        return $this->action;
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
