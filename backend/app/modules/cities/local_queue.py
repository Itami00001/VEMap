import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import HTTPException, Request


class LocalQueue:
    def __init__(self) -> None:
        self.active = asyncio.Semaphore(1)
        self.waiting = 0

    @asynccontextmanager
    async def enter(self, request: Request):
        if self.waiting >= 5:
            raise HTTPException(429, "Очередь локальной модели заполнена.", headers={"Retry-After": "15"})
        self.waiting += 1
        deadline = asyncio.get_running_loop().time() + 75
        slot = asyncio.create_task(self.active.acquire())
        acquired = False
        try:
            while not slot.done():
                await asyncio.wait({slot}, timeout=0.5)
                if await request.is_disconnected():
                    raise HTTPException(499, "Запрос отменён.")
                if not slot.done() and asyncio.get_running_loop().time() >= deadline:
                    raise HTTPException(429, "Истекло время ожидания локальной модели.", headers={"Retry-After": "15"})
            slot.result()
            acquired = True
        finally:
            self.waiting -= 1
            if not acquired:
                slot.cancel()
                with suppress(asyncio.CancelledError):
                    await slot
                    self.active.release()

        try:
            yield
        finally:
            self.active.release()
