import asyncio
from typing import AsyncGenerator

MOCK_RESPONSE = "Der Lasègue-Test ist ein klinischer Provokationstest zur Überprüfung einer Nervenwurzelreizung (Radikulopathie) im Bereich der Lendenwirbelsäule. Der Patient liegt in Rückenlage, der Untersucher hebt das gestreckte Bein passiv an. Der Test ist positiv bei ausstrahlenden Schmerzen im Verlauf des N. ischiadicus zwischen 30° und 70° Beugung."

async def stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    words = MOCK_RESPONSE.split(" ")
    for word in words:
        await asyncio.sleep(0.05)
        yield word + " "
