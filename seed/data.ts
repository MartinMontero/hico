// Demo seed (D-22, D-25). Built from the prototype's data with these deliberate changes:
// - numeric ratings dropped (D-17), invented guest names dropped (gatherings and signals are not seeded);
// - every row is_placeholder = 1 and every verification field empty;
// - the HI Whistler cafe is spelled Cheaky's Cafe (D-14; the prototype source says Cheekye's and is wrong);
// - unverified claims dropped (02 row 9): the $5.95 menu, "Save $20 with HI membership", the bungee
//   phone number and the bakery's opening days; "HI Staff" becomes "Staff" (no HI mark, D-21).
// - dorm names never appear (02 row 2).
import { newId } from '../worker/ids.ts';

interface ActivitySeed {
  key: string;
  titleEn: string;
  titleFr: string;
  descEn: string;
  descFr: string;
  category: 'adventure' | 'social' | 'wellness' | 'culture' | 'outdoor';
  zone: string | null;
  host: string;
  weekday: number; // 0 = Sunday
  start: string;
  end?: string;
}

interface PlaceSeed {
  name: string;
  category: 'trails' | 'food' | 'drinks' | 'culture' | 'adventure';
  pick: boolean;
  noteEn: string;
  noteFr: string;
  walkEn?: string;
  walkFr?: string;
}

const TZ = 'America/Vancouver';

export const whistlerActivities: ActivitySeed[] = [
  { key: 'volleyball', titleEn: 'Volleyball Tournament', titleFr: 'Tournoi de volleyball', descEn: 'All-comers volleyball. Teams formed on the spot. Show up and play. Sign up at the front desk.', descFr: "Volleyball ouvert à tous. Les équipes se forment sur place. Présentez-vous et jouez. Inscription à la réception.", category: 'social', zone: null, host: 'Staff', weekday: 1, start: '15:00' },
  { key: 'pool', titleEn: 'Pool Tournament', titleFr: 'Tournoi de billard', descEn: 'Bracket-style pool tournament in the common room. The winner gets bragging rights and a free drink.', descFr: "Tournoi de billard à élimination dans la salle commune. Le gagnant a droit à l'honneur et à une boisson gratuite.", category: 'social', zone: 'common', host: 'Staff', weekday: 2, start: '19:00' },
  { key: 'axe', titleEn: 'Axe Throwing', titleFr: 'Lancer de hache', descEn: "Group outing to an axe-throwing venue. You'll learn something new and it's surprisingly calming.", descFr: "Sortie de groupe dans un lieu de lancer de hache. Vous apprendrez quelque chose et c'est étonnamment apaisant.", category: 'adventure', zone: null, host: 'Staff', weekday: 3, start: '14:00' },
  { key: 'pubcrawl', titleEn: 'Pub Crawl', titleFr: 'Tournée des pubs', descEn: "We know where we're going. You might be slightly lost. Trust the process.", descFr: 'Nous savons où nous allons. Vous serez peut-être un peu perdu. Faites confiance au processus.', category: 'social', zone: 'lobby', host: 'Staff', weekday: 4, start: '20:00' },
  { key: 'trivia', titleEn: 'Trivia Night', titleFr: 'Soirée-questionnaire', descEn: "Happy hour and trivia at Cheaky's Cafe. Show off and you might learn something.", descFr: "Rabais de l'heureux et questionnaire au Cheaky's Cafe. Montrez ce que vous savez et vous apprendrez peut-être quelque chose.", category: 'social', zone: 'common', host: 'Staff', weekday: 5, start: '20:00' },
  { key: 'trainwreck', titleEn: 'Train Wreck Hike', titleFr: 'Randonnée de la Train Wreck', descEn: 'Forest trails, a suspension bridge and old train cars covered in graffiti art. Easy one-hour return hike. All levels welcome.', descFr: 'Sentiers en forêt, un pont suspendu et de vieux wagons couverts de graffitis. Randonnée facile, une heure aller-retour. Tous les niveaux sont bienvenus.', category: 'adventure', zone: 'lobby', host: 'Staff', weekday: 6, start: '10:00' },
  { key: 'yoga', titleEn: 'Morning Yoga', titleFr: 'Yoga du matin', descEn: 'Gentle morning flow on the deck overlooking the lake. Mats provided, no experience needed.', descFr: "Séance douce du matin sur la terrasse, face au lac. Tapis fournis, aucune expérience requise.", category: 'wellness', zone: 'deck', host: 'Guest leader', weekday: 0, start: '08:30' },
  { key: 'concert', titleEn: 'Lakeside Concert', titleFr: 'Concert au bord du lac', descEn: 'Live music at the artist centre on Alta Lake.', descFr: "Musique en direct au centre d'artistes sur le lac Alta.", category: 'culture', zone: null, host: 'The Point Artists', weekday: 0, start: '15:30' },
  { key: 'cheakamus', titleEn: 'Cheakamus River Hike', titleFr: 'Randonnée de la rivière Cheakamus', descEn: 'Suspension bridge loop, 3 km, easy, about two hours. Follow the sign past the highway bridge to the trailhead.', descFr: "Boucle du pont suspendu, 3 km, facile, environ deux heures. Suivez le panneau après le pont de l'autoroute jusqu'au départ du sentier.", category: 'adventure', zone: 'lobby', host: 'Staff', weekday: 3, start: '09:00' },
  { key: 'garibaldi', titleEn: 'Garibaldi Lake Day Trip', titleFr: 'Excursion au lac Garibaldi', descEn: '9 km one way, moderate to hard. A turquoise alpine lake. Pack lunch, water and layers. An early start is essential.', descFr: 'Neuf km aller simple, difficulté modérée à difficile. Un lac alpin turquoise. Apportez lunch, eau et vêtements en couches. Un départ tôt est essentiel.', category: 'adventure', zone: 'lobby', host: 'Staff', weekday: 6, start: '07:30' },
];

export const whistlerPlaces: PlaceSeed[] = [
  { name: 'Train Wreck Trail', category: 'trails', pick: true, noteEn: "Forest trail to abandoned train cars covered in street art, with a suspension bridge. Easy.", noteFr: "Sentier en forêt vers des wagons abandonnés couverts d'art de rue, avec un pont suspendu. Facile.", walkEn: '1 km, about 30 min', walkFr: '1 km, environ 30 min' },
  { name: 'Cheakamus River Suspension Bridge', category: 'trails', pick: false, noteEn: 'River views and a swaying suspension bridge. Easy loop.', noteFr: 'Vues sur la rivière et pont suspendu qui oscille. Boucle facile.', walkEn: '3 km loop, about 2 h', walkFr: 'Boucle de 3 km, environ 2 h' },
  { name: 'Crater Rim Trail', category: 'trails', pick: false, noteEn: 'Views of the volcanic crater. Easy to moderate. Watch for off-road vehicle traffic.', noteFr: 'Vues sur le cratère volcanique. Facile à modéré. Attention aux véhicules hors route.', walkEn: '6 km return, about 3 h', walkFr: '6 km aller-retour, environ 3 h' },
  { name: 'Garibaldi Lake Trail', category: 'trails', pick: true, noteEn: "A turquoise alpine lake, one of BC's best day hikes. Moderate.", noteFr: "Un lac alpin turquoise, l'une des plus belles randonnées d'une journée en C.-B. Modéré.", walkEn: '18 km return, 6 to 7 h', walkFr: '18 km aller-retour, 6 à 7 h' },
  { name: 'Rainbow Trail', category: 'trails', pick: false, noteEn: 'Alpine meadows and mountain views. Moderate.', noteFr: 'Prairies alpines et vues sur les montagnes. Modéré.', walkEn: '10 km return, about 4 h', walkFr: '10 km aller-retour, environ 4 h' },
  { name: 'Brandywine Falls', category: 'trails', pick: true, noteEn: 'A short walk to a 70-metre waterfall. Quick and spectacular.', noteFr: 'Courte marche jusqu\'à une chute de 70 mètres. Rapide et spectaculaire.', walkEn: '1 km, about 30 min', walkFr: '1 km, environ 30 min' },
  { name: 'Singing Pass', category: 'trails', pick: false, noteEn: 'Alpine ridge walking. Hard. Bring layers and water, and start early.', noteFr: "Marche en crête alpine. Difficile. Apportez des vêtements en couches et de l'eau, et partez tôt.", walkEn: '26 km return, 8 to 10 h', walkFr: '26 km aller-retour, 8 à 10 h' },
  { name: 'El Furniture Warehouse (Fernie\'s)', category: 'food', pick: true, noteEn: 'The go-to budget meal. Burgers, nachos and wraps.', noteFr: "L'adresse économique par excellence. Burgers, nachos et wraps." },
  { name: 'Chubby Dudes Donairs, Kebabs, Poutine', category: 'food', pick: false, noteEn: 'Late-night donairs and loaded poutine.', noteFr: 'Donairs et poutines bien garnies tard le soir.' },
  { name: 'Samurai Bowl', category: 'food', pick: false, noteEn: 'Japanese comfort food: fried chicken, poke bowls, ramen.', noteFr: 'Cuisine japonaise réconfortante : poulet frit, bols poké, ramen.' },
  { name: 'Functional Pie Pizzeria', category: 'food', pick: true, noteEn: 'Wood-fired pizza. The margherita is the move.', noteFr: 'Pizza au four à bois. La margherita est un bon choix.' },
  { name: 'Purebread', category: 'food', pick: true, noteEn: 'Pastries, soups and sandwiches, baked fresh.', noteFr: 'Pâtisseries, soupes et sandwichs cuits sur place.', walkEn: 'About 10 min on foot', walkFr: 'Environ 10 min à pied' },
  { name: 'Harajuku Izakaya', category: 'food', pick: false, noteEn: 'Japanese izakaya with small plates and drinks. Cozy.', noteFr: 'Izakaya japonais avec petites assiettes et boissons. Ambiance chaleureuse.' },
  { name: 'Southside Diner', category: 'food', pick: false, noteEn: 'Comfort food in a 50s-style diner. Big breakfasts, burgers, milkshakes.', noteFr: 'Cuisine réconfortante dans un resto de style années 50. Gros déjeuners, burgers, laits frappés.' },
  { name: "Tapley's Neighbourhood Pub", category: 'drinks', pick: true, noteEn: 'A favourite après spot. Good food, friendly staff, local feel.', noteFr: 'Un incontournable de l\'après-ski. Bonne cuisine, personnel sympathique, ambiance locale.' },
  { name: 'Crystal Lounge', category: 'drinks', pick: false, noteEn: 'Cocktails in a mountain setting. Good for a special evening.', noteFr: 'Cocktails en décor de montagne. Idéal pour une soirée spéciale.' },
  { name: 'Dubh Linn Gate Pub', category: 'drinks', pick: true, noteEn: 'Irish pub known for its nachos. Live music some nights.', noteFr: 'Pub irlandais réputé pour ses nachos. Musique en direct certains soirs.' },
  { name: "Merlin's Pub", category: 'drinks', pick: false, noteEn: 'A pub at the base of the mountain. A classic after the slopes.', noteFr: 'Pub au pied de la montagne. Un classique après les pentes.' },
  { name: "Squamish Lil'wat Cultural Centre", category: 'culture', pick: true, noteEn: "Learn about the area's First Nations through art, exhibits and guided tours.", noteFr: 'Découvrez les Premières Nations de la région par l\'art, les expositions et les visites guidées.' },
  { name: 'Audain Art Museum', category: 'culture', pick: false, noteEn: 'A permanent collection spanning the 18th century to today, including Northwest Coast First Nations artists.', noteFr: "Une collection permanente du XVIIIe siècle à aujourd'hui, incluant des artistes des Premières Nations de la côte nord-ouest." },
  { name: 'Whistler Museum', category: 'culture', pick: false, noteEn: "Explore Whistler's history. Located next to the library.", noteFr: "Explorez l'histoire de Whistler. Situé à côté de la bibliothèque." },
  { name: 'Whistler Bungee', category: 'adventure', pick: false, noteEn: 'A bungee jump over the Cheakamus River.', noteFr: 'Un saut à l\'élastique au-dessus de la rivière Cheakamus.' },
  { name: 'Canadian Outback Rafting', category: 'adventure', pick: true, noteEn: 'Whitewater or gentle scenic rafting trips.', noteFr: "Descentes de rivière en eaux vives ou en balade tranquille." },
  { name: 'Whistler Mountain Bike Park', category: 'adventure', pick: true, noteEn: 'Gravity-fed downhill biking with trails from green to double black.', noteFr: 'Vélo de descente avec sentiers du niveau vert au double noir.' },
];

// Shared sample activities for the two Vancouver properties (D-15, D-25). Titles and legible times
// come from the Jericho board (jericho-transcription.md 1a); prices and details are not carried over.
export const vancouverSharedActivities: ActivitySeed[] = [
  { key: 'dogmountain', titleEn: 'Dog Mountain Hike', titleFr: 'Randonnée à Dog Mountain', descEn: 'Group hike. Sample entry: confirm details at the desk.', descFr: "Randonnée en groupe. Exemple : confirmez les détails à la réception.", category: 'adventure', zone: 'lobby', host: 'Staff', weekday: 4, start: '10:00' },
  { key: 'games', titleEn: 'Games Night', titleFr: 'Soirée de jeux', descEn: 'Games night in the lounge. Sample entry: confirm details at the desk.', descFr: 'Soirée de jeux au salon. Exemple : confirmez les détails à la réception.', category: 'social', zone: 'lobby', host: 'Staff', weekday: 4, start: '18:00' },
  { key: 'movie', titleEn: 'Movie & Trivia Night', titleFr: 'Soirée cinéma et questionnaire', descEn: 'Movie and trivia in the dining room. Sample entry: confirm details at the desk.', descFr: 'Cinéma et questionnaire dans la salle à manger. Exemple : confirmez les détails à la réception.', category: 'social', zone: 'lobby', host: 'Staff', weekday: 0, start: '19:00' },
];

export const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

const WHISTLER_ZONES: [string, string, string, 'in_hostel' | 'short_walk' | 'further'][] = [
  ['lobby', 'Lobby', 'Hall', 'in_hostel'],
  ['common', 'Common room', 'Salle commune', 'in_hostel'],
  ['deck', 'Deck', 'Terrasse', 'in_hostel'],
  ['out', 'Out and about', 'En sortie', 'further'],
];
const VANCOUVER_ZONES: [string, string, string, 'in_hostel' | 'short_walk' | 'further'][] = [
  ['lobby', 'Lobby', 'Hall', 'in_hostel'],
  ['out', 'Out and about', 'En sortie', 'further'],
];

const sql = (v: string | number | null): string =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replaceAll("'", "''")}'`;

/** Builds the full demo seed as SQL text. `now` is epoch seconds. */
export function buildSeedSql(now: number): string {
  const out: string[] = [];
  // Reset the tenant tables, children first. This script only ever runs against local D1 (seed/run.ts).
  for (const t of [
    'activity_exceptions', 'activity_offered_at', 'activities', 'places', 'offers', 'audit_log',
    'event_counts', 'entry_codes', 'property_features', 'staff_memberships', 'staff_users',
    'zones', 'property_hosts', 'properties',
  ]) out.push(`DELETE FROM ${t};`);
  out.push(`UPDATE platform_flags SET value = 'off' WHERE key = 'read_only';`);

  const props = [
    { slug: 'demo-whistler', en: 'Whistler', fr: 'Whistler', zones: WHISTLER_ZONES },
    { slug: 'vancouver-downtown', en: 'Vancouver Downtown', fr: 'Vancouver centre-ville', zones: VANCOUVER_ZONES },
    { slug: 'vancouver-jericho-beach', en: 'Vancouver Jericho Beach', fr: 'Vancouver Jericho Beach', zones: VANCOUVER_ZONES },
  ].map((p) => ({ ...p, id: newId(), zoneIds: new Map(p.zones.map((z) => [z[0], newId()])) }));

  for (const p of props) {
    out.push(
      `INSERT INTO properties (id, slug, name_en, name_fr, timezone, address, languages, created_at) VALUES (${sql(p.id)}, ${sql(p.slug)}, ${sql(p.en)}, ${sql(p.fr)}, ${sql(TZ)}, '', 'en,fr', ${now});`,
    );
    for (const host of LOCAL_HOSTS) {
      out.push(`INSERT INTO property_hosts (id, host, property_id, is_default) VALUES (${sql(newId())}, ${sql(host)}, ${sql(p.id)}, 0);`);
    }
    for (const [key, en, fr, ring] of p.zones) {
      out.push(`INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (${sql(p.zoneIds.get(key) as string)}, ${sql(p.id)}, ${sql(en)}, ${sql(fr)}, ${sql(ring)});`);
    }
  }

  const activityRows = (
    owner: (typeof props)[number],
    offeredAt: (typeof props)[number][],
    list: ActivitySeed[],
  ) => {
    for (const a of list) {
      const id = newId();
      const zoneId = a.zone ? (owner.zoneIds.get(a.zone) ?? null) : null;
      out.push(
        `INSERT INTO activities (id, property_id, title_en, title_fr, description_en, description_fr, category, zone_id, host_label, timezone, weekday, start_local, end_local, status, is_placeholder, created_at, updated_at) VALUES (${sql(id)}, ${sql(owner.id)}, ${sql(a.titleEn)}, ${sql(a.titleFr)}, ${sql(a.descEn)}, ${sql(a.descFr)}, ${sql(a.category)}, ${sql(zoneId)}, ${sql(a.host)}, ${sql(TZ)}, ${a.weekday}, ${sql(a.start)}, ${sql(a.end ?? null)}, 'active', 1, ${now}, ${now});`,
      );
      for (const p of offeredAt) {
        out.push(`INSERT INTO activity_offered_at (activity_id, owner_property_id, property_id) VALUES (${sql(id)}, ${sql(owner.id)}, ${sql(p.id)});`);
      }
    }
  };

  const whistler = props[0]!;
  const downtown = props[1]!;
  const jericho = props[2]!;
  activityRows(whistler, [whistler], whistlerActivities);
  activityRows(downtown, [downtown, jericho], vancouverSharedActivities);

  for (const p of whistlerPlaces) {
    out.push(
      `INSERT INTO places (id, property_id, category, name, staff_pick, note_en, note_fr, walk_time_en, walk_time_fr, is_placeholder, created_at, updated_at) VALUES (${sql(newId())}, ${sql(whistler.id)}, ${sql(p.category)}, ${sql(p.name)}, ${p.pick ? 1 : 0}, ${sql(p.noteEn)}, ${sql(p.noteFr)}, ${sql(p.walkEn ?? '')}, ${sql(p.walkFr ?? '')}, 1, ${now}, ${now});`,
    );
  }
  return out.join('\n') + '\n';
}
