/**
 * trivia-party/js/questions.js
 * -----------------------------------------------------------------------
 * Shared question bank — every client in the room indexes into this same
 * array (using a shared shuffled order picked at match start) so all
 * 2-8 players always see identical questions and answer options.
 * -----------------------------------------------------------------------
 */

export const QUESTIONS = [
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1, category: 'Science' },
  { q: 'How many players are on a standard soccer team on the field?', options: ['9', '10', '11', '12'], correct: 2, category: 'Sports' },
  { q: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3, category: 'Geography' },
  { q: 'Which gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], correct: 2, category: 'Science' },
  { q: 'What is the fastest land animal?', options: ['Lion', 'Cheetah', 'Horse', 'Ostrich'], correct: 1, category: 'Animals' },
  { q: 'How many strings does a standard guitar have?', options: ['4', '5', '6', '7'], correct: 2, category: 'Music' },
  { q: 'What does "HTML" stand for?', options: ['Hyper Trainer Marking Language', 'HyperText Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language'], correct: 1, category: 'Tech' },
  { q: 'Which country is home to the Great Barrier Reef?', options: ['Brazil', 'Mexico', 'Australia', 'Thailand'], correct: 2, category: 'Geography' },
  { q: 'In basketball, how many points is a free throw worth?', options: ['1', '2', '3', '4'], correct: 0, category: 'Sports' },
  { q: 'What is the chemical symbol for gold?', options: ['Ag', 'Au', 'Gd', 'Go'], correct: 1, category: 'Science' },
  { q: 'How many bones are in the adult human body?', options: ['186', '206', '226', '246'], correct: 1, category: 'Science' },
  { q: 'Which continent is the Sahara Desert located on?', options: ['Asia', 'Africa', 'Australia', 'South America'], correct: 1, category: 'Geography' },
  { q: 'Which planet has the most moons in our solar system?', options: ['Mars', 'Earth', 'Saturn', 'Mercury'], correct: 2, category: 'Science' },
  { q: 'What is the tallest mountain in the world?', options: ['K2', 'Kilimanjaro', 'Everest', 'Denali'], correct: 2, category: 'Geography' },
  { q: 'How many hearts does an octopus have?', options: ['1', '2', '3', '4'], correct: 2, category: 'Animals' },
  { q: 'Which social platform is known for short looping videos and a "For You" feed?', options: ['LinkedIn', 'TikTok', 'Pinterest', 'Reddit'], correct: 1, category: 'Culture' },
  { q: 'How many legs does a spider have?', options: ['6', '8', '10', '12'], correct: 1, category: 'Animals' },
  { q: 'What is the smallest country in the world?', options: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'], correct: 2, category: 'Geography' },
  { q: 'Which instrument has 88 keys?', options: ['Guitar', 'Piano', 'Violin', 'Flute'], correct: 1, category: 'Music' },
  { q: 'What do bees make?', options: ['Silk', 'Honey', 'Milk', 'Wax only'], correct: 1, category: 'Animals' },
  { q: 'How many colors are in a rainbow?', options: ['5', '6', '7', '8'], correct: 2, category: 'Science' },
  { q: 'Which sport uses a shuttlecock?', options: ['Tennis', 'Squash', 'Badminton', 'Table Tennis'], correct: 2, category: 'Sports' },
  { q: 'What is the capital of Japan?', options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], correct: 2, category: 'Geography' },
  { q: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correct: 1, category: 'Math' },
  { q: 'In Minecraft, what do you smelt iron ore with to get iron ingots?', options: ['Water', 'Furnace', 'Crafting table', 'Anvil'], correct: 1, category: 'Gaming' },
  { q: 'What is the largest planet in our solar system?', options: ['Saturn', 'Neptune', 'Jupiter', 'Uranus'], correct: 2, category: 'Science' },
  { q: 'Which animal is known as the "King of the Jungle"?', options: ['Tiger', 'Lion', 'Elephant', 'Gorilla'], correct: 1, category: 'Animals' },
  { q: 'How many minutes are in a full day?', options: ['1240', '1440', '1640', '1040'], correct: 1, category: 'Math' },
  { q: 'What do you call a baby dog?', options: ['Kitten', 'Cub', 'Puppy', 'Foal'], correct: 2, category: 'Animals' },
  { q: 'Which of these is a fruit, not a vegetable?', options: ['Carrot', 'Tomato', 'Potato', 'Broccoli'], correct: 1, category: 'Science' },
  { q: 'How many players are on a basketball team on the court at once?', options: ['4', '5', '6', '7'], correct: 1, category: 'Sports' },
  { q: 'What is the freezing point of water in Celsius?', options: ['-10°C', '0°C', '10°C', '32°C'], correct: 1, category: 'Science' },
  { q: 'Which country gifted the Statue of Liberty to the USA?', options: ['England', 'Spain', 'France', 'Italy'], correct: 2, category: 'History' },
  { q: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], correct: 2, category: 'Geography' },
  { q: 'What is the main ingredient in guacamole?', options: ['Tomato', 'Avocado', 'Onion', 'Lime'], correct: 1, category: 'Food' },
  { q: 'Which shape has three sides?', options: ['Square', 'Triangle', 'Pentagon', 'Hexagon'], correct: 1, category: 'Math' },
  { q: 'What gas do humans breathe in to survive?', options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Helium'], correct: 2, category: 'Science' },
  { q: 'In esports, what does "GG" typically mean?', options: ['Good Game', 'Great Grind', 'Go Get', 'Game Grid'], correct: 0, category: 'Gaming' },
  { q: 'Which sea creature has 8 arms?', options: ['Squid', 'Octopus', 'Jellyfish', 'Starfish'], correct: 1, category: 'Animals' },
  { q: 'What year did the first iPhone release?', options: ['2005', '2006', '2007', '2008'], correct: 2, category: 'Tech' },
];
