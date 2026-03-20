import asyncio

MOCK_TRANSCRIPT = (
    "So, was führt Sie heute zu mir? Ja, ich habe seit ungefähr drei Wochen "
    "Schmerzen in der rechten Schulter. Besonders wenn ich den Arm über den "
    "Kopf hebe. Okay, können Sie mir zeigen wo genau? Hier vorne, so im "
    "Bereich vom Deltamuskel und hier oben. Das strahlt manchmal auch in den "
    "Oberarm aus. Gut, das klingt nach einem möglichen Impingement-Syndrom. "
    "Lassen Sie mich mal ein paar Tests machen. Der Hawkins-Test ist positiv, "
    "der Jobe-Test auch. Die passive Beweglichkeit ist voll, aktiv haben Sie "
    "eine Einschränkung in der Abduktion ab etwa 90 Grad."
)

MOCK_SEGMENTS = [
    {"start": 0.0, "end": 3.5, "text": "So, was führt Sie heute zu mir?"},
    {"start": 3.5, "end": 12.0, "text": "Ja, ich habe seit ungefähr drei Wochen Schmerzen in der rechten Schulter. Besonders wenn ich den Arm über den Kopf hebe."},
    {"start": 12.0, "end": 15.2, "text": "Okay, können Sie mir zeigen wo genau?"},
    {"start": 15.2, "end": 22.5, "text": "Hier vorne, so im Bereich vom Deltamuskel und hier oben. Das strahlt manchmal auch in den Oberarm aus."},
    {"start": 22.5, "end": 45.0, "text": "Gut, das klingt nach einem möglichen Impingement-Syndrom. Lassen Sie mich mal ein paar Tests machen. Der Hawkins-Test ist positiv, der Jobe-Test auch. Die passive Beweglichkeit ist voll, aktiv haben Sie eine Einschränkung in der Abduktion ab etwa 90 Grad."},
]


async def transcribe_chunk(audio_bytes: bytes) -> str:
    await asyncio.sleep(1.0)
    return MOCK_TRANSCRIPT[:150]


async def transcribe_full(audio_path: str) -> dict:
    await asyncio.sleep(2.0)
    return {
        "text": MOCK_TRANSCRIPT,
        "segments": MOCK_SEGMENTS,
        "duration": 45.0,
    }
