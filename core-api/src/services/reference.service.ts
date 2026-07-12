import { prisma } from "../lib/prisma";

export interface CityDto {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export async function listCities(): Promise<{ items: CityDto[] }> {
  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });
  return { items: cities };
}
