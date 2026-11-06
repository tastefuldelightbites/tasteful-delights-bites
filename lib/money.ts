export function money(cents: number) {
  const dollars = cents / 100;
  return '$' + (Number.isInteger(dollars) ? dollars.toString() : dollars.toFixed(2));
}
