/** Short motivational lines the assistant "says" in a speech bubble (5 to 6 words each). Pure: safe to import anywhere. */

export const QUOTES: readonly string[] = [
  'Small steps every day, big results.',
  'Smile first, the sale follows.',
  'Every customer deserves your best.',
  'Great service builds lasting trust.',
  'Today is full of possibilities.',
  'Listen well, then solve brilliantly.',
  'Make every customer feel special.',
  'Your effort today builds tomorrow.',
  'Be the reason they return.',
  'Stay curious, keep learning, keep growing.',
  'Progress beats perfection every time.',
  'A positive mind wins the day.',
  'Turn every question into confidence.',
  'One helpful conversation changes everything.',
  'Believe in yourself, then deliver.',
  'Good things come to hardworking people.',
  'Kindness is your best sales skill.',
  'Patience today, loyalty for years.',
  'Dream big, serve better, shine.',
  'Your energy makes the store brighter.',
  'Challenges are chances to grow.',
  'Courage begins with one friendly hello.',
  'Show up, smile, and make magic.',
  'Teamwork turns targets into triumphs.',
  'Quality service never goes unnoticed.',
  'Every no leads closer to yes.',
  'Consistency creates excellence over time.',
  'Be proud of your hard work.',
  'Make today your best day yet.',
  'Great things never come from comfort.',
  'Focus on the customer, success follows.',
  "Keep going, you're doing great.",
  'Honest advice earns lifelong customers.',
  'Create moments customers love to remember.',
  'Success grows with every happy customer.',
  'Lead with helpfulness, finish with gratitude.',
  'Your attitude shapes every customer experience.',
  "Today's effort is tomorrow's achievement.",
  'Work hard, stay humble, smile.',
  'Every day is a fresh start.',
];

/** Number of whitespace-separated words. */
export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Returns a function that gives the next quote. Quotes come in a shuffled round (so all are used before any repeats),
 * and the first quote of a new round is never the one just shown.
 */
export function createQuotePicker(rand: () => number = Math.random, list: readonly string[] = QUOTES): () => string {
  let bag: string[] = [];
  let last = '';
  const refill = () => {
    bag = list.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag.length > 1 && bag[bag.length - 1] === last) {
      // the next one to be taken (the end of the array) must differ from the last one shown
      [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
    }
  };
  return () => {
    if (bag.length === 0) refill();
    last = bag.pop() as string;
    return last;
  };
}
