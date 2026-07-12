// City seed — docs/cities.md's slug-ID convention (not cuid()). Upserts so this
// is safe to re-run on every deploy without duplicating rows. Lives under src/
// (not prisma/) so cities.json stays inside the tsc build's rootDir and ships
// in dist/ for the Docker runtime stage — see core-api/Dockerfile.
import { PrismaClient } from "@prisma/client";
import cities from "../constants/cities.json";

const prisma = new PrismaClient();

async function main() {
  for (const city of cities) {
    await prisma.city.upsert({
      where: { id: city.id },
      update: { name: city.name, lat: city.lat, lng: city.lng },
      create: { id: city.id, name: city.name, lat: city.lat, lng: city.lng },
    });
  }
  console.log(`Seeded ${cities.length} cities.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
