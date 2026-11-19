# cut the two narrations into 10 lines and lay out one shared timeline → timeline.json, vo/<lang>_<n>.wav
import json, numpy as np, soundfile as sf
SEG = {'pl': [(0.05, 3.07), (3.53, 7.19), (7.59, 10.29), (10.65, 16.41), (16.76, 18.94), (19.37, 20.82), (21.21, 26.54), (26.9, 30.17), (30.48, 34.02), (34.58, 40.98)],
       'en': [(0.05, 3.36), (3.92, 7.17), (7.85, 10.55), (11.15, 16.68), (17.17, 19.33), (19.94, 21.51), (22.08, 26.53), (27.08, 30.29), (30.77, 33.89), (34.51, 40.64)]}
PL = ['Kognitywistyka. Umysł w pięciu kolorach.', 'To kierunek studiów, który łączy wiedzę o człowieku z technologią.', 'Zaczynamy od pytania: jak działa umysł?',
      'Odpowiedzi szukamy w psychologii, neuronauce, lingwistyce, filozofii i informatyce.', 'Dopiero razem dają pełny obraz.', 'A co robimy w praktyce?',
      'Projektujemy urządzenia, które mierzą reakcje ciała, na przykład stres w lęku społecznym.', 'Badamy potrzeby ludzi i tworzymy persony do projektów.',
      'Analizujemy dane i uczymy modele sztucznej inteligencji.', 'Kognitywistyka w Polsko-Japońskiej Akademii. Rozumiemy ludzi, żeby tworzyć lepszą technologię.']
EN = ['Cognitive Science. A mind in five colours.', 'A field of study that connects knowledge about people with technology.', 'We start with a question: how does a mind work?',
      'We look for answers in psychology, neuroscience, linguistics, philosophy and computer science.', 'Only together do they give the full picture.', 'So what do we actually do?',
      "We design devices that measure the body's reactions, such as stress in social anxiety.", "We study people's needs and create personas for our projects.",
      'We analyse data and train artificial intelligence models.', 'Cognitive Science at the Polish-Japanese Academy. We understand people, to build better technology.']
GAP_BEFORE = [1.2, .7, 1.1, .8, 1.6, 1.4, .9, .7, .7, 1.4]   # pauses before each line (silence before 5, page turn before 6, finale before 10)
dur = {}
for l in SEG:
    x, sr = sf.read(f'vo/{l}.wav')
    for i, (a, b) in enumerate(SEG[l]):
        c = x[max(0, int((a - .04) * sr)):int((b + .06) * sr)]
        f = int(.01 * sr); c[:f] *= np.linspace(0, 1, f); c[-f:] *= np.linspace(1, 0, f)
        sf.write(f'vo/{l}_{i+1}.wav', c, sr); dur.setdefault(l, []).append(round(len(c) / sr, 3))
# three versions: pl (Polish voice), en (English voice), ensub (English voice + Polish subtitles: slots long enough to read them)
for ver, voice in (('pl', 'pl'), ('en', 'en'), ('ensub', 'en')):
    t, lines = 0, []
    for i in range(10):
        t += GAP_BEFORE[i]
        slot = dur[voice][i] + .35
        if ver == 'ensub': slot = max(slot, len(PL[i]) / 15 + 1.5 + .1)
        lines.append({'n': i + 1, 't': round(t, 2), 'slot': round(slot, 2), 'd': dur[voice][i], 'pl': PL[i], 'en': EN[i]})
        t += slot
    DUR = round(t + 3.6, 2)
    json.dump({'ver': ver, 'lang': 'pl' if ver == 'pl' else 'en', 'subs': ver == 'ensub', 'voice': voice, 'dur': DUR, 'lines': lines}, open(f'timeline_{ver}.json', 'w'), ensure_ascii=False, indent=1)
    print(ver, 'DUR', DUR, [L['t'] for L in lines])
