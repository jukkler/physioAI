import asyncio

MOCK_CORRECTED = (
    "So, was führt Sie heute zu mir? Ja, ich habe seit ungefähr drei Wochen "
    "Schmerzen in der rechten Schulter. Besonders wenn ich den Arm über den "
    "Kopf hebe. Okay, können Sie mir zeigen wo genau? Hier vorne, so im "
    "Bereich vom M. deltoideus und hier oben. Das strahlt manchmal auch in den "
    "Oberarm aus. Gut, das klingt nach einem möglichen Impingement-Syndrom. "
    "Lassen Sie mich mal ein paar Tests machen. Der Hawkins-Kennedy-Test ist "
    "positiv, der Jobe-Test auch. Die passive Beweglichkeit ist voll, aktiv "
    "haben Sie eine Einschränkung in der Abduktion ab etwa 90 Grad."
)

MOCK_SUMMARY = """## Patienteninformation
- Nicht namentlich genannt
- Verordnung: [unklar]

## Anamnese
- Hauptbeschwerde: Schmerzen in der rechten Schulter seit ca. 3 Wochen
- Schmerzlokalisation: Ventral im Bereich des M. deltoideus, Ausstrahlung in den Oberarm
- Verstärkende Faktoren: Elevation des Arms über 90° (Abduktion)

## Befund / Untersuchung
- Hawkins-Kennedy-Test: positiv
- Jobe-Test: positiv
- Passive Beweglichkeit: vollständig
- Aktive Beweglichkeit: Einschränkung der Abduktion ab ca. 90°
- Verdachtsdiagnose: Impingement-Syndrom der rechten Schulter

## Behandlung (durchgeführt)
Nicht besprochen / nicht untersucht

## Eigenübungsprogramm
Nicht besprochen / nicht untersucht

## Therapieplanung
Nicht besprochen / nicht untersucht

## Offene Punkte / Besonderheiten
- Weitere diagnostische Abklärung empfohlen"""


async def correct_transcript(raw_text: str) -> str:
    await asyncio.sleep(0.5)
    return MOCK_CORRECTED


async def summarize_transcript(corrected_text: str, doc_type: str = "befund") -> str:
    await asyncio.sleep(0.5)
    return MOCK_SUMMARY
