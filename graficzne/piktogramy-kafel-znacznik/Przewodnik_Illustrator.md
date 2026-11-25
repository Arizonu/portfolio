# Zestaw piktogramów „Kafel-znacznik” – przewodnik do Illustratora

## Koncepcja (czym się wyróżnia)
Każdy znak to **czarny kafel z białym symbolem w negatywie**. Trzy narożniki kafla są zaokrąglone, a **prawy dolny jest ostry**, jak szpic pinezki na mapie albo dymku: kafel „wskazuje miejsce”. To jeden cichy detal, po którym od razu widać, że te sześć znaków jest z jednej rodziny. Do tego wspólna gramatyka:
- **człowiek** to zawsze ten sam moduł: głowa (koło r = 18) + tułów (prostokąt 40 szer. z półkolistą górą), 8 px przerwy,
- **drzwi** (winda, wejście) to ten sam kształt „Π” 100 × 160,
- **grubość każdego elementu = 20 px** (1 moduł siatki), zakończenia linii zaokrąglone.

## Plansza i siatka
- Artboard: **1080 × 780 px** (Document Setup), tło białe.
- Pole znaku: **240 × 240 px**, 3 kolumny × 2 rzędy, odstęp **60 px**, margines **120 px**.
- Lewy górny róg pól: x = 120 / 420 / 720, y = 120 / 420.
- Siatka: Preferences → Guides & Grid → Gridline every 20 px, Subdivisions 1. Włącz View → Snap to Grid i **Smart Guides** (Ctrl/Cmd+U).
- Strefa symbolu w polu: 40–200 px (margines 40 od krawędzi kafla).

## Warstwy (panel Layers)
```
Plansza
├── 01_Schody      (Schody_kafel, Schody_symbol)
├── 02_Winda
├── 03_Toaleta
├── 04_Wejscie
├── 05_Restauracja
└── 06_Garderoba
Tlo_planszy (zablokowana)
```
Każdy znak = grupa z dwiema podgrupami: `…_kafel` i `…_symbol`. Elementy w środku nazwij jak w SVG (np. `Toaleta_K_tulow`).

## Krok 0 – kafel (EDYCJA PUNKTÓW)
1. Rectangle Tool, klik na planszy → 240 × 240, wypełnienie czarne, bez obrysu.
2. Direct Selection (A) → zaznacz kafel, przeciągnij widżet narożnika do **r = 40** (albo Transform → Corner radius 40).
3. Direct Selection kliknij **tylko prawy dolny punkt** i w panelu Transform ustaw jego promień na **0**. To jest edycja punktu ścieżki: ostry narożnik.
4. Ustaw kafel w x 120, y 120. Potem **Alt+przeciągnij z Shift** (duplikowanie) o 300 px w prawo, Ctrl/Cmd+D powtarza. Rząd dolny tak samo, 300 px w dół. Wyrównaj panelem **Align** (Distribute Spacing 60 px, Key Object).

Wszystkie współrzędne niżej są względne do lewego górnego rogu kafla.

## 1. Schody – SHAPE BUILDER
1. Prostokąty: 156 × 30 (x 42, y 170), 104 × 40 (x 94, y 130), 52 × 40 (x 146, y 90), wszystkie sięgające do y 200, czyli schody z 3 stopni.
2. Zaznacz je, **Shape Builder (Shift+M)** i przeciągnij przez wszystkie, łącząc w jedną bryłę `Schody_stopnie` (punkty: 8).
3. Człowiek: Ellipse 36 × 36 (środek 66, 76). Tułów: Rectangle 40 × 60 (x 46, y 102) + Ellipse 40 × 40 na górze, połącz **Shape Builderem** w `Schody_tulow`. Spód tułowia 8 px nad stopniem.

## 2. Winda – PATHFINDER (Minus Front)
1. Kabina: Rectangle 100 × 160 (x 100, y 40) i na nim Rectangle 60 × 140 (x 120, y 60). Pathfinder → **Minus Front** = kształt „Π” `Winda_kabina`.
2. Strzałki: **Polygon Tool**, 3 boki, przeskaluj do 40 × 36. Pierwszą ustaw w (40–80, 74–110), drugą zrób przez Reflect (O) poziomo, w (40–80, 130–166).
3. Człowiek: ten sam moduł co w schodach (skopiuj grupę), środek głowy (150, 114), tułów stoi na dole kabiny.

## 3. Toaleta – SHAPE BUILDER + EDYCJA PUNKTÓW
1. Mężczyzna: koło 36 (środek 70, 62) + tułów: Rectangle 40 × 92 (x 50, y 108) + Ellipse 40 × 40 (górą w y 88), połącz Shape Builderem.
2. Kobieta: zrób tak samo tułów (środek x 158), potem **Direct Selection** zaznacz 2 dolne punkty i rozsuń je: lewy na x 124, prawy na x 192 (Transform albo strzałki z Shift). Z kolumny robi się sukienka, a to druga edycja punktów w zestawie.
3. Głowy obu postaci na tej samej wysokości (Align → Vertical Align Center).

## 4. Wejście – PATHFINDER (Minus Front)
1. Drzwi: skopiuj „Π” z windy (x 100, y 40).
2. Strzałka: Rectangle 92 × 20 (x 40, y 110) + trójkąt z Polygon 42 × 72 obrócony o 90° (podstawa na x 130, czubek x 172), połącz Pathfinder → **Unite**.
3. Przerwa w słupku: Rectangle 20 × 40 (x 100, y 100) na lewym słupku drzwi → zaznacz oba → **Minus Front**. Strzałka „wchodzi” przez otwór, a nie przez ścianę.

## 5. Restauracja – PATHFINDER + EDYCJA PUNKTÓW
1. Talerz: Ellipse 80 × 80 i Ellipse 40 × 40, oba środek (130, 120). Align → centrowanie, Pathfinder → **Minus Front** = pierścień (ścianka 20).
2. Widelec: Rectangle 40 × 40 (x 40, y 40) + koło 40 (środek 60, 80) połączone **Unite**, potem 2 prostokąty 8 × 40 (x 48 i x 64, y 40) → **Minus Front**, wychodzą 3 zęby. Trzonek: Rectangle 20 × 110 z zaokrąglonymi rogami r 10, Unite z głową.
3. Nóż: Rectangle 20 × 160 (x 180, y 40). **Direct Selection** zaznacz tylko prawy górny punkt, zaokrąglij go na r 20 (ostrze); 2 dolne punkty na r 10.

## 6. Garderoba – EDYCJA PUNKTÓW (Scissors / rozcięcie ścieżki)
1. Wieszak: Polygon 3 boki, przeskaluj tak, żeby wierzchołki były w (120, 110), (190, 170), (50, 170). Obrys 20 px biały, Round Join.
2. Haczyk: Ellipse 44 × 44 (środek 120, 72), obrys 20, Round Cap. Narzędziem **Scissors (C)** przetnij okrąg w punkcie lewym (98, 72) i dolnym (120, 94), usuń dolną-lewą ćwiartkę. Z dolnego punktu **Pen Tool** dociągnij odcinek do wierzchołka trójkąta (120, 110) i połącz ścieżki (Ctrl/Cmd+J).
3. Object → **Expand** (obrys → kształt), żeby grubość była „zamrożona” jak w pozostałych znakach.

## Kontrola czystości przed oddaniem
- Select → Object → **Stray Points** → Delete (zbłąkane punkty).
- Object → Path → **Simplify** tylko jeśli ścieżka ma nadmiarowe punkty (kafel = 7 punktów, schody = 8, Π = 8).
- View → Outline (Ctrl/Cmd+Y): sprawdź, że nie ma ukrytych, zdublowanych obiektów.
- Tylko 2 kolory: #000000 i #FFFFFF, zero tekstu.
- Test zmniejszenia: View → Zoom do ok. 25% i oceń, czy wszystkie znaki są czytelne.

## Zapis
- File → Save As → `sYYYYY_Nazwisko_Imie_Zadanie_02.ai` (zaznacz Create PDF Compatible File).
- File → Save a Copy → Adobe PDF → `sYYYYY_Nazwisko_Imie_Zadanie_02.pdf` (preset High Quality Print).

> Plik `plansza_piktogramy.svg` w tym folderze to gotowa plansza. Można go otworzyć w Illustratorze, żeby porównać wymiary albo podłożyć jako zablokowaną warstwę referencyjną podczas budowania znaków powyższymi krokami.
