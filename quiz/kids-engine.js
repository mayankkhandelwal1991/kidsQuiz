/* ============================================================
   KIDS ENGINE — interactive LKG / UKG quiz papers
   ------------------------------------------------------------
   Every LKG/UKG category below builds PAPERS of 10 questions from a
   seeded random generator, so "Paper 3" is always the same paper for
   everyone, and there are as many papers as we like (PAPERS_PER_CAT).

   Question shapes the player (play.html) knows how to show:
     { type:'pick',  prompt, say, show?, options:[opt], answer:id, cols? }
     { type:'count', prompt, say, items:[{pic, target}], options, answer }
     { type:'tapall',prompt, say, items:[{id, pic, target}] }
   Option shapes:
     {id, pic}            big picture   (pic = emoji, drawn as an image)
     {id, pic, scale}     picture at a size (big / small questions)
     {id, swatch:'#hex'}  colour blob
     {id, shape, color}   SVG shape
     {id, text}           big letter / number / word
     {id, group:[pic,n]}  a little group of n pictures (more / less)
   Every option also has `say` — what the voice reads for it.
   ============================================================ */
(function () {
  'use strict';

  const PAPERS_PER_CAT = 12;
  const Q_PER_PAPER = 10;

  /* ---------------- picture bank: key -> [emoji, name] ---------------- */
  const P = {
    dog: ['🐶', 'Dog'], cat: ['🐱', 'Cat'], cow: ['🐄', 'Cow'], lion: ['🦁', 'Lion'], tiger: ['🐯', 'Tiger'],
    elephant: ['🐘', 'Elephant'], monkey: ['🐒', 'Monkey'], rabbit: ['🐰', 'Rabbit'], bear: ['🐻', 'Bear'],
    panda: ['🐼', 'Panda'], pig: ['🐷', 'Pig'], sheep: ['🐑', 'Sheep'], horse: ['🐴', 'Horse'], duck: ['🦆', 'Duck'],
    hen: ['🐔', 'Hen'], chick: ['🐥', 'Chick'], frog: ['🐸', 'Frog'], fish: ['🐟', 'Fish'], owl: ['🦉', 'Owl'],
    penguin: ['🐧', 'Penguin'], giraffe: ['🦒', 'Giraffe'], zebra: ['🦓', 'Zebra'], camel: ['🐫', 'Camel'],
    snake: ['🐍', 'Snake'], turtle: ['🐢', 'Turtle'], butterfly: ['🦋', 'Butterfly'], bee: ['🐝', 'Bee'],
    ladybug: ['🐞', 'Ladybug'], mouse: ['🐭', 'Mouse'], goat: ['🐐', 'Goat'], parrot: ['🦜', 'Parrot'],
    dolphin: ['🐬', 'Dolphin'], whale: ['🐳', 'Whale'], octopus: ['🐙', 'Octopus'], crab: ['🦀', 'Crab'],
    fox: ['🦊', 'Fox'], koala: ['🐨', 'Koala'], kangaroo: ['🦘', 'Kangaroo'], dino: ['🦕', 'Dinosaur'],
    bird: ['🐦', 'Bird'], snail: ['🐌', 'Snail'], ant: ['🐜', 'Ant'],

    apple: ['🍎', 'Apple'], banana: ['🍌', 'Banana'], mango: ['🥭', 'Mango'], grapes: ['🍇', 'Grapes'],
    orange: ['🍊', 'Orange'], strawberry: ['🍓', 'Strawberry'], watermelon: ['🍉', 'Watermelon'],
    pineapple: ['🍍', 'Pineapple'], cherry: ['🍒', 'Cherries'], pear: ['🍐', 'Pear'], lemon: ['🍋', 'Lemon'],
    kiwi: ['🥝', 'Kiwi'], peach: ['🍑', 'Peach'], coconut: ['🥥', 'Coconut'],
    carrot: ['🥕', 'Carrot'], potato: ['🥔', 'Potato'], tomato: ['🍅', 'Tomato'], corn: ['🌽', 'Corn'],
    broccoli: ['🥦', 'Broccoli'], brinjal: ['🍆', 'Brinjal'], onion: ['🧅', 'Onion'], cucumber: ['🥒', 'Cucumber'],
    capsicum: ['🫑', 'Capsicum'], garlic: ['🧄', 'Garlic'], mushroom: ['🍄', 'Mushroom'], pumpkin: ['🎃', 'Pumpkin'],

    car: ['🚗', 'Car'], bus: ['🚌', 'Bus'], train: ['🚂', 'Train'], plane: ['✈️', 'Aeroplane'], ship: ['🚢', 'Ship'],
    boat: ['⛵', 'Sailboat'], bicycle: ['🚲', 'Bicycle'], motorbike: ['🏍️', 'Motorbike'], helicopter: ['🚁', 'Helicopter'],
    rocket: ['🚀', 'Rocket'], truck: ['🚚', 'Truck'], tractor: ['🚜', 'Tractor'], ambulance: ['🚑', 'Ambulance'],
    fireengine: ['🚒', 'Fire engine'], police: ['🚓', 'Police car'], scooter: ['🛵', 'Scooter'], canoe: ['🛶', 'Canoe'],

    eye: ['👁️', 'Eye'], ear: ['👂', 'Ear'], nose: ['👃', 'Nose'], mouth: ['👄', 'Mouth'], tongue: ['👅', 'Tongue'],
    hand: ['✋', 'Hand'], foot: ['🦶', 'Foot'], leg: ['🦵', 'Leg'], tooth: ['🦷', 'Tooth'], brain: ['🧠', 'Brain'],

    ball: ['⚽', 'Ball'], teddy: ['🧸', 'Teddy bear'], kite: ['🪁', 'Kite'], balloon: ['🎈', 'Balloon'], drum: ['🥁', 'Drum'],
    robot: ['🤖', 'Robot'], gift: ['🎁', 'Gift'], umbrella: ['☂️', 'Umbrella'], hat: ['🎩', 'Hat'], icecream: ['🍦', 'Ice cream'],
    cake: ['🎂', 'Cake'], egg: ['🥚', 'Egg'], house: ['🏠', 'House'], star: ['⭐', 'Star'], sun: ['🌞', 'Sun'],
    moon: ['🌙', 'Moon'], cloud: ['☁️', 'Cloud'], rain: ['🌧️', 'Rain'], snow: ['❄️', 'Snowflake'], rainbow: ['🌈', 'Rainbow'],
    tree: ['🌳', 'Tree'], flower: ['🌸', 'Flower'], leaf: ['🍃', 'Leaf'], heart: ['❤️', 'Heart'], pizza: ['🍕', 'Pizza'],
    books: ['📚', 'Books'], pencil: ['✏️', 'Pencil'], clock: ['⏰', 'Clock'], bell: ['🔔', 'Bell'], shoe: ['👟', 'Shoe'],
    shirt: ['👕', 'Shirt'], crown: ['👑', 'Crown'], queen: ['👸', 'Queen'], yoyo: ['🪀', 'Yo-yo'], violin: ['🎻', 'Violin'],
    juice: ['🧃', 'Juice'], dice: ['🎲', 'Dice'], candy: ['🍬', 'Candy'], cookie: ['🍪', 'Cookie'], milk: ['🥛', 'Milk'],
    snowman: ['⛄', 'Snowman'], fire: ['🔥', 'Fire'], phone: ['📱', 'Phone'], tv: ['📺', 'TV'], bed: ['🛏️', 'Bed'],
    toothbrush: ['🪥', 'Toothbrush'], soap: ['🧼', 'Soap'], spoon: ['🥄', 'Spoon'], bin: ['🗑️', 'Dustbin'],
    fries: ['🍟', 'Chips'], soda: ['🥤', 'Cold drink'], scarf: ['🧣', 'Scarf'], gloves: ['🧤', 'Gloves'],
    cap: ['🧢', 'Cap'], sunglasses: ['🕶️', 'Sunglasses'], door: ['🚪', 'Door'], tissue: ['🧻', 'Tissue'],
    bread: ['🍞', 'Bread'], water: ['💧', 'Water'], question: ['❓', '?'],
  };
  const pic = (k) => P[k][0];
  const nm = (k) => P[k][1];

  const G = {
    animals: ['dog', 'cat', 'cow', 'lion', 'tiger', 'elephant', 'monkey', 'rabbit', 'bear', 'panda', 'pig', 'sheep', 'horse', 'duck', 'hen', 'frog', 'fish', 'owl', 'penguin', 'giraffe', 'zebra', 'camel', 'snake', 'turtle', 'butterfly', 'bee', 'mouse', 'goat', 'parrot', 'dolphin', 'whale', 'octopus', 'crab', 'fox', 'kangaroo', 'snail'],
    easyAnimals: ['dog', 'cat', 'cow', 'lion', 'elephant', 'monkey', 'rabbit', 'pig', 'duck', 'hen', 'frog', 'fish', 'horse', 'bear', 'sheep', 'giraffe'],
    water: ['fish', 'whale', 'dolphin', 'octopus', 'crab'],
    fly: ['bird', 'butterfly', 'bee', 'owl', 'parrot', 'duck'],
    land: ['dog', 'cat', 'cow', 'lion', 'elephant', 'monkey', 'rabbit', 'pig', 'horse', 'bear', 'giraffe', 'zebra', 'camel', 'goat', 'kangaroo', 'tiger'],
    fruits: ['apple', 'banana', 'mango', 'grapes', 'orange', 'strawberry', 'watermelon', 'pineapple', 'cherry', 'pear', 'lemon', 'kiwi', 'peach', 'coconut'],
    veg: ['carrot', 'potato', 'tomato', 'corn', 'broccoli', 'brinjal', 'onion', 'cucumber', 'capsicum', 'garlic', 'mushroom', 'pumpkin'],
    road: ['car', 'bus', 'truck', 'tractor', 'ambulance', 'fireengine', 'police', 'scooter', 'bicycle', 'motorbike'],
    waterV: ['ship', 'boat', 'canoe'],
    air: ['plane', 'helicopter', 'rocket'],
    vehicles: ['car', 'bus', 'train', 'plane', 'ship', 'boat', 'bicycle', 'helicopter', 'rocket', 'truck', 'tractor', 'ambulance', 'fireengine', 'police', 'scooter', 'motorbike'],
    body: ['eye', 'ear', 'nose', 'mouth', 'tongue', 'hand', 'foot', 'leg', 'tooth'],
    toys: ['ball', 'teddy', 'kite', 'balloon', 'drum', 'robot', 'gift', 'yoyo'],
    sky: ['sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'rainbow'],
    things: ['umbrella', 'hat', 'books', 'pencil', 'clock', 'bell', 'shoe', 'shirt', 'phone', 'tv', 'bed', 'spoon', 'door', 'cap'],
    countables: ['apple', 'star', 'balloon', 'dog', 'cat', 'teddy', 'car', 'flower', 'ball', 'fish', 'duck', 'butterfly', 'strawberry', 'cookie', 'candy', 'banana', 'heart', 'chick', 'icecream', 'bee'],
  };

  const COLOURS = [
    { id: 'red', name: 'Red', hex: '#ef4444' }, { id: 'blue', name: 'Blue', hex: '#3b82f6' },
    { id: 'green', name: 'Green', hex: '#22c55e' }, { id: 'yellow', name: 'Yellow', hex: '#facc15' },
    { id: 'orange', name: 'Orange', hex: '#f97316' }, { id: 'pink', name: 'Pink', hex: '#f472b6' },
    { id: 'purple', name: 'Purple', hex: '#a855f7' }, { id: 'brown', name: 'Brown', hex: '#92400e' },
    { id: 'black', name: 'Black', hex: '#111827' }, { id: 'white', name: 'White', hex: '#ffffff' },
  ];
  const COLOUR_OF = {
    apple: 'red', strawberry: 'red', tomato: 'red', cherry: 'red', fireengine: 'red', heart: 'red',
    banana: 'yellow', lemon: 'yellow', sun: 'yellow', corn: 'yellow', chick: 'yellow', star: 'yellow',
    frog: 'green', leaf: 'green', broccoli: 'green', cucumber: 'green', capsicum: 'green', tree: 'green',
    orange: 'orange', carrot: 'orange', pumpkin: 'orange',
    whale: 'blue', water: 'blue',
    grapes: 'purple', brinjal: 'purple',
    snowman: 'white', cloud: 'white', egg: 'white',
    bear: 'brown', coconut: 'brown', cookie: 'brown',
    pig: 'pink', flower: 'pink', peach: 'pink',
  };
  const SHAPES = ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart', 'oval', 'diamond'];
  const SHAPE_NAME = { circle: 'Circle', square: 'Square', triangle: 'Triangle', rectangle: 'Rectangle', star: 'Star', heart: 'Heart', oval: 'Oval', diamond: 'Diamond' };
  const SHAPE_OF = { ball: 'circle', clock: 'circle', sun: 'circle', pizza: 'triangle', gift: 'square', dice: 'square', egg: 'oval', heart: 'heart', star: 'star', door: 'rectangle', tv: 'rectangle', kite: 'diamond' };
  const SIDES = { triangle: 3, square: 4, rectangle: 4, circle: 0 };
  const SHAPE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];

  const LETTER_WORD = {
    A: 'apple', B: 'ball', C: 'cat', D: 'dog', E: 'egg', F: 'fish', G: 'grapes', H: 'hat', I: 'icecream', J: 'juice',
    K: 'kite', L: 'lion', M: 'monkey', N: 'nose', O: 'orange', P: 'pig', Q: 'queen', R: 'rabbit', S: 'sun', T: 'tiger',
    U: 'umbrella', V: 'violin', W: 'watermelon', Y: 'yoyo', Z: 'zebra',
  };
  // Phonics: letter -> [sound to say, words that start with that sound]. C is the hard "k" sound, so there is no K.
  const SOUND_WORDS = {
    B: ['buh', ['ball', 'bus', 'bee', 'banana', 'bear', 'bed']], C: ['kuh', ['cat', 'cow', 'car', 'cake', 'carrot', 'cookie']],
    D: ['duh', ['dog', 'drum', 'duck', 'dice']], F: ['fff', ['fish', 'fox', 'frog', 'fire']], G: ['guh', ['goat', 'grapes', 'gift']],
    H: ['hah', ['hat', 'hen', 'horse', 'house', 'heart']], L: ['lll', ['lion', 'lemon', 'leaf']], M: ['mmm', ['monkey', 'moon', 'mouse', 'mango', 'milk']],
    P: ['puh', ['pig', 'panda', 'pizza', 'pear', 'pencil']], R: ['rrr', ['rabbit', 'robot', 'rocket', 'rainbow']], S: ['sss', ['sun', 'snake', 'star', 'spoon', 'snail', 'soap']],
    T: ['tuh', ['tiger', 'tree', 'train', 'tomato', 'turtle']], W: ['wuh', ['watermelon', 'whale']], Z: ['zzz', ['zebra']],
  };
  const RHYMES = [['cat', 'hat'], ['frog', 'dog'], ['bee', 'tree'], ['cake', 'snake'], ['moon', 'spoon'], ['star', 'car'], ['house', 'mouse'], ['bear', 'pear'], ['rain', 'train'], ['snail', 'whale']];
  const CVC = ['cat', 'dog', 'sun', 'pig', 'hat', 'bus', 'bed', 'hen'];
  const LOOKALIKE = { b: ['d', 'p', 'q'], d: ['b', 'p', 'q'], p: ['q', 'b', 'd'], q: ['p', 'g', 'd'], m: ['n', 'w', 'u'], n: ['m', 'h', 'u'], u: ['n', 'v', 'w'], w: ['m', 'v', 'u'] };

  const ANIMAL_SOUND = { dog: 'Woof woof', cat: 'Meow meow', cow: 'Moo moo', lion: 'Roar', duck: 'Quack quack', hen: 'Cluck cluck', sheep: 'Baa baa', horse: 'Neigh', pig: 'Oink oink', frog: 'Ribbit ribbit', owl: 'Hoot hoot', bee: 'Buzz buzz', snake: 'Hiss', goat: 'Maa maa', mouse: 'Squeak squeak', monkey: 'Ooh ooh aah aah' };
  const THING_SOUND = { car: 'Beep beep', train: 'Choo choo', ambulance: 'Nee naw nee naw', bicycle: 'Tring tring', plane: 'Zoooom', drum: 'Dum dum dum', bell: 'Ding dong', clock: 'Tick tock', phone: 'Ring ring', rocket: 'Whoosh', police: 'Wee woo wee woo' };
  const BABY = { hen: 'Chick', dog: 'Puppy', cat: 'Kitten', cow: 'Calf', sheep: 'Lamb', lion: 'Cub', horse: 'Foal', duck: 'Duckling', frog: 'Tadpole', goat: 'Kid' };
  const ANIMAL_FACT = [
    ['Which animal has a long trunk?', 'elephant', ['👃', '📏']], ['Which animal has a very long neck?', 'giraffe', ['🌳', '📏']],
    ['Which animal has black and white stripes?', 'zebra', ['⬛', '⬜']], ['Who is the king of the jungle?', 'lion', ['👑', '🌳']],
    ['Which animal carries its house on its back?', 'snail', ['🏠']], ['Which animal jumps and has a pouch?', 'kangaroo', ['🦵', '👶']],
    ['Which animal loves bananas?', 'monkey', ['🍌']], ['Which animal gives us milk?', 'cow', ['🥛']], ['Which animal gives us wool?', 'sheep', ['🧶']],
    ['Which animal is called the ship of the desert?', 'camel', ['🏜️']], ['Which animal makes honey?', 'bee', ['🍯']],
    ['Which bird cannot fly but swims?', 'penguin', ['❄️', '🌊']], ['Which animal has eight legs (arms)?', 'octopus', ['🌊', '8️⃣']],
    ['Which animal moves very slowly with a hard shell?', 'turtle', ['🛡️', '🐌']], ['Which animal is black and white and eats bamboo?', 'panda', ['🎋']],
  ];
  const VEHICLE_FACT = [
    ['Which one takes sick people to hospital?', 'ambulance', ['🤒', '🏥']], ['Which one puts out fires?', 'fireengine', ['🔥']],
    ['Which one runs on railway tracks?', 'train', ['🛤️']], ['Which one goes to space?', 'rocket', ['🪐', '⭐']],
    ['Which one helps the farmer in the field?', 'tractor', ['🧑‍🌾', '🌾']], ['Which one has two wheels and pedals?', 'bicycle', ['2️⃣', '🦶']],
    ['Which one takes children to school?', 'bus', ['🧒', '🏫']], ['Which one catches thieves?', 'police', ['🦹', '🚨']],
    ['Which one flies with big spinning blades on top?', 'helicopter', ['🌀', '☁️']], ['Which one sails on the sea?', 'ship', ['🌊']],
  ];
  const BODY_USE = [
    ['We see with our…', 'eye', ['🌈', '📺']], ['We hear with our…', 'ear', ['🎵', '🔔']], ['We smell with our…', 'nose', ['🌸', '🍕']],
    ['We taste with our…', 'tongue', ['🍦', '🍋']], ['We hold things with our…', 'hand', ['🧸', '⚽']], ['We walk with our…', 'leg', ['🚶']],
    ['We chew food with our…', 'tooth', ['🍎', '🥕']], ['We eat and talk with our…', 'mouth', ['🍪', '💬']],
  ];
  const BODY_COUNT = [['How many eyes do we have?', 2, '👁️'], ['How many noses do we have?', 1, '👃'], ['How many ears do we have?', 2, '👂'],
    ['How many fingers on one hand?', 5, '✋'], ['How many legs do we have?', 2, '🦵'], ['How many hands do we have?', 2, '✋']];
  const SKY_FACT = [
    ['What do we use when it rains?', 'umbrella', ['ball', 'sunglasses', 'kite'], ['🌧️']],
    ['What shines in the sky at night?', 'moon', ['sun', 'rainbow', 'tree'], ['🌃']],
    ['What gives us light in the day?', 'sun', ['moon', 'cloud', 'snow'], ['🌅']],
    ['What do we see in the sky after rain?', 'rainbow', ['snow', 'fire', 'moon'], ['🌧️', '➡️']],
    ['What is very, very cold?', 'snow', ['fire', 'sun', 'cake'], ['🥶']],
    ['What do we wear on a cold winter day?', 'scarf', ['sunglasses', 'cap', 'icecream'], ['🥶', '🧍']],
    ['What do we wear on a sunny day?', 'sunglasses', ['scarf', 'gloves', 'umbrella'], ['🌞', '👀']],
    ['What do we wear on our hands in winter?', 'gloves', ['cap', 'shoe', 'sunglasses'], ['🥶', '✋']],
    ['What do we build with snow?', 'snowman', ['house', 'car', 'tree'], ['❄️', '❄️']],
    ['Rain falls from the…', 'cloud', ['sun', 'tree', 'star'], ['💧', '⬆️']],
    ['What twinkles in the night sky?', 'star', ['sun', 'rainbow', 'umbrella'], ['🌃']],
  ];
  const HABIT_FACT = [
    ['What do we brush our teeth with?', 'toothbrush', ['spoon', 'pencil', 'shoe'], ['🦷']],
    ['What do we wash our hands with?', 'soap', ['candy', 'ball', 'phone'], ['✋', '💧']],
    ['Where do we sleep at night?', 'bed', ['bin', 'tv', 'door'], ['😴', '🌙']],
    ['What do we read?', 'books', ['ball', 'fries', 'shoe'], ['👀', '🔤']],
    ['What do we drink to grow strong?', 'milk', ['soda', 'candy', 'fries'], ['💪']],
    ['Where do we throw rubbish?', 'bin', ['bed', 'books', 'cake'], ['🧃', '⬇️']],
    ['Which food is healthy?', 'apple', ['candy', 'fries', 'soda'], ['💪', '😋']],
    ['What do we wear on our feet?', 'shoe', ['hat', 'gloves', 'scarf'], ['🦶']],
    ['What do we write with?', 'pencil', ['spoon', 'toothbrush', 'ball'], ['✍️']],
    ['What tells us the time?', 'clock', ['bell', 'books', 'cake'], ['⌛']],
    ['What do we use to eat soup?', 'spoon', ['pencil', 'shoe', 'kite'], ['🥣']],
    ['What do we use when we sneeze?', 'tissue', ['ball', 'cake', 'phone'], ['🤧']],
    ['Which one keeps us healthy?', 'carrot', ['candy', 'soda', 'fries'], ['💪', '😋']],
  ];

  /* ---------------- seeded random helpers ---------------- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function makeRng(seed) {
    let a = hashStr(String(seed));
    return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pickR = (r, a) => a[Math.floor(r() * a.length)];
  function shuffleR(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const sampleR = (r, arr, n) => shuffleR(r, arr).slice(0, n);
  const others = (arr, not) => arr.filter((x) => not.indexOf(x) === -1);

  /* ---------------- option builders ---------------- */
  const optPic = (k) => ({ id: k, pic: pic(k), say: nm(k) });
  const optText = (t, say) => ({ id: String(t), text: String(t), say: say || String(t) });
  const optNum = (n) => ({ id: String(n), text: String(n), say: String(n) });
  const optSwatch = (c) => ({ id: c.id, swatch: c.hex, say: c.name });
  const optShape = (r, s) => ({ id: s, shape: s, color: pickR(r, SHAPE_COLORS), say: SHAPE_NAME[s] });

  function picOptions(r, answer, pool, n) {
    return shuffleR(r, [answer].concat(sampleR(r, others(pool, [answer]), n - 1))).map(optPic);
  }
  function numOptions(r, ans, n, min) {
    min = min == null ? 1 : min;
    const set = new Set([ans]);
    const deltas = shuffleR(r, [-2, -1, 1, 2, 3, -3]);
    for (const d of deltas) { if (set.size >= n) break; if (ans + d >= min) set.add(ans + d); }
    let k = 1; while (set.size < n) { set.add(ans + 3 + k); k++; }
    return shuffleR(r, [...set]).map(optNum);
  }
  const plural = (w) => /(s|sh|ch|x)$/i.test(w) ? w : (/y$/.test(w) && !/[aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's');

  /* ================= GENERATORS (r = rng, L = level: 0 LKG, -1 UKG) ================= */
  const isU = (L) => L === -1;
  const NO = (L) => (isU(L) ? 4 : 3); // number of choices

  const GEN = {
    k_count(r, L) {
      const k = pickR(r, G.countables);
      if (isU(L) && r() < 0.35) {
        // count only one kind among two kinds
        const k2 = pickR(r, others(G.countables, [k]));
        const n = ri(r, 2, 7), m = ri(r, 2, 4);
        const items = shuffleR(r, Array(n).fill(0).map(() => ({ pic: pic(k), target: true })).concat(Array(m).fill(0).map(() => ({ pic: pic(k2), target: false }))));
        return { type: 'count', cue: { kind: 'tapcount', pic: pic(k) }, prompt: `Count only the ${plural(nm(k).toLowerCase())} ${pic(k)}`, say: `Count only the ${plural(nm(k).toLowerCase())}. Tap each one!`, items, options: numOptions(r, n, NO(L)), answer: String(n) };
      }
      const n = isU(L) ? ri(r, 3, 10) : ri(r, 1, 5);
      return { type: 'count', cue: { kind: 'tapcount', pic: pic(k) }, prompt: `How many ${plural(nm(k).toLowerCase())}? ${pic(k)}`, say: `How many ${plural(nm(k).toLowerCase())}? Tap each one to count!`, items: Array(n).fill(0).map(() => ({ pic: pic(k), target: true })), options: numOptions(r, n, NO(L)), answer: String(n) };
    },

    k_numbers(r, L) {
      const max = isU(L) ? 20 : 10;
      const kind = isU(L) ? ri(r, 0, 4) : ri(r, 0, 1);
      if (kind === 0) {
        const n = ri(r, 1, max);
        return { type: 'pick', cue: { kind: 'dots', n: n }, prompt: `Tap the number ${n}`, say: `Tap the number ${n}`, options: numOptions(r, n, NO(L), 0), answer: String(n), big: true };
      }
      if (kind === 1) {
        const n = ri(r, 1, isU(L) ? 6 : 5);
        const k = pickR(r, G.countables);
        const ns = shuffleR(r, [n].concat(sampleR(r, others([1, 2, 3, 4, 5, 6], [n]), NO(L) - 1)));
        return { type: 'pick', cue: { kind: 'group', n: n }, prompt: `Which group has ${n}?`, say: `Which group has ${n}?`, show: { text: String(n) }, options: ns.map((x) => ({ id: String(x), group: [pic(k), x], say: String(x) })), answer: String(n), cols: 2 };
      }
      if (kind === 2) {
        const n = ri(r, 1, max - 1);
        return { type: 'pick', cue: { kind: 'after', text: String(n) }, prompt: `What comes after ${n}?`, say: `What number comes after ${n}?`, options: numOptions(r, n + 1, 4, 0), answer: String(n + 1), big: true };
      }
      if (kind === 3) {
        const n = ri(r, 2, max);
        return { type: 'pick', cue: { kind: 'before', text: String(n) }, prompt: `What comes before ${n}?`, say: `What number comes before ${n}?`, options: numOptions(r, n - 1, 4, 0), answer: String(n - 1), big: true };
      }
      const ns = sampleR(r, Array.from({ length: max }, (_, i) => i + 1), 3);
      const big = Math.max.apply(null, ns);
      return { type: 'pick', cue: { kind: 'biggest' }, prompt: 'Tap the BIGGEST number', say: 'Tap the biggest number', options: ns.map(optNum), answer: String(big), big: true };
    },

    k_colours(r, L) {
      const palette = isU(L) ? COLOURS : COLOURS.slice(0, 6);
      const kind = isU(L) ? ri(r, 0, 3) : ri(r, 0, 1);
      if (kind === 0) {
        const c = pickR(r, palette);
        const opts = shuffleR(r, [c].concat(sampleR(r, others(palette, [c]), NO(L) - 1))).map(optSwatch);
        return { type: 'pick', cue: { kind: 'colour', hex: c.hex }, prompt: `Tap ${c.name.toUpperCase()}`, say: `Tap the colour ${c.name}`, options: opts, answer: c.id };
      }
      if (kind === 1) {
        const items = Object.keys(COLOUR_OF).filter((k) => palette.some((c) => c.id === COLOUR_OF[k]));
        const k = pickR(r, items);
        const c = palette.find((x) => x.id === COLOUR_OF[k]);
        const opts = shuffleR(r, [c].concat(sampleR(r, others(palette, [c]), NO(L) - 1))).map(optSwatch);
        const be = /s$/.test(nm(k)) ? 'are' : 'is';
        return { type: 'pick', cue: { kind: 'ask', pics: ['🎨'] }, prompt: `What colour ${be} the ${nm(k).toLowerCase()}?`, say: `What colour ${be} the ${nm(k)}?`, show: { pic: pic(k) }, options: opts, answer: c.id };
      }
      if (kind === 2) {
        const col = pickR(r, ['red', 'yellow', 'green', 'orange', 'purple']);
        const yes = Object.keys(COLOUR_OF).filter((k) => COLOUR_OF[k] === col);
        const no = Object.keys(COLOUR_OF).filter((k) => COLOUR_OF[k] !== col);
        const a = pickR(r, yes);
        const name = COLOURS.find((c) => c.id === col).name;
        return { type: 'pick', cue: { kind: 'colour', hex: COLOURS.find((x) => x.id === col).hex, find: true }, prompt: `Tap the ${name.toUpperCase()} one`, say: `Tap the ${name} one`, options: shuffleR(r, [a].concat(sampleR(r, no, 3))).map(optPic), answer: a };
      }
      const MIX = [['red', 'yellow', 'orange'], ['blue', 'yellow', 'green'], ['red', 'blue', 'purple'], ['red', 'white', 'pink']];
      const m = pickR(r, MIX);
      const c = COLOURS.find((x) => x.id === m[2]);
      const A = COLOURS.find((x) => x.id === m[0]), B = COLOURS.find((x) => x.id === m[1]);
      return { type: 'pick', cue: { kind: 'next' }, prompt: `${A.name} + ${B.name} = ?`, say: `If we mix ${A.name} and ${B.name}, what colour do we get?`, show: { mix: [A.hex, B.hex] }, options: shuffleR(r, [c].concat(sampleR(r, others(COLOURS, [c, A, B]), 3))).map(optSwatch), answer: c.id };
    },

    k_shapes(r, L) {
      const pool = isU(L) ? SHAPES : SHAPES.slice(0, 6);
      const kind = isU(L) ? ri(r, 0, 3) : (r() < 0.7 ? 0 : 2);
      if (kind === 0) {
        const s = pickR(r, pool);
        return { type: 'pick', cue: { kind: 'shape', shape: s }, prompt: `Tap the ${SHAPE_NAME[s].toUpperCase()}`, say: `Tap the ${SHAPE_NAME[s]}`, options: shuffleR(r, [s].concat(sampleR(r, others(pool, [s]), NO(L) - 1))).map((x) => optShape(r, x)), answer: s };
      }
      if (kind === 1) {
        const s = pickR(r, pool);
        return { type: 'pick', cue: { kind: 'ask', pics: [] }, prompt: 'What shape is this?', say: 'What shape is this?', show: { shape: s, color: pickR(r, SHAPE_COLORS) }, options: shuffleR(r, [s].concat(sampleR(r, others(pool, [s]), 3))).map((x) => optText(SHAPE_NAME[x])).map((o, i, a) => o), answer: SHAPE_NAME[s] };
      }
      if (kind === 2) {
        const things = Object.keys(SHAPE_OF).filter((k) => pool.indexOf(SHAPE_OF[k]) !== -1);
        const k = pickR(r, things);
        const s = SHAPE_OF[k];
        return { type: 'pick', cue: { kind: 'ask', pics: ['🔺', '🟦', '⭕'] }, prompt: `The ${nm(k).toLowerCase()} looks like a…`, say: `The ${nm(k)} looks like which shape?`, show: { pic: pic(k) }, options: shuffleR(r, [s].concat(sampleR(r, others(pool, [s]), NO(L) - 1))).map((x) => optShape(r, x)), answer: s };
      }
      const s = pickR(r, Object.keys(SIDES));
      return { type: 'pick', cue: { kind: 'sides' }, prompt: `How many sides does a ${SHAPE_NAME[s].toLowerCase()} have?`, say: `How many sides does a ${SHAPE_NAME[s]} have?`, show: { shape: s, color: pickR(r, SHAPE_COLORS) }, options: shuffleR(r, [0, 3, 4, 5].map(optNum)), answer: String(SIDES[s]), big: true };
    },

    k_abc(r, L) {
      const letters = Object.keys(LETTER_WORD);
      const kind = isU(L) ? ri(r, 0, 4) : ri(r, 0, 2);
      if (kind === 0) {
        const l = pickR(r, letters);
        return { type: 'pick', cue: { kind: 'glyph', text: l }, prompt: `Tap the letter ${l}`, say: `Tap the letter ${l}`, options: shuffleR(r, [l].concat(sampleR(r, others(letters, [l]), NO(L) - 1))).map((x) => optText(x)), answer: l, big: true };
      }
      if (kind === 1) {
        const l = pickR(r, letters), k = LETTER_WORD[l];
        return { type: 'pick', cue: { kind: 'ask', pics: ['🔤'] }, prompt: `${nm(k)} starts with…`, say: `${nm(k)} starts with which letter?`, show: { pic: pic(k) }, options: shuffleR(r, [l].concat(sampleR(r, others(letters, [l]), NO(L) - 1))).map((x) => optText(x)), answer: l, big: true };
      }
      if (kind === 2) {
        const l = pickR(r, letters), k = LETTER_WORD[l];
        const wrong = sampleR(r, letters.filter((x) => x !== l), NO(L) - 1).map((x) => LETTER_WORD[x]);
        return { type: 'pick', cue: { kind: 'glyph', text: l, pic: true }, prompt: `Tap the picture that starts with ${l}`, say: `Tap the picture that starts with ${l}`, show: { text: l }, options: shuffleR(r, [k].concat(wrong)).map(optPic), answer: k };
      }
      if (kind === 3) {
        const l = pickR(r, Object.keys(LOOKALIKE));
        return { type: 'pick', cue: { kind: 'glyph', text: l }, prompt: `Tap the small letter ${l}`, say: `Tap the small letter ${l}`, show: { text: l.toUpperCase() + ' ' + l }, options: shuffleR(r, [l].concat(LOOKALIKE[l])).map((x) => optText(x)), answer: l, big: true };
      }
      const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const i = ri(r, 0, 24);
      const ans = all[i + 1];
      const wrong = sampleR(r, all.split('').filter((x) => x !== ans && x !== all[i]), 3);
      return { type: 'pick', cue: { kind: 'after', text: all[i] }, prompt: `What letter comes after ${all[i]}?`, say: `What letter comes after ${all[i]}?`, options: shuffleR(r, [ans].concat(wrong)).map((x) => optText(x)), answer: ans, big: true };
    },

    k_phonics(r, L) {
      const kind = isU(L) ? ri(r, 0, 2) : ri(r, 0, 1);
      if (kind === 0) {
        const letters = Object.keys(SOUND_WORDS), l = pickR(r, letters), [snd, words] = SOUND_WORDS[l];
        const right = pickR(r, words);
        const wrong = sampleR(r, others(letters, [l]), NO(L) - 1).map((x) => pickR(r, SOUND_WORDS[x][1]));
        return { type: 'pick', cue: { kind: 'listen' }, prompt: `Which one starts with the “${l.toLowerCase()}” sound?`, say: `${snd}, ${snd}. Which picture starts with the sound ${snd}?`, show: { text: l + ' ' + l.toLowerCase() }, options: shuffleR(r, [right].concat(wrong)).map(optPic), answer: right };
      }
      if (kind === 1) {
        const pair = pickR(r, RHYMES), flip = r() < 0.5, a = flip ? pair[1] : pair[0], b = flip ? pair[0] : pair[1];
        const wrong = sampleR(r, RHYMES.filter((p) => p !== pair).map((p) => pickR(r, p)), NO(L) - 1);
        return { type: 'pick', cue: { kind: 'listen' }, prompt: `What rhymes with ${nm(a).toLowerCase()}?`, say: `What rhymes with ${nm(a)}?`, show: { pic: pic(a) }, options: shuffleR(r, [b].concat(wrong)).map(optPic), answer: b };
      }
      const w = pickR(r, CVC), sounds = nm(w).toLowerCase().split('');
      return { type: 'pick', cue: { kind: 'listen' }, prompt: `Sound it out: ${sounds.join(' – ')}`, say: `Sound it out. ${sounds.join(', ')}. Which picture is it?`, show: { text: sounds.join(' ') }, options: picOptions(r, w, others(CVC, [w]), NO(L)), answer: w };
    },

    k_animals(r, L) {
      const pool = isU(L) ? G.animals : G.easyAnimals;
      const kind = isU(L) ? ri(r, 0, 4) : ri(r, 0, 2);
      if (kind === 0) {
        const a = pickR(r, pool);
        return { type: 'pick', cue: { kind: 'find', pic: pic(a) }, prompt: `Tap the ${nm(a)}`, say: `Can you find the ${nm(a)}? Tap it!`, options: picOptions(r, a, pool, NO(L)), answer: a };
      }
      if (kind === 1) {
        const [q, a, clue] = pickR(r, ANIMAL_FACT.filter((f) => isU(L) || pool.indexOf(f[1]) !== -1 || ['cow', 'monkey', 'elephant', 'giraffe', 'lion'].indexOf(f[1]) !== -1));
        return { type: 'pick', cue: { kind: 'ask', pics: clue }, prompt: q, say: q, options: picOptions(r, a, G.animals, NO(L)), answer: a };
      }
      if (kind === 2) {
        const which = r() < 0.5 ? 'water' : 'fly';
        const a = pickR(r, G[which]);
        const wrong = sampleR(r, G.land, NO(L) - 1);
        const q = which === 'water' ? 'Which animal lives in water?' : 'Which one can fly?';
        return { type: 'pick', cue: { kind: 'ask', pics: which === 'water' ? ['🌊'] : ['☁️', '🪽'] }, prompt: q, say: q, options: shuffleR(r, [a].concat(wrong)).map(optPic), answer: a };
      }
      if (kind === 3) {
        const a = pickR(r, Object.keys(BABY));
        const opts = shuffleR(r, [BABY[a]].concat(sampleR(r, others(Object.values(BABY), [BABY[a]]), 3)));
        return { type: 'pick', cue: { kind: 'ask', pics: ['🍼'] }, prompt: `The baby of a ${nm(a).toLowerCase()} is called a…`, say: `The baby of a ${nm(a)} is called a?`, show: { pic: pic(a) }, options: opts.map((x) => optText(x)), answer: BABY[a] };
      }
      // tap all the animals that live in water / fly
      const which = r() < 0.5 ? 'water' : 'fly';
      const yes = sampleR(r, G[which], 3);
      const no = sampleR(r, G.land, 3);
      return { type: 'tapall', cue: { kind: 'all', pics: which === 'water' ? ['🌊'] : ['☁️'] }, prompt: which === 'water' ? 'Tap ALL the animals that live in water' : 'Tap ALL the ones that can fly', say: which === 'water' ? 'Tap all the animals that live in water!' : 'Tap all the ones that can fly!', items: shuffleR(r, yes.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: true })).concat(no.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: false })))) };
    },

    k_sounds(r, L) {
      const useThings = isU(L) && r() < 0.4;
      const map = useThings ? THING_SOUND : ANIMAL_SOUND;
      const keys = Object.keys(map);
      const a = pickR(r, keys);
      const q = `Who says “${map[a]}”?`;
      return { type: 'pick', listen: true, cue: { kind: 'listen' }, prompt: q, say: `Listen! ${map[a]}! ${map[a]}! Who makes this sound?`, options: shuffleR(r, [a].concat(sampleR(r, others(keys, [a]), NO(L) - 1))).map(optPic), answer: a };
    },

    k_fruits(r, L) {
      const kind = isU(L) ? ri(r, 0, 4) : ri(r, 0, 2);
      if (kind === 0) {
        const pool = isU(L) ? G.fruits.concat(G.veg) : G.fruits;
        const a = pickR(r, pool);
        return { type: 'pick', cue: { kind: 'find', pic: pic(a) }, prompt: `Tap the ${nm(a)}`, say: `Tap the ${nm(a)}`, options: picOptions(r, a, pool, NO(L)), answer: a };
      }
      if (kind === 1) {
        const n = isU(L) ? 4 : 3;
        const yes = sampleR(r, G.fruits, n);
        const no = sampleR(r, isU(L) ? G.veg : G.animals.concat(G.toys), 6 - n);
        return { type: 'tapall', cue: { kind: 'all', pics: sampleR(r, others(G.fruits, yes), 2).map(pic) }, prompt: 'Tap ALL the fruits', say: 'Tap all the fruits!', items: shuffleR(r, yes.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: true })).concat(no.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: false })))) };
      }
      if (kind === 2) {
        const col = pickR(r, ['red', 'yellow', 'green', 'orange', 'purple']);
        const yes = G.fruits.concat(G.veg).filter((k) => COLOUR_OF[k] === col);
        const no = G.fruits.concat(G.veg).filter((k) => COLOUR_OF[k] && COLOUR_OF[k] !== col);
        const a = pickR(r, yes);
        const name = COLOURS.find((c) => c.id === col).name.toLowerCase();
        return { type: 'pick', cue: { kind: 'colour', hex: COLOURS.find((x) => x.id === col).hex, find: true }, prompt: `Which one is ${name}?`, say: `Which one is ${name}?`, options: shuffleR(r, [a].concat(sampleR(r, no, NO(L) - 1))).map(optPic), answer: a };
      }
      if (kind === 3) {
        const a = pickR(r, G.veg);
        return { type: 'pick', cue: { kind: 'kindof', pics: sampleR(r, others(G.veg, [a]), 2).map(pic) }, prompt: 'Which one is a VEGETABLE?', say: 'Which one is a vegetable?', options: shuffleR(r, [a].concat(sampleR(r, G.fruits, 3))).map(optPic), answer: a };
      }
      const n = 3;
      const yes = sampleR(r, G.veg, n), no = sampleR(r, G.fruits, 6 - n);
      return { type: 'tapall', cue: { kind: 'all', pics: sampleR(r, others(G.veg, yes), 2).map(pic) }, prompt: 'Tap ALL the vegetables', say: 'Tap all the vegetables!', items: shuffleR(r, yes.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: true })).concat(no.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: false })))) };
    },

    k_vehicles(r, L) {
      const kind = isU(L) ? ri(r, 0, 4) : ri(r, 0, 2);
      if (kind === 0) {
        const a = pickR(r, G.vehicles);
        return { type: 'pick', cue: { kind: 'find', pic: pic(a) }, prompt: `Tap the ${nm(a)}`, say: `Tap the ${nm(a)}`, options: picOptions(r, a, G.vehicles, NO(L)), answer: a };
      }
      if (kind === 1) {
        const which = pickR(r, ['air', 'waterV']);
        const a = pickR(r, G[which]);
        const q = which === 'air' ? 'Which one flies in the sky?' : 'Which one goes on water?';
        return { type: 'pick', cue: { kind: 'ask', pics: which === 'air' ? ['☁️', '🪽'] : ['🌊'] }, prompt: q, say: q, options: shuffleR(r, [a].concat(sampleR(r, G.road, NO(L) - 1))).map(optPic), answer: a };
      }
      if (kind === 2) {
        const [q, a, clue] = pickR(r, VEHICLE_FACT);
        return { type: 'pick', cue: { kind: 'ask', pics: clue }, prompt: q, say: q, options: picOptions(r, a, G.vehicles, NO(L)), answer: a };
      }
      if (kind === 3) {
        const yes = sampleR(r, G.road, 3), no = sampleR(r, G.air.concat(G.waterV), 3);
        return { type: 'tapall', cue: { kind: 'all', pics: ['🛣️'] }, prompt: 'Tap ALL that go on the road', say: 'Tap all the ones that go on the road!', items: shuffleR(r, yes.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: true })).concat(no.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: false })))) };
      }
      const yes = sampleR(r, G.air.concat(G.waterV), 3), no = sampleR(r, G.road, 3);
      return { type: 'tapall', cue: { kind: 'all', pics: ['☁️', '🌊'] }, prompt: 'Tap ALL that do NOT go on the road', say: 'Tap all the ones that fly or float!', items: shuffleR(r, yes.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: true })).concat(no.map((k) => ({ id: k, pic: pic(k), say: nm(k), target: false })))) };
    },

    k_body(r, L) {
      const kind = isU(L) ? ri(r, 0, 2) : ri(r, 0, 1);
      if (kind === 0) {
        const a = pickR(r, G.body);
        return { type: 'pick', cue: { kind: 'find', pic: pic(a) }, prompt: `Tap the ${nm(a).toLowerCase()}`, say: `Tap the ${nm(a)}`, options: picOptions(r, a, G.body, NO(L)), answer: a };
      }
      if (kind === 1) {
        const [q, a, clue] = pickR(r, BODY_USE);
        return { type: 'pick', cue: { kind: 'ask', pics: clue }, prompt: q, say: q.replace('…', ''), options: picOptions(r, a, G.body, NO(L)), answer: a };
      }
      const [q, n, bp] = pickR(r, BODY_COUNT);
      return { type: 'pick', cue: { kind: 'howmany', pic: bp }, prompt: q, say: q, options: numOptions(r, n, 4, 1), answer: String(n), big: true };
    },

    k_think(r, L) {
      const kind = isU(L) ? ri(r, 0, 4) : ri(r, 0, 3);
      if (kind === 0) {
        const k = pickR(r, G.countables.concat(['elephant', 'tree', 'house', 'ball']));
        const big = r() < 0.5;
        const scales = isU(L) ? [1, 0.7, 0.45, 0.3] : [1, 0.5, 0.3];
        const opts = shuffleR(r, scales.map((s, i) => ({ id: 's' + i, pic: pic(k), scale: s, say: s === 1 ? 'big' : 'small' })));
        return { type: 'pick', cue: { kind: big ? 'big' : 'small' }, prompt: big ? 'Tap the BIG one' : 'Tap the SMALL one', say: big ? `Tap the big ${nm(k)}` : `Tap the small ${nm(k)}`, options: opts, answer: big ? 's0' : 's' + (scales.length - 1) };
      }
      if (kind === 1) {
        const k = pickR(r, G.countables);
        const more = !isU(L) || r() < 0.6;
        const ns = sampleR(r, [1, 2, 3, 4, 5, 6], isU(L) ? 3 : 2);
        const target = more ? Math.max.apply(null, ns) : Math.min.apply(null, ns);
        return { type: 'pick', cue: { kind: more ? 'more' : 'less' }, prompt: more ? 'Which has MORE?' : 'Which has LESS?', say: more ? 'Which one has more?' : 'Which one has less?', options: ns.map((n) => ({ id: String(n), group: [pic(k), n], say: String(n) })), answer: String(target), cols: ns.length === 3 ? 3 : 2 };
      }
      if (kind === 2) {
        const pairs = [['fruits', 'animals'], ['animals', 'vehicles'], ['vehicles', 'fruits'], ['toys', 'veg'], ['sky', 'animals'], ['body', 'fruits']];
        const [g1, g2] = pickR(r, pairs);
        const same = sampleR(r, G[g1], NO(L) - 1);
        const odd = pickR(r, G[g2]);
        return { type: 'pick', cue: { kind: 'odd' }, prompt: 'Which one is DIFFERENT?', say: 'Which one is different from the others?', options: shuffleR(r, same.concat([odd])).map(optPic), answer: odd };
      }
      if (kind === 3) {
        const grp = pickR(r, ['animals', 'fruits', 'vehicles', 'toys']);
        const a = pickR(r, G[grp]);
        return { type: 'pick', cue: { kind: 'same' }, prompt: 'Find the SAME picture', say: 'Find the same picture!', show: { pic: pic(a) }, options: picOptions(r, a, G[grp], NO(L)), answer: a };
      }
      // tallest / longest by scale
      const k = pickR(r, ['giraffe', 'tree', 'house', 'rocket']);
      const scales = [1, 0.75, 0.55, 0.4];
      return { type: 'pick', cue: { kind: 'tall' }, prompt: 'Tap the TALLEST one', say: `Tap the tallest ${nm(k)}`, options: shuffleR(r, scales.map((s, i) => ({ id: 's' + i, pic: pic(k), scale: s, say: '' }))), answer: 's0' };
    },

    k_pattern(r, L) {
      const kinds = isU(L) ? ['AB', 'AAB', 'ABB', 'ABC', 'COL'] : ['AB', 'AB', 'AAB'];
      const kd = pickR(r, kinds);
      if (kd === 'COL') {
        const cs = sampleR(r, COLOURS.slice(0, 7), 2);
        const unit = [cs[0], cs[1]];
        const seq = [0, 1, 0, 1, 0].map((i) => unit[i]);
        const ans = unit[1];
        return { type: 'pick', cue: { kind: 'next' }, prompt: 'What colour comes next?', say: 'What colour comes next?', show: { seqSwatch: seq.map((c) => c.hex) }, options: shuffleR(r, [ans].concat(sampleR(r, others(COLOURS.slice(0, 7), [ans]), 3))).map(optSwatch), answer: ans.id };
      }
      const g = pickR(r, ['fruits', 'animals', 'toys', 'sky', 'vehicles']);
      const [a, b, c] = sampleR(r, G[g], 3);
      const unit = kd === 'AB' ? [a, b] : kd === 'AAB' ? [a, a, b] : kd === 'ABB' ? [a, b, b] : [a, b, c];
      const len = unit.length === 2 ? 5 : unit.length === 3 ? 5 : 5;
      const seq = []; for (let i = 0; i < len; i++) seq.push(unit[i % unit.length]);
      const ans = unit[len % unit.length];
      const pool = [a, b, c].concat(sampleR(r, others(G[g], [a, b, c]), 1));
      const opts = shuffleR(r, [ans].concat(others(pool, [ans]).slice(0, NO(L) - 1))).map(optPic);
      return { type: 'pick', cue: { kind: 'next' }, prompt: 'What comes next?', say: 'Look at the pattern. What comes next?', show: { seq: seq.map(pic) }, options: opts, answer: ans };
    },

    k_weather(r, L) {
      if (r() < 0.45) {
        const a = pickR(r, G.sky);
        return { type: 'pick', cue: { kind: 'find', pic: pic(a) }, prompt: `Tap the ${nm(a).toLowerCase()}`, say: `Tap the ${nm(a)}`, options: picOptions(r, a, G.sky, NO(L)), answer: a };
      }
      const [q, a, w, clue] = pickR(r, SKY_FACT);
      return { type: 'pick', cue: { kind: 'ask', pics: clue }, prompt: q, say: q.replace('…', ''), options: shuffleR(r, [a].concat(w.slice(0, NO(L) - 1))).map(optPic), answer: a };
    },

    k_habits(r, L) {
      const [q, a, w, clue] = pickR(r, HABIT_FACT);
      return { type: 'pick', cue: { kind: 'ask', pics: clue }, prompt: q, say: q, options: shuffleR(r, [a].concat(w.slice(0, NO(L) - 1))).map(optPic), answer: a };
    },

    k_addsub(r, L) {
      const k = pickR(r, G.countables);
      if (r() < 0.55) {
        const a = ri(r, 1, 5), b = ri(r, 1, 5);
        return { type: 'pick', cue: { kind: 'add' }, prompt: `${pic(k).repeat(a)} + ${pic(k).repeat(b)} = ?`, say: `${a} ${a === 1 ? nm(k) : plural(nm(k))} and ${b} more. How many altogether?`, options: numOptions(r, a + b, 4), answer: String(a + b), big: true, wide: true };
      }
      const a = ri(r, 3, 8), b = ri(r, 1, a - 1);
      return { type: 'pick', cue: { kind: 'takeaway' }, prompt: `${pic(k).repeat(a)}  take away ${b}`, say: `There are ${a} ${plural(nm(k).toLowerCase())}. ${b} go away. How many are left?`, show: { takeaway: [pic(k), a, b] }, options: numOptions(r, a - b, 4, 0), answer: String(a - b), big: true };
    },
  };

  /* ---------------- categories ---------------- */
  // levels: which pre-primary levels show the category (0 = LKG, -1 = UKG)
  const CATS = [
    { id: 'k_count', icon: '🔢', title: 'Count & Tap', blurb: 'Tap and count!', c: ['#f97316', '#fb923c'], levels: [0, -1] },
    { id: 'k_numbers', icon: '🔟', title: 'Numbers', blurb: 'Find the number', c: ['#6366f1', '#818cf8'], levels: [0, -1] },
    { id: 'k_colours', icon: '🎨', title: 'Colours', blurb: 'Rainbow fun', c: ['#ec4899', '#f472b6'], levels: [0, -1] },
    { id: 'k_shapes', icon: '🔺', title: 'Shapes', blurb: 'Circle, square…', c: ['#14b8a6', '#2dd4bf'], levels: [0, -1] },
    { id: 'k_abc', icon: '🔤', title: 'ABC', blurb: 'Letters & sounds', c: ['#8b5cf6', '#a78bfa'], levels: [0, -1] },
    { id: 'k_phonics', icon: '🔊', title: 'Phonics', blurb: 'Sounds & rhymes', c: ['#0d9488', '#2dd4bf'], levels: [0, -1] },
    { id: 'k_animals', icon: '🦁', title: 'Animals', blurb: 'Find the animal', c: ['#f59e0b', '#fbbf24'], levels: [0, -1] },
    { id: 'k_sounds', icon: '🎵', title: 'Who Says?', blurb: 'Listen & tap', c: ['#0ea5e9', '#38bdf8'], levels: [0, -1] },
    { id: 'k_fruits', icon: '🍎', title: 'Fruits & Veggies', blurb: 'Yummy!', c: ['#ef4444', '#f87171'], levels: [0, -1] },
    { id: 'k_vehicles', icon: '🚗', title: 'Vehicles', blurb: 'Vroom vroom', c: ['#2563eb', '#60a5fa'], levels: [0, -1] },
    { id: 'k_body', icon: '👃', title: 'My Body', blurb: 'Eyes, ears, nose', c: ['#db2777', '#f472b6'], levels: [0, -1] },
    { id: 'k_think', icon: '🧠', title: 'Big, Small & Odd', blurb: 'Think & find', c: ['#7c3aed', '#a78bfa'], levels: [0, -1] },
    { id: 'k_pattern', icon: '🔁', title: 'Patterns', blurb: 'What comes next?', c: ['#059669', '#34d399'], levels: [0, -1] },
    { id: 'k_weather', icon: '🌈', title: 'Sky & Weather', blurb: 'Sun, rain, snow', c: ['#0891b2', '#22d3ee'], levels: [0, -1] },
    { id: 'k_habits', icon: '🧼', title: 'Good Habits', blurb: 'Clean & healthy', c: ['#16a34a', '#4ade80'], levels: [0, -1] },
    { id: 'k_addsub', icon: '➕', title: 'Add & Take Away', blurb: 'Picture maths', c: ['#e11d48', '#fb7185'], levels: [-1] },
  ];

  function makePaper(cat, level, paper) {
    const gen = GEN[cat];
    if (!gen) return [];
    const r = makeRng(cat + '|' + level + '|' + paper);
    const out = [], seen = new Set();
    let guard = 0;
    while (out.length < Q_PER_PAPER && guard++ < 400) {
      const q = gen(r, level);
      const key = q.type + '|' + q.prompt + '|' + (q.answer || '') + '|' + (q.items ? q.items.map((i) => i.pic).join('') : '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }

  window.KidsQuiz = {
    CATS, PAPERS_PER_CAT, Q_PER_PAPER, makePaper, makeRng, hashStr,
    isKidsCat: (id) => CATS.some((c) => c.id === id),
    allPics: () => Object.keys(P).map((k) => P[k][0]),
  };
})();
