export function GET() {
  return Response.json({
    phase: "1",
    service: "merchant-web",
    status: "ok",
  });
}
