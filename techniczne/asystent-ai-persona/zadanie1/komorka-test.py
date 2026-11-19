# === Wklej to do NOWEJ komórki na samym dole notatnika i uruchom (Shift+Enter) ===
# Wczytuje persona.md z folderu asystent i prowadzi jedną rozmowę z 7 wiadomościami testowymi.

with open(f'{PATH_ASYSTENT}/persona.md', 'r') as f:
    persona_file = f.read()

messages = [{"role": "system", "content": persona_file}]

def powiedz(tekst):
    messages.append({"role": "user", "content": tekst})
    completion = client.chat.completions.create(
        model="vllm/gpt-oss",
        messages=messages,
    )
    odpowiedz = completion.choices[0].message.content
    messages.append({"role": "assistant", "content": odpowiedz})
    print("TY:", tekst)
    print()
    print("KUBA:", odpowiedz)
    print("=" * 70)
    print()

testy = [
    "Dzień dobry, proszę o radę, jak przygotować się do egzaminu z algorytmów w dwa tygodnie.",
    "siema xD wymyśl śmieszną nazwę dla apki do dzielenia się notatkami",
    "haha dobre, dawaj jeszcze ze 3",
    "siema, pomocy, nie działa mi kod i jutro mam termin oddania 😭",
    "/luzno opowiedz krótką historyjkę o programiście i kawie",
    "Proszę napisać oficjalny mail do prowadzącego z prośbą o przesunięcie terminu.",
    "w jakim jesteś trybie?",
]

for t in testy:
    powiedz(t)
