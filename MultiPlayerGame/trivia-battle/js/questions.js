/**
 * trivia-battle/js/questions.js
 * -----------------------------------------------------------------------
 * Shared question bank — both clients index into this same array so they
 * always see identical questions and answer options.
 * -----------------------------------------------------------------------
 */

export const QUESTIONS = [
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1, category: 'Science' },
  { q: 'How many players are on a standard soccer team on the field?', options: ['9', '10', '11', '12'], correct: 2, category: 'Sports' },
  { q: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3, category: 'Geography' },
  { q: 'In Minecraft, what do you need to craft a diamond pickaxe?', options: ['Sticks + diamonds', 'Iron + coal', 'Wood only', 'Gold + sticks'], correct: 0, category: 'Gaming' },
  { q: 'Which gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], correct: 2, category: 'Science' },
  { q: 'What is the fastest land animal?', options: ['Lion', 'Cheetah', 'Horse', 'Ostrich'], correct: 1, category: 'Animals' },
  { q: 'How many strings does a standard guitar have?', options: ['4', '5', '6', '7'], correct: 2, category: 'Music' },
  { q: 'What does "HTML" stand for?', options: ['Hyper Trainer Marking Language', 'HyperText Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language'], correct: 1, category: 'Tech' },
  { q: 'Which country is home to the Great Barrier Reef?', options: ['Brazil', 'Mexico', 'Australia', 'Thailand'], correct: 2, category: 'Geography' },
  { q: 'In basketball, how many points is a free throw worth?', options: ['1', '2', '3', '4'], correct: 0, category: 'Sports' },
  { q: 'What is the chemical symbol for gold?', options: ['Ag', 'Au', 'Gd', 'Go'], correct: 1, category: 'Science' },
  { q: 'Which of these is NOT a programming language?', options: ['Python', 'Java', 'Cobra', 'Photoshop'], correct: 3, category: 'Tech' },
  { q: 'How many bones are in the adult human body?', options: ['186', '206', '226', '246'], correct: 1, category: 'Science' },
  { q: 'What year did the first iPhone release?', options: ['2005', '2006', '2007', '2008'], correct: 2, category: 'Tech' },
  { q: 'Which continent is the Sahara Desert located on?', options: ['Asia', 'Africa', 'Australia', 'South America'], correct: 1, category: 'Geography' },
  { q: 'In esports, what does "GG" typically mean?', options: ['Good Game', 'Great Grind', 'Go Get', 'Game Grid'], correct: 0, category: 'Gaming' },
  { q: 'Which planet has the most moons in our solar system?', options: ['Mars', 'Earth', 'Saturn', 'Mercury'], correct: 2, category: 'Science' },
  { q: 'What is the tallest mountain in the world?', options: ['K2', 'Kilimanjaro', 'Everest', 'Denali'], correct: 2, category: 'Geography' },
  { q: 'How many hearts does an octopus have?', options: ['1', '2', '3', '4'], correct: 2, category: 'Animals' },
  { q: 'Which social platform is known for short looping videos and a "For You" feed?', options: ['LinkedIn', 'TikTok', 'Pinterest', 'Reddit'], correct: 1, category: 'Culture' },
];
