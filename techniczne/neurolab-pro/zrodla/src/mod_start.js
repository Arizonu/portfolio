import { el } from './ui.js';

const MODS = [
  ['kora', 'Kora mózgowa', 'Powierzchnia Conte69 (64 984 wierzchołki), atlas Schaefer-400, sieci Yeo, gradienty łączności, grubość i mielinizacja kory, łączność funkcjonalna z ziarnem (seed).'],
  ['morfologia', 'Morfologia neuronu', 'Rekonstrukcja komórki piramidowej warstwy V z NeuroMorpho.org: morfometria, analiza Sholla, rzędy rozgałęzień i biernie przewodzący model kablowy.'],
  ['blona', 'Biofizyka błony', 'Model Hodgkina–Huxleya w trybie current clamp i voltage clamp: rodziny prądów, krzywa I–V, krzywa f–I, płaszczyzna fazowa i stochastyczny obraz kanałów w błonie.'],
  ['przewodzenie', 'Przewodzenie w aksonie', 'Wieloprzedziałowy model kablowy aksonu z mieliną i bez: kimogram, pomiar prędkości przewodzenia, wpływ średnicy, temperatury i długości międzywęźli.'],
  ['synapsa', 'Synapsa glutaminianergiczna', 'Ultrastruktura w skali nanometrów, dyfuzja glutaminianu w szczelinie, kinetyka AMPA/NMDA z blokiem Mg²⁺, plastyczność krótkotrwała (Tsodyks–Markram) i STDP.'],
  ['siec', 'Dynamika sieci', 'Sieć Brunela z 2000 neuronów typu LIF: wykres rastrowy, aktywność populacji, widmo mocy, rozkład CV ISI i stany SR / AI / SI.']
];

const DATA = [
  ['Powierzchnia kory', 'Conte69, siatka 32k na półkulę (warstwa środkowa), sfera rejestracyjna', 'Van Essen i in., 2012, Cereb. Cortex; pakiet BrainSpace (Vos de Wael i in., 2020)'],
  ['Parcelacja', 'Schaefer 400 obszarów, 7 sieci (Yeo i in., 2011)', 'Schaefer i in., 2018, Cereb. Cortex'],
  ['Hierarchia', 'Klasy Mesulama: idiotypowa, unimodalna, heteromodalna, paralimbiczna', 'Mesulam, 1998, Brain'],
  ['Mapy kory', 'Grubość, T1w/T2w (mielina), krzywizna, gradienty FC G1 i G2, gradient MPC', 'HCP; Margulies i in., 2016, PNAS; Paquola i in., 2019, PLoS Biol.'],
  ['Łączność', 'Średnia macierz łączności funkcjonalnej 400 × 400 (HCP)', 'BrainSpace (Vos de Wael i in., 2020)'],
  ['Neuron', 'C010398B-P2, komórka piramidowa warstwy V, kora somatosensoryczna szczura; plik SWC w standardzie CNG', 'NeuroMorpho.org, archiwum Markram; plik przykładowy LFPy']
];

const MODELS = [
  ['Hodgkin–Huxley', 'kanały Na⁺/K⁺ aksonu kałamarnicy, 6,3 °C, Q₁₀ = 3', 'Hodgkin i Huxley, 1952, J. Physiol.'],
  ['Kabel bierny', 'rozwiązanie stacjonarne na drzewie dendrytycznym metodą Hinesa', 'Rall, 1959; Hines, 1984'],
  ['Receptory AMPA i NMDA', 'kinetyka dwustanowa', 'Destexhe, Mainen i Sejnowski, 1994'],
  ['Blok magnezowy NMDA', 'B(V) = 1 / (1 + [Mg²⁺]/3,57 · e^(−0,062·V))', 'Jahr i Stevens, 1990'],
  ['Plastyczność krótkotrwała', 'model zasobów U, τrec, τfacil', 'Tsodyks i Markram, 1997'],
  ['STDP', 'okno wykładnicze τ₊ = 16,8 ms, τ₋ = 33,7 ms', 'Bi i Poo, 1998; Bi i Poo, 2001'],
  ['Sieć losowa LIF', 'model A: θ = 20 mV, Vr = 10 mV, τ = 20 ms, D = 1,5 ms', 'Brunel, 2000, J. Comput. Neurosci.']
];

function table(head, rows) {
  const t = el('table');
  t.append(el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col', text: h })))));
  const tb = el('tbody');
  for (const r of rows) tb.append(el('tr', null, r.map((c) => el('td', { text: c }))));
  t.append(tb);
  return el('div', { class: 'scroll' }, t);
}

export default {
  id: 'start', tab: 'Start', page: true,
  mount(ctx) {
    const w = el('div', { class: 'about' });
    const wrap = el('div', { class: 'wrap' });
    wrap.append(
      el('h1', { text: 'Pracownia neuronauki obliczeniowej' }),
      el('p', { text: 'Sześć modułów łączy prawdziwe dane anatomiczne z modelami biofizycznymi. Każdy widok 3D można obracać, przybliżać i klikać; wszystkie liczby w panelach są liczone na bieżąco z danych lub z symulacji, w jednostkach SI lub przyjętych w danej dziedzinie.' })
    );
    const mods = el('div', { class: 'mods' });
    for (const [id, t, d] of MODS) mods.append(el('a', { href: '#' + id }, [el('strong', { text: t }), el('span', { text: d })]));
    wrap.append(mods);
    wrap.append(el('h2', { text: 'Dane', style: 'font-size:20px;margin:0' }), table(['Zbiór', 'Zawartość', 'Źródło'], DATA));
    wrap.append(el('h2', { text: 'Modele', style: 'font-size:20px;margin:0' }), table(['Model', 'Postać', 'Źródło'], MODELS));
    wrap.append(el('p', { class: 'small', text: 'Ograniczenia: symulacje są uproszczone (pojedyncze przedziały lub modele punktowe tam, gdzie zaznaczono), a ultrastruktura synapsy jest modelem geometrycznym o typowych wymiarach, nie rekonstrukcją z mikroskopii elektronowej. Atlas i mapy są średnimi grupowymi.' }));
    w.append(wrap);
    ctx.work.append(w);
  },
  unmount() {}
};
