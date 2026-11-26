// Stadt Land Fluss: a letter is drawn, everyone finds a word for every category that starts with it.
// Scoring per category: the only valid answer in it 20, a unique answer 10, the same answer as someone else 5.
// Answers that do not start with the letter count 0, and so does an answer most other players vote down.
export type Lang = 'de' | 'en';
export type Cat = { k?: string; label: string }; // k: a built-in category the bots know words for

export const CLASSIC: { k: string; de: string; en: string }[] = [
  { k: 'city', de: 'Stadt', en: 'City' }, { k: 'country', de: 'Land', en: 'Country' }, { k: 'river', de: 'Fluss', en: 'River' },
  { k: 'name', de: 'Name', en: 'Name' }, { k: 'animal', de: 'Tier', en: 'Animal' }, { k: 'job', de: 'Beruf', en: 'Job' },
  { k: 'plant', de: 'Pflanze', en: 'Plant' }, { k: 'food', de: 'Essen', en: 'Food' }, { k: 'sport', de: 'Sportart', en: 'Sport' },
  { k: 'brand', de: 'Marke', en: 'Brand' },
];
export const defaultCats = (lang: Lang): Cat[] => CLASSIC.slice(0, 6).map((c) => ({ k: c.k, label: c[lang] }));

/** Letters to draw: Q, X and Y only when asked for. */
export const letters = (hard: boolean) => [...'ABCDEFGHIJKLMNOPRSTUVWZ', ...(hard ? 'QXY' : '')];

/** For comparing answers: lower case, no accents or umlaut dots, letters only. */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
/** Does the answer start with the letter (Ä counts as A, É as E …)? */
export const fits = (s: string, letter: string) => norm(s).startsWith(letter.toLowerCase());

/**
 * Points for one round. answers: per player one string per category; rejected(pid, ci): voted down.
 * Returns per player the points per category.
 */
export function scoreRound(nCats: number, letter: string, answers: Record<string, string[]>, rejected: (pid: string, ci: number) => boolean) {
  const out: Record<string, number[]> = {};
  const ids = Object.keys(answers);
  for (const id of ids) out[id] = Array(nCats).fill(0);
  for (let ci = 0; ci < nCats; ci++) {
    const valid = ids.filter((id) => { const a = answers[id]?.[ci] ?? ''; return a.trim() && fits(a, letter) && !rejected(id, ci); });
    for (const id of valid) {
      const me = norm(answers[id][ci]);
      const same = valid.filter((o) => o !== id && norm(answers[o][ci]) === me).length;
      out[id][ci] = valid.length === 1 ? 20 : same ? 5 : 10;
    }
  }
  return out;
}
/** What bots vote down: digits, too short, no vowel, the same letter 3 times in a row, long consonant runs. */
export function looksFake(s: string) {
  const w = s.trim().toLowerCase();
  if (!w) return false;
  const letters = norm(w);
  return /\d/.test(w) || letters.length < 3 || !/[aeiouy]/.test(letters) || /(.)\1\1/.test(letters) || /[bcdfghjklmnpqrstvwxz]{5,}/.test(letters) || /^(asd|qwe|xyz|abc)/.test(letters) || /xyz/.test(letters);
}
/** An answer is out when more than half of the other voters reject it. */
export const isRejected = (rejects: number, voters: number) => voters > 0 && rejects * 2 > voters;

// ---------- words the bots know ----------
const W = (s: string) => s.split(' ').map((w) => w.replace(/_/g, ' '));
const SAME = {
  name: W('Anna Andreas Alex Ben Bruno Clara Carlo David Dana Emma Elias Felix Fiona Gabriel Greta Hanna Hugo Ida Ivan Jana Jonas Klara Kevin Lea Leon Mia Max Nina Noah Olivia Oscar Paula Peter Quentin Quirin Rosa Robin Sara Simon Tina Tom Ursula Ulrich Valentin Vera Werner Wanda Xaver Xenia Yasmin Yannick Zoe Zora'),
  brand: W('Adidas Apple Audi BMW Bosch Canon Coca-Cola Dell Disney Ebay Ferrari Fanta Google Gucci Heineken Honda Ikea Intel Jaguar Jeep Kodak Lego Lindt Mazda Microsoft Nike Nokia Nestlé Omega Opel Puma Porsche Philips Rolex Ricola Samsung Sony Swatch Toblerone Tesla Toyota Uber Unilever Visa Volvo Victorinox Walmart Xerox Xbox Yamaha Zara Zalando'),
};
const WORDS: Record<Lang, Record<string, string[]>> = {
  de: {
    ...SAME,
    city: W('Amsterdam Athen Augsburg Aarau Barcelona Basel Berlin Bern Bonn Bremen Brüssel Budapest Chicago Chur Dakar Davos Dortmund Dresden Dublin Düsseldorf Edinburgh Erfurt Essen Florenz Frankfurt Freiburg Genf Genua Graz Hamburg Hannover Helsinki Hongkong Istanbul Innsbruck Interlaken Jena Jerusalem Johannesburg Kairo Kiel Köln Kopenhagen Konstanz Lissabon London Lugano Luzern Lyon Madrid Mailand Marseille Moskau München Neapel New_York Nizza Nürnberg Oslo Osaka Olten Paris Peking Prag Quebec Quito Rom Rostock Rotterdam Salzburg Seoul Stockholm Stuttgart Sydney Tokio Toronto Turin Ulm Uster Utrecht Valencia Venedig Wien Warschau Winterthur Washington Xanten York Zug Zürich Zagreb'),
    country: W('Afghanistan Ägypten Albanien Algerien Andorra Angola Argentinien Armenien Australien Bahamas Belgien Bolivien Bosnien Brasilien Bulgarien Chile China Costa_Rica Dänemark Deutschland Ecuador Elfenbeinküste Estland Finnland Frankreich Gabun Georgien Ghana Griechenland Guatemala Haiti Honduras Indien Indonesien Irak Iran Irland Island Israel Italien Jamaika Japan Jemen Jordanien Kambodscha Kamerun Kanada Kenia Kolumbien Kroatien Kuba Laos Lettland Libanon Liechtenstein Litauen Luxemburg Madagaskar Malta Marokko Mexiko Monaco Mongolei Nepal Neuseeland Niederlande Nigeria Norwegen Oman Österreich Pakistan Panama Peru Polen Portugal Ruanda Rumänien Russland Sambia Schweden Schweiz Senegal Serbien Spanien Südafrika Syrien Tansania Thailand Tschechien Tunesien Türkei Uganda Ukraine Ungarn Uruguay Venezuela Vietnam Zypern'),
    river: W('Aare Amazonas Arno Bode Donau Drau Elbe Ems Euphrat Fulda Ganges Garonne Havel Hudson Iller Inn Isar Jangtse Jordan Kongo Kocher Lahn Lech Limmat Loire Main Mekong Mississippi Mosel Neckar Nil Neisse Oder Orinoco Po Rhein Rhone Reuss Ruhr Saale Saar Seine Spree Tiber Themse Tigris Ural Unstrut Volga Weser Werra Weichsel Yukon Zambezi'),
    animal: W('Affe Adler Ameise Bär Biber Biene Chamäleon Chinchilla Dachs Delfin Dromedar Elefant Esel Eule Ente Fuchs Frosch Flamingo Giraffe Gans Gorilla Hase Hund Hai Igel Iltis Jaguar Känguru Katze Koala Kuh Löwe Luchs Lama Maus Marder Möwe Nashorn Nilpferd Otter Orca Pinguin Panda Pferd Qualle Rabe Reh Robbe Schaf Schwein Storch Tiger Taube Uhu Unke Vogel Viper Wolf Wal Wiesel Yak Zebra Ziege'),
    job: W('Arzt Anwalt Architekt Bäcker Bauer Busfahrer Chemiker Coiffeur Dachdecker Dirigent Elektriker Erzieher Förster Friseur Gärtner Geologe Hebamme Hausmeister Imker Ingenieur Journalist Jäger Koch Kellner Lehrer Lokführer Maler Maurer Metzger Notar Optiker Pilot Polizist Physiker Richter Redakteur Schreiner Schneider Tischler Tierarzt Uhrmacher Übersetzer Verkäufer Wirt Winzer Yogalehrer Zahnarzt Zimmermann'),
    plant: W('Ahorn Aloe Birke Buche Basilikum Chili Dahlie Distel Efeu Eiche Enzian Farn Flieder Geranie Gänseblümchen Hortensie Hanf Iris Ingwer Jasmin Kaktus Kastanie Lavendel Lilie Linde Mohn Minze Nelke Narzisse Orchidee Oleander Palme Petersilie Quitte Rose Rosmarin Salbei Sonnenblume Tulpe Tanne Ulme Veilchen Vergissmeinnicht Weide Wacholder Ysop Zeder Zitrone'),
    food: W('Apfelstrudel Brot Bratwurst Croissant Curry Döner Dampfnudel Eintopf Erbsen Fondue Gulasch Gnocchi Hamburger Honig Joghurt Käse Kartoffel Lasagne Linsen Müesli Nudeln Omelett Pizza Pommes Quark Raclette Rösti Salat Spätzle Tortellini Tiramisu Udon Vanilleeis Waffel Wurst Zopf Zwiebelkuchen'),
    sport: W('Aerobic Badminton Basketball Biathlon Boxen Curling Darts Eishockey Fechten Fussball Golf Handball Hockey Inlineskating Judo Joggen Karate Kanu Klettern Langlauf Leichtathletik Minigolf Motocross Nordic_Walking Polo Quidditch Reiten Rudern Rugby Schach Schwimmen Ski Surfen Tennis Turnen Unihockey Volleyball Wasserball Yoga Zehnkampf'),
  },
  en: {
    ...SAME,
    city: W('Amsterdam Athens Atlanta Barcelona Basel Berlin Bern Boston Brussels Budapest Cairo Chicago Copenhagen Dallas Delhi Denver Dublin Edinburgh Florence Frankfurt Geneva Glasgow Hamburg Helsinki Hong_Kong Houston Istanbul Jakarta Jerusalem Kyoto Lisbon London Los_Angeles Lyon Madrid Manchester Miami Milan Moscow Munich Naples New_York Nice Oslo Osaka Paris Prague Quebec Quito Rome Rio Seattle Seoul Stockholm Sydney Tokyo Toronto Turin Utrecht Valencia Venice Vienna Warsaw Washington York Zagreb Zurich'),
    country: W('Afghanistan Albania Algeria Andorra Angola Argentina Armenia Australia Austria Bahamas Belgium Bolivia Brazil Bulgaria Cambodia Cameroon Canada Chad Chile China Colombia Croatia Cuba Cyprus Denmark Ecuador Egypt Estonia Ethiopia Fiji Finland France Gabon Georgia Germany Ghana Greece Guatemala Haiti Honduras Hungary Iceland India Indonesia Iran Iraq Ireland Israel Italy Jamaica Japan Jordan Kenya Kosovo Kuwait Laos Latvia Lebanon Liechtenstein Lithuania Luxembourg Madagascar Malta Mexico Monaco Mongolia Morocco Nepal Netherlands New_Zealand Nigeria Norway Oman Pakistan Panama Peru Poland Portugal Qatar Romania Russia Rwanda Senegal Serbia Spain Sweden Switzerland Syria Tanzania Thailand Tunisia Turkey Uganda Ukraine Uruguay Venezuela Vietnam Wales Yemen Zambia Zimbabwe'),
    river: W('Amazon Amur Arno Danube Don Elbe Euphrates Ganges Garonne Hudson Indus Jordan Kama Loire Mekong Mississippi Missouri Moselle Niger Nile Ob Oder Orinoco Po Rhine Rhone Seine Severn Shannon Tagus Thames Tiber Tigris Ural Volga Weser Yangtze Yukon Zambezi Colorado Columbia Ebro Fraser Irrawaddy Lena Mackenzie Murray Nelson Ohio Vistula Yenisei'),
    animal: W('Ant Antelope Bear Beaver Bee Camel Cat Cheetah Dog Dolphin Duck Eagle Eel Elephant Falcon Fox Frog Giraffe Goat Gorilla Hare Hawk Horse Ibex Iguana Jaguar Jellyfish Kangaroo Koala Lion Llama Lynx Mole Monkey Mouse Newt Nightingale Octopus Otter Owl Panda Parrot Penguin Quail Rabbit Raven Seal Shark Snake Tiger Turtle Urchin Viper Vulture Walrus Whale Wolf Yak Zebra'),
    job: W('Actor Architect Baker Banker Butcher Carpenter Chef Chemist Dentist Doctor Driver Editor Electrician Engineer Farmer Firefighter Gardener Geologist Hairdresser Hunter Illustrator Inspector Janitor Journalist Judge Keeper Lawyer Librarian Mechanic Musician Nurse Notary Optician Officer Painter Pilot Plumber Reporter Researcher Sailor Singer Surgeon Tailor Teacher Umpire Upholsterer Vet Waiter Writer Yoga_teacher Zookeeper'),
    plant: W('Aloe Ash Basil Birch Cactus Clover Daisy Dandelion Elm Fern Fir Geranium Hazel Holly Ivy Iris Jasmine Juniper Kale Lavender Lily Maple Mint Nettle Oak Orchid Palm Poppy Quince Rose Rosemary Sage Sunflower Thyme Tulip Violet Willow Wisteria Yew Yucca Zinnia'),
    food: W('Apple_pie Bagel Burger Bread Curry Cheese Donut Dumplings Eggs Fondue Fries Granola Gnocchi Hamburger Honey Ice_cream Jam Kebab Lasagne Muffin Noodles Omelette Pancake Pizza Quiche Ramen Risotto Salad Sushi Taco Toast Udon Vanilla_pudding Waffle Yogurt Zucchini_bread'),
    sport: W('Archery Badminton Baseball Basketball Boxing Climbing Cricket Curling Cycling Darts Diving Fencing Football Golf Gymnastics Handball Hockey Ice_hockey Judo Karate Kayaking Lacrosse Marathon Netball Orienteering Polo Quidditch Rowing Rugby Running Sailing Skiing Snooker Surfing Swimming Tennis Triathlon Ultimate Volleyball Wrestling Yoga Zumba'),
  },
};
export type BotSkill = 'easy' | 'mid' | 'hard';
const KNOWS: Record<BotSkill, number> = { easy: 0.45, mid: 0.7, hard: 0.9 };
/** A bot's answers: words it knows for built-in categories, often but not always; custom categories stay empty. */
export function botAnswers(cats: Cat[], letter: string, lang: Lang, skill: BotSkill, rnd = Math.random) {
  return cats.map((c) => {
    const pool = (c.k ? WORDS[lang][c.k] ?? [] : []).filter((w) => fits(w, letter));
    return pool.length && rnd() < KNOWS[skill] ? pool[Math.floor(rnd() * pool.length)] : '';
  });
}
/** Is there at least one bot word for every built-in category (used by the tests)? */
export const botWords = (lang: Lang, k: string) => WORDS[lang][k] ?? [];
