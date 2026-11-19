# Wiadomości testowe do screenów

Wysyłaj po kolei w jednej rozmowie. Każda wiadomość pokazuje inny trigger. Zrób screen po każdej odpowiedzi (albo po kilku naraz, jeśli mieszczą się na ekranie).

| # | Wiadomość do wpisania | Oczekiwany tryb | Co pokazuje |
|---|---|---|---|
| 1 | `Dzień dobry, proszę o radę, jak przygotować się do egzaminu z algorytmów w dwa tygodnie.` | A | tryb domyślny + słowa „proszę o radę”, „egzamin” |
| 2 | `siema xD wymyśl śmieszną nazwę dla apki do dzielenia się notatkami` | **A → B** | słowa kluczowe „siema”, „xD”, „wymyśl” (powinien pojawić się znacznik `[Tryb: potoczno-kreatywny 😎]`) |
| 3 | `haha dobre, dawaj jeszcze ze 3` | B (bez zmiany) | brak znacznika, bo tryb się nie zmienił |
| 4 | `siema, pomocy, nie działa mi kod i jutro mam termin oddania 😭` | **B → A** | reguła konfliktu: stres i błąd wygrywają z „siema” i emoji |
| 5 | `/luzno opowiedz krótką historyjkę o programiście i kawie` | **A → B** | komenda jawna |
| 6 | `Proszę napisać oficjalny mail do prowadzącego z prośbą o przesunięcie terminu.` | **B → A** | sytuacja: tekst formalny |
| 7 | `w jakim jesteś trybie?` | bez zmiany | Kuba podaje tryb i komendy |

Na zaliczenie wystarczą screeny z wiadomości 1, 2, 4 i 5 (domyślny tryb, zmiana słowem kluczowym, zmiana sytuacją z konfliktem, zmiana komendą).
