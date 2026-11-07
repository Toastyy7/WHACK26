const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function GET() {
  await delay(800);

  const safeToSettle = Math.random() >= 0.5;
  const balance = safeToSettle
    ? Number((50.01 + Math.random() * 449.99).toFixed(2))
    : Number((Math.random() * 49.99).toFixed(2));

  return Response.json({
    balance,
    safeToSettle: balance >= 50,
  });
}
