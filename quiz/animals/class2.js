/* ============================================================
   🐾  ANIMALS — Class 2
   ------------------------------------------------------------
   HOW TO EDIT THIS FILE
   • Each { ... } line below is ONE question.
   • Keep this exact shape:
       { question: "your question?", answer: "Correct", options: ["Correct","B","C","D"] }
   • RULES:
       - Give exactly 4 options.
       - The "answer" text must EXACTLY match one of the 4 options.
       - Wrap text in "double quotes". If your text has a " inside it,
         write it as \" (a backslash then a quote).
   • Add or delete question lines freely.
   • Save the file, then refresh the quiz page — changes appear instantly.
   ============================================================ */
registerQuiz("animals", 2, [
  { question: "Young of cow?", answer: "Calf", options: ["Calf", "Foal", "Lamb", "Kid"] },
  { question: "Young of horse?", answer: "Foal", options: ["Foal", "Calf", "Lamb", "Kid"] },
  { question: "Young of sheep?", answer: "Lamb", options: ["Lamb", "Calf", "Foal", "Kid"] },
  { question: "Young of goat?", answer: "Kid", options: ["Kid", "Lamb", "Calf", "Foal"] },
  { question: "Young of dog?", answer: "Puppy", options: ["Puppy", "Kitten", "Cub", "Calf"] },
  { question: "Young of cat?", answer: "Kitten", options: ["Kitten", "Puppy", "Cub", "Foal"] },
  { question: "Young of lion/tiger?", answer: "Cub", options: ["Cub", "Puppy", "Kitten", "Calf"] },
  { question: "Young of frog?", answer: "Tadpole", options: ["Tadpole", "Calf", "Lamb", "Cub"] },
  { question: "Home of bird?", answer: "Nest", options: ["Nest", "Den", "Hole", "Cave"] },
  { question: "Home of bee?", answer: "Hive", options: ["Hive", "Nest", "Web", "Cocoon"] },
  { question: "Home of spider?", answer: "Web", options: ["Web", "Nest", "Hive", "Burrow"] },
  { question: "Home of lion?", answer: "Den", options: ["Den", "Nest", "Hive", "Pen"] },
  { question: "Home of horse?", answer: "Stable", options: ["Stable", "Nest", "Den", "Cave"] },
  { question: "Home of cow?", answer: "Shed/Barn", options: ["Shed/Barn", "Den", "Nest", "Cave"] },
  { question: "Home of rabbit?", answer: "Burrow", options: ["Burrow", "Nest", "Hive", "Web"] },
  { question: "Home of fish?", answer: "Water", options: ["Water", "Tree", "Cave", "Hill"] },
  { question: "Animals with feathers?", answer: "Birds", options: ["Birds", "Reptiles", "Fish", "Insects"] },
  { question: "Animals with scales?", answer: "Fish/Reptiles", options: ["Fish/Reptiles", "Birds", "Mammals", "Insects"] },
  { question: "Animals with fur?", answer: "Mammals", options: ["Mammals", "Birds", "Fish", "Insects"] },
  { question: "Insect with 6 legs?", answer: "Ant", options: ["Ant", "Spider", "Crab", "Snail"] },
  { question: "What is the young of a pig called?", answer: "Piglet", options: ["Piglet", "Calf", "Foal", "Kid"] },
  { question: "What is the young of a deer called?", answer: "Fawn", options: ["Fawn", "Calf", "Kid", "Cub"] },
  { question: "What is the young of an elephant called?", answer: "Calf", options: ["Calf", "Foal", "Cub", "Kid"] },
  { question: "What is the young of a kangaroo called?", answer: "Joey", options: ["Joey", "Cub", "Kid", "Foal"] },
  { question: "What is the young of a duck called?", answer: "Duckling", options: ["Duckling", "Chick", "Gosling", "Cygnet"] },
  { question: "What is the young of a hen called?", answer: "Chick", options: ["Chick", "Duckling", "Gosling", "Cygnet"] },
  { question: "What is the young of a goose called?", answer: "Gosling", options: ["Gosling", "Duckling", "Chick", "Cygnet"] },
  { question: "What is the young of a swan called?", answer: "Cygnet", options: ["Cygnet", "Duckling", "Gosling", "Chick"] },
  { question: "Where does a squirrel live?", answer: "Tree hollow/nest (drey)", options: ["Tree hollow/nest (drey)", "Burrow", "Web", "Hive"] },
  { question: "Where does a snake live?", answer: "Hole/burrow", options: ["Hole/burrow", "Nest", "Web", "Hive"] },
  { question: "Where does an ant live?", answer: "Anthill/colony", options: ["Anthill/colony", "Nest", "Web", "Hive"] },
  { question: "Where does a bat live?", answer: "Cave", options: ["Cave", "Nest", "Burrow", "Web"] },
  { question: "Where does a bear live?", answer: "Den/cave", options: ["Den/cave", "Nest", "Burrow", "Web"] },
  { question: "Where does a monkey live mostly?", answer: "Trees/forest", options: ["Trees/forest", "Water", "Underground", "Desert only"] },
  { question: "Where does a camel live mostly?", answer: "Desert", options: ["Desert", "Forest", "Ocean", "Mountains only"] },
  { question: "Where does a fish breathe using?", answer: "Gills", options: ["Gills", "Lungs", "Skin only", "Nose"] },
  { question: "What kind of animal has fur and feeds its babies milk?", answer: "Mammal", options: ["Mammal", "Reptile", "Amphibian", "Bird"] },
  { question: "What kind of animal has feathers and lays eggs?", answer: "Bird", options: ["Bird", "Mammal", "Reptile", "Amphibian"] },
  { question: "What kind of animal has scaly skin and lays eggs on land, like a lizard?", answer: "Reptile", options: ["Reptile", "Mammal", "Bird", "Amphibian"] },
  { question: "What kind of animal lives both on land and in water, like a frog?", answer: "Amphibian", options: ["Amphibian", "Reptile", "Mammal", "Bird"] },
  { question: "What kind of animal lives in water and breathes with gills?", answer: "Fish", options: ["Fish", "Amphibian", "Reptile", "Mammal"] },
  { question: "How many legs does a spider have?", answer: "8", options: ["8", "6", "4", "10"] },
  { question: "How many legs does an insect have?", answer: "6", options: ["6", "8", "4", "10"] },
  { question: "What insect makes silk to build its cocoon?", answer: "Silkworm", options: ["Silkworm", "Spider", "Bee", "Ant"] },
  { question: "What do we call a baby butterfly before it grows wings?", answer: "Caterpillar", options: ["Caterpillar", "Tadpole", "Larva only", "Pupa only"] },
  { question: "What sound does a snake make?", answer: "Hiss", options: ["Hiss", "Roar", "Bark", "Moo"] },
  { question: "What sound does an elephant make?", answer: "Trumpet", options: ["Trumpet", "Roar", "Hiss", "Bark"] },
  { question: "What sound does a horse make?", answer: "Neigh", options: ["Neigh", "Bark", "Moo", "Hiss"] },
  { question: "What sound does a wolf make at night?", answer: "Howl", options: ["Howl", "Bark", "Moo", "Hiss"] },
  { question: "What sound does a frog make?", answer: "Croak", options: ["Croak", "Bark", "Moo", "Hiss"] },

  { question: "What is a mother sheep called?", answer: "Ewe", options: ["Ewe", "Ram", "Lamb", "Doe"] },
  { question: "What is a father sheep called?", answer: "Ram", options: ["Ram", "Ewe", "Lamb", "Buck"] },
  { question: "What is a mother deer called?", answer: "Doe", options: ["Doe", "Buck", "Fawn", "Stag"] },
  { question: "What is a father deer called?", answer: "Buck (stag)", options: ["Buck (stag)", "Doe", "Fawn", "Ewe"] },
  { question: "What is a mother dog called?", answer: "Bitch (female dog)", options: ["Bitch (female dog)", "Sire", "Puppy", "Pup"] },
  { question: "What is a group of fish called?", answer: "School (shoal)", options: ["School (shoal)", "Herd", "Pack", "Flock"] },
  { question: "What is a group of geese called?", answer: "Gaggle", options: ["Gaggle", "Flock", "Herd", "Pod"] },
  { question: "What is a group of whales or dolphins called?", answer: "Pod", options: ["Pod", "Herd", "Flock", "Gaggle"] },
  { question: "What insect lives in a hive and makes wax and honey?", answer: "Bee", options: ["Bee", "Wasp", "Ant", "Fly"] },
  { question: "What insect can sting but does not make honey, often black and yellow?", answer: "Wasp", options: ["Wasp", "Bee", "Ant", "Butterfly"] },
  { question: "What crawling animal has no legs at all and lives in soil?", answer: "Earthworm", options: ["Earthworm", "Snake", "Snail", "Slug"] },
  { question: "What animal changes from a tadpole into an adult with legs?", answer: "Frog", options: ["Frog", "Fish", "Snake", "Lizard"] },
  { question: "What is a young whale called?", answer: "Calf", options: ["Calf", "Cub", "Pup", "Kit"] },
  { question: "What is a young fox called?", answer: "Kit (cub)", options: ["Kit (cub)", "Calf", "Pup", "Fawn"] },


  { question: "What is a young cat called that just started walking?", answer: "Kitten", options: ["Kitten", "Puppy", "Cub", "Calf"] },
  { question: "What do we call animals that are active mostly at night?", answer: "Nocturnal animals", options: ["Nocturnal animals", "Diurnal animals", "Aquatic animals", "Migratory animals"] },
  { question: "What do we call animals that are active mostly during the day?", answer: "Diurnal animals", options: ["Diurnal animals", "Nocturnal animals", "Aquatic animals", "Migratory animals"] },
  { question: "What do we call animals that travel to a warmer place in winter?", answer: "Migratory animals", options: ["Migratory animals", "Nocturnal animals", "Diurnal animals", "Hibernating animals"] },
  { question: "What do we call animals that sleep through the whole winter?", answer: "Hibernating animals", options: ["Hibernating animals", "Migratory animals", "Nocturnal animals", "Diurnal animals"] },
  { question: "What sea creature has a hard outer shell and pincers?", answer: "Crab", options: ["Crab", "Jellyfish", "Octopus", "Starfish"] },
  { question: "What sea creature is soft-bodied without a shell and squirts ink?", answer: "Octopus", options: ["Octopus", "Crab", "Starfish", "Jellyfish"] },
  { question: "What is a baby bird that has just hatched, often needing parents to feed it, called?", answer: "Hatchling/chick", options: ["Hatchling/chick", "Fledgling", "Nestling only", "Pup"] },
  { question: "What animal spins a web to catch insects for food?", answer: "Spider", options: ["Spider", "Bee", "Butterfly", "Ant"] },
  { question: "What is the term for a very young insect before it looks like an adult?", answer: "Larva", options: ["Larva", "Pupa", "Nymph", "Egg"] },



  { question: "What do we call the young stage of an insect that looks like a small worm?", answer: "Larva", options: ["Larva", "Pupa", "Nymph", "Adult"] },
  { question: "What do we call the resting stage of an insect before it becomes an adult?", answer: "Pupa", options: ["Pupa", "Larva", "Nymph", "Egg"] },
  { question: "What is the term for a group of the same kind of animals living together?", answer: "Herd/Flock/Pack (species-dependent)", options: ["Herd/Flock/Pack (species-dependent)", "Ecosystem", "Habitat", "Population only wrong"] },
  { question: "What do we call it when an animal's body color matches its surroundings?", answer: "Camouflage", options: ["Camouflage", "Migration", "Hibernation", "Adaptation only"] },
  { question: "What do we call special body features that help an animal survive in its home?", answer: "Adaptations", options: ["Adaptations", "Migrations", "Habitats", "Ecosystems"] },




  { question: "What do we call baby insects that look similar to adults but smaller, like baby grasshoppers?", answer: "Nymphs", options: ["Nymphs", "Larvae", "Pupae", "Eggs"] },
  { question: "What is a young pigeon called?", answer: "Squab", options: ["Squab", "Chick", "Fledgling", "Nestling"] },
  { question: "What is a baby swan called?", answer: "Cygnet", options: ["Cygnet", "Gosling", "Duckling", "Chick"] },
  { question: "What do we call an animal's fixed pattern of behavior it doesn't need to learn?", answer: "Instinct", options: ["Instinct", "Habit", "Skill", "Training"] },
  { question: "What sense do dogs have that is much stronger than in humans?", answer: "Sense of smell", options: ["Sense of smell", "Sense of sight", "Sense of taste", "Sense of touch"] },





  { question: "What is a group of kangaroos called?", answer: "Mob", options: ["Mob", "Herd", "Troop", "Pack"] },
  { question: "What is a group of monkeys called?", answer: "Troop", options: ["Troop", "Mob", "Herd", "Pack"] },
  { question: "What is a group of crows called?", answer: "Murder", options: ["Murder", "Flock", "Herd", "Pack"] },
  { question: "What is a group of owls called?", answer: "Parliament", options: ["Parliament", "Flock", "Murder", "Herd"] },
  { question: "What is a group of elephants called?", answer: "Herd", options: ["Herd", "Pack", "Pride", "Troop"] },
  { question: "What sound does a pig make?", answer: "Oink", options: ["Oink", "Moo", "Baa", "Neigh"] },
  { question: "What sound does a donkey make?", answer: "Bray", options: ["Bray", "Neigh", "Moo", "Oink"] },
  { question: "What sound does a cat make when happy, a soft rumbling noise?", answer: "Purr", options: ["Purr", "Meow", "Hiss", "Growl"] },
  { question: "What sound does an angry cat or dog make as a warning?", answer: "Growl/Hiss", options: ["Growl/Hiss", "Purr", "Bark only", "Whine"] },
  { question: "What is a fish's body covered with?", answer: "Scales", options: ["Scales", "Fur", "Feathers", "Shell"] },
  { question: "What is a bird's body covered with?", answer: "Feathers", options: ["Feathers", "Scales", "Fur", "Shell"] },
  { question: "What is a mammal's body usually covered with?", answer: "Fur/Hair", options: ["Fur/Hair", "Feathers", "Scales", "Shell"] },
  { question: "What helps fish swim through water easily?", answer: "Fins", options: ["Fins", "Wings", "Legs", "Feathers"] },
  { question: "What helps birds fly through the air?", answer: "Wings", options: ["Wings", "Fins", "Legs only", "Feathers alone"] },
  { question: "What body part do most land animals use to walk?", answer: "Legs", options: ["Legs", "Fins", "Wings", "Gills"] },


































































]);
