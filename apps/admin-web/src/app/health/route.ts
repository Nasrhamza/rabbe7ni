export function GET() {
  return Response.json({
    phase: "1",
    service: "admin-web",
    status: "ok",
  });
}
