// Kategorien für die Einkaufsliste – in der Reihenfolge, in der man
// ungefähr durch einen typischen Supermarkt läuft.

export const SHOP_CATEGORIES = [
  { id: 'obst', name: 'Obst & Gemüse', icon: '🍎' },
  { id: 'brot', name: 'Brot & Backwaren', icon: '🥖' },
  { id: 'kuehl', name: 'Milch & Kühlregal', icon: '🧀' },
  { id: 'fleisch', name: 'Fleisch & Fisch', icon: '🥩' },
  { id: 'tk', name: 'Tiefkühl', icon: '❄️' },
  { id: 'vorrat', name: 'Nudeln, Reis & Vorrat', icon: '🍝' },
  { id: 'fruehstueck', name: 'Frühstück & Kaffee', icon: '☕' },
  { id: 'suess', name: 'Süßes & Snacks', icon: '🍫' },
  { id: 'getraenke', name: 'Getränke', icon: '🥤' },
  { id: 'drogerie', name: 'Drogerie', icon: '🧴' },
  { id: 'haushalt', name: 'Haushalt & Putzen', icon: '🧽' },
  { id: 'sonstiges', name: 'Sonstiges', icon: '📦' },
];

// Stichwörter -> Kategorie. Ein Stichwort passt auch als Teil eines Wortes
// ("Hafermilch" enthält "milch").
const KEYWORDS = {
  obst: 'obst gemüse apfel äpfel banane birne orange zitrone limette traube beere erdbeer himbeer heidelbeer blaubeer kiwi mango ananas melone avocado tomate gurke paprika zwiebel knoblauch kartoffel möhre karotte salat rucola spinat brokkoli blumenkohl zucchini aubergine pilz champignon lauch porree sellerie ingwer kräuter petersilie basilikum schnittlauch koriander minze radieschen kohl kürbis bete frühlingszwiebel süßkartoffel',
  brot: 'brot brötchen toast baguette croissant brezel laugen knäckebrot wraps tortilla kuchen semmel',
  kuehl: 'milch joghurt jogurt quark käse butter sahne schmand fraîche fraiche frischkäse mozzarella feta halloumi parmesan gouda eier tofu hummus margarine skyr kefir buttermilch pudding gnocchi',
  fleisch: 'fleisch fisch hähnchen huhn hühnchen pute hack wurst salami schinken speck steak schnitzel lachs garnelen würstchen aufschnitt chorizo bacon',
  tk: 'tiefkühl pizza pommes fischstäbchen speiseeis eiswürfel tk-',
  vorrat: 'nudel spaghetti penne fusilli pasta lasagne reis mehl zucker salz pfeffer gewürz öl essig linsen bohnen kichererbsen mais dose konserve tomatenmark passierte brühe soße sauce ketchup senf mayo pesto backpulver hefe couscous bulgur thunfisch erdnussbutter',
  fruehstueck: 'kaffee tee müsli cornflakes haferflocken marmelade konfitüre honig nutella nuss-nougat kakao',
  suess: 'schokolade schoki keks kekse chips gummibärchen süßigkeit nüsse erdnüsse popcorn riegel cracker salzstangen',
  getraenke: 'wasser sprudel saft cola limo limonade bier wein sekt mate eistee schorle energy',
  drogerie: 'zahnpasta zahnbürste zahnseide shampoo spülung duschgel seife deo klopapier toilettenpapier taschentücher rasier creme sonnencreme tampons binden watte pflaster kosmetik wattestäbchen',
  haushalt: 'spülmittel spülmaschinentabs spültabs tabs waschmittel weichspüler müllbeutel müllsäcke schwamm putzmittel reiniger küchenrolle alufolie frischhaltefolie backpapier batterien glühbirne kerzen filter entkalker lappen klarspüler',
};

const LIST = Object.entries(KEYWORDS).flatMap(([category, words]) =>
  words.split(' ').map((word) => ({ word, category })));
const EXACT = { ei: 'kuehl', eis: 'tk', tk: 'tk' };

// Rät die Kategorie. Bei zusammengesetzten Wörtern zählt das Ende
// ("Orangensaft" -> Getränke, "Milchschokolade" -> Süßes).
export function guessCategory(name) {
  const text = String(name ?? '').toLowerCase().trim();
  if (EXACT[text]) return EXACT[text];
  let best = null;
  for (const { word, category } of LIST) {
    const at = text.lastIndexOf(word);
    if (at < 0) continue;
    const end = at + word.length;
    if (!best || end > best.end || (end === best.end && word.length > best.length)) {
      best = { end, length: word.length, category };
    }
  }
  return best?.category ?? 'sonstiges';
}
