# === Wklej CAŁOŚĆ do NOWEJ komórki (zastąp starą) i uruchom (Shift+Enter) ===
# Robi Krok 1, 2 i 3 za jednym razem, dla OBU profili:
# zapisuje user_profile.md i user_profile_alt.md, łączy każdy z persona.md
# i zadaje TO SAMO pytanie dwa razy.

# >>> JEDYNA RZECZ DO ZMIANY: wklej klucz z zajęć między cudzysłowy <<<
KLUCZ_API = "TU WKLEJ KLUCZ PODANY NA ZAJĘCIACH"

# Ta komórka działa sama: montuje Dysk, ustawia folder asystent i łączy się z modelem.
import os
from google.colab import drive
from openai import OpenAI

drive.mount('/content/gdrive')
PATH_ASYSTENT = '/content/gdrive/MyDrive/asystent'
os.makedirs(PATH_ASYSTENT, exist_ok=True)

client = OpenAI(
    base_url="https://agi.pjwstk.edu.pl/v1",
    api_key=KLUCZ_API,
)
print("✅ Dysk podłączony, klient gotowy\n")

PYTANIE = "Wyjaśnij mi bardzo krótko, czym jest entropia."

user_profile_file = """
# 👤 Profil Użytkownika: Kacper

## 1. Tożsamość i Wiedza
- Status: student kognitywistyki w PJATK.
- Wiedza bazowa: psychologia poznawcza, podstawy neuronauki i biologii (neuron, komórka, białko, DNA), podstawy programowania w Pythonie i pracy z modelami językowymi. Najjaśniejsze są dla mnie metafory z działania mózgu, przetwarzania informacji i uczenia się.
- Braki w wiedzy: nie jestem fizykiem ani lekarzem. Zaawansowana matematyka (całki, równania różniczkowe) i specjalistyczny żargon medyczny wymagają ode mnie wyjaśnienia krok po kroku.

## 2. Preferencje komunikacyjne
- Konkretnie i zwięźle: najpierw krótka odpowiedź, potem szczegóły. Nie toleruję wodolejstwa i przesadnej uprzejmości.
- Wypunktowania i pogrubienia dla kluczowych pojęć, poprawne nazwy terminów (także angielskie).
- Rozróżnianie faktów od hipotez i jedna dobra analogia zamiast wielu.

## 3. Ograniczenia i Bezpieczeństwo
- Nie tłumacz mi podstaw, które znam (czym jest neuron, czym jest program).
- Nie używaj wzorów bez wyjaśnienia słowami, co oznaczają.
- Jeśli nie znasz odpowiedzi, powiedz to wprost, zamiast zgadywać.
"""

user_profile_alt_file = """
# 👤 Profil Użytkownika: Zosia (8 lat)

## 1. Tożsamość i Wiedza
- Status: 8-letnia uczennica 2. klasy szkoły podstawowej, zafascynowana kosmosem. Chce zostać astronautką.
- Wiedza bazowa: zna planety Układu Słonecznego, wie, co to rakieta, astronauta, gwiazda i czarna dziura (że „wciąga wszystko”). Umie czytać, ale krótkie teksty. Najjaśniejsze są dla niej porównania do kosmosu, rakiet, zabawek i porządków w pokoju.
- Braki w wiedzy: nie zna trudnych słów naukowych (np. „cząsteczka”, „energia”, „układ”, „komórka”, „białko”), nie zna matematyki poza dodawaniem i odejmowaniem, nie zna angielskich terminów.

## 2. Preferencje komunikacyjne
- Krótkie zdania, proste słowa, mówienie do niej na „ty”, ciepło i z entuzjazmem.
- Porównania do kosmosu i astronautów, mogą być emoji (🚀🪐⭐).
- Najwyżej kilka krótkich akapitów, na końcu ciekawostka albo pytanie do niej.

## 3. Ograniczenia i Bezpieczeństwo
- Żadnych wzorów, tabel, skrótów ani angielskich słów. Trudne słowo, jeśli jest konieczne, od razu wyjaśnij jak dziecku.
- Nie strasz jej (chorobami, katastrofami, końcem świata).
- Nie mów do niej jak do dorosłego.
"""

# Krok 1: zapis obu profili na Dysku
with open(f'{PATH_ASYSTENT}/user_profile.md', 'w', encoding="utf-8") as f:
    f.write(user_profile_file)
with open(f'{PATH_ASYSTENT}/user_profile_alt.md', 'w', encoding="utf-8") as f:
    f.write(user_profile_alt_file)
print("✅ Zapisano user_profile.md i user_profile_alt.md\n")

# Krok 2: wczytanie persony z poprzednich zajęć
try:
    with open(f'{PATH_ASYSTENT}/persona.md', 'r', encoding="utf-8") as f:
        persona_content = f.read()
except FileNotFoundError:
    persona_content = "Brak pliku persona.md! Upewnij się, że masz go z poprzednich zajęć."
    print("⚠️ Nie znaleziono persona.md w folderze asystent.\n")

# Krok 3: to samo pytanie dla obu profili
def zapytaj(nazwa_pliku):
    with open(f'{PATH_ASYSTENT}/{nazwa_pliku}', 'r', encoding="utf-8") as f:
        user_profile_content = f.read()
    system_prompt = f"{persona_content}\n\n{user_profile_content}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": PYTANIE},
    ]
    completion = client.chat.completions.create(
        model="vllm/gpt-oss",
        messages=messages,
    )
    print("#" * 70)
    print("PROFIL:", nazwa_pliku)
    print("PYTANIE:", PYTANIE)
    print("#" * 70)
    print("--- ODPOWIEDŹ ASYSTENTA ---")
    print(completion.choices[0].message.content)
    print("\n\n")

zapytaj("user_profile.md")
zapytaj("user_profile_alt.md")
