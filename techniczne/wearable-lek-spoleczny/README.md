# Wearable na lęk społeczny

Projekt zespołowy na przedmiot AI & Data Science 1 (PJATK). Koncepcja „inteligentnego ubrania”, które mierzy sygnał z ciała i daje feedback pomagający przy lęku społecznym.

**Zespół:** Kacper Książek, Kamil Basaj
**Narzędzia:** Arduino Uno, Wokwi, C++

## Jak to działa
**pomiar → algorytm → feedback → zachowanie**

1. **Pomiar:** EDA (przewodnictwo skóry) jako wskaźnik pobudzenia. W symulacji czujnik zastępuje fotorezystor albo potencjometr.
2. **Algorytm:** odczyt `analogRead(A0)`, wygładzanie sygnału, porównanie z progami.
3. **Feedback:** sygnał świetlny lub wibracja przy rosnącym pobudzeniu.
4. **Zachowanie:** podpowiedź, żeby się zatrzymać i zrobić kilka wolnych oddechów.

## Etyka i ograniczenia
Prywatność danych fizjologicznych, fałszywe odczyty (np. pot z upału wygląda jak stres), ryzyko stygmatyzacji przy widocznym sygnale.

## Pliki
<!-- TODO: link do symulacji Wokwi, prezentacja.pdf, sketch.ino -->
