const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { userId, currentBalance } = body ?? {};
  if (
    typeof userId !== "string" ||
    userId.trim().length === 0 ||
    typeof currentBalance !== "number" ||
    !Number.isFinite(currentBalance)
  ) {
    return Response.json(
      { error: "A userId and a valid currentBalance are required." },
      { status: 400 },
    );
  }

  await delay(2000);

  const letter = [
    "Dear Customer Support Team, I am writing to request a 14-day grace period on my credit card payments. I am experiencing unexpected financial friction and neurodivergent management challenges, and a short period of flexibility would give me time to organize my finances and make a realistic payment plan.",
    "I ask that you consider my circumstances in the spirit of the FCA Consumer Duty, which focuses on delivering good outcomes for retail customers, including appropriate support when someone is experiencing vulnerability or difficulty. I would be grateful if you could let me know whether a 14-day pause is possible and whether any fees, interest, or other account impacts would apply during that period.",
    "Please confirm the options available and any steps or information you need from me to process this request. I intend to stay in contact and resume or agree a suitable payment arrangement as soon as I can. Thank you for considering my request. Yours faithfully, Account holder.",
  ].join("\n\n");

  const referenceNumber = `SG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return Response.json({
    status: "success",
    letter,
    referenceNumber,
  });
}
