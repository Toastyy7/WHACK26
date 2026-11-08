// General keyword rules, not transactions or amounts from any particular statement.
// Ambiguous merchants stay in Other; users can correct any category in the review table.
const rules = [
  ['Takeaways & dining', /deliveroo|uber\s*eats|just\s*eat|take\s*out|takeaway|restaurant|cafe|coffee|mcdonald|burger|kfc|pizza|nando|greggs|starbucks|costa\b/i],
  ['Transport & travel', /tfl\b|travel|train|rail|bus\b|uber\b|bolt\b|taxi|parking|petrol|shell\b|bp\s+fuel|easyjet|ryanair|airways/i],
  ['Groceries', /tesco|sainsbury|aldi|lidl|asda|morrisons|waitrose|ocado|supermarket|grocery|groceries|co.op\b/i],
  ['Bills & housing', /rent\b|mortgage|council|electric|energy|water\b|gas\b|broadband|vodafone|o2\b|ee\s|three\b|insurance/i],
  ['Entertainment & subscriptions', /netflix|spotify|prime\b|disney|cinema|steam\b|riotgames|playstation|xbox|apple\.com\/bill/i],
  ['Health & wellbeing', /pharmacy|chemist|boots\b|dentist|medical|gym\b|fitness|specsavers/i],
  ['Shopping', /amazon|argos|backmarket|ebay|uniqlo|primark|river island|levi|zara|h&m|ikea|john lewis|retail|shopping/i],
  ['Transfers & cash', /transfer|cash\b|atm\b|\bTFR\b/i],
];

export const categories = [...rules.map(([name]) => name), 'Other / needs review'];

export function categorize(description) {
  return rules.find(([, pattern]) => pattern.test(description))?.[0] ?? 'Other / needs review';
}

export function summarize(transactions) {
  const totals = new Map();
  for (const transaction of transactions) {
    const group = totals.get(transaction.category) ?? { category: transaction.category, amount: 0, count: 0 };
    group.amount += transaction.amount;
    group.count += 1;
    totals.set(group.category, group);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount);
}
