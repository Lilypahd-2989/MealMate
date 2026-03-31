export interface AHProduct {
  id: number;
  title: string;
  price: number | null;
  unitSize: string | null;
  imageUrl: string | null;
  productUrl: string;
}

export interface AHSearchResult {
  ingredient: { name: string; amount: number | null; unit: string | null };
  products: AHProduct[];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function searchAHProduct(query: string, limit = 3): Promise<AHProduct[]> {
  const url = `https://api.ah.nl/mobile-services/product/search/v2?query=${encodeURIComponent(query)}&sortOn=RELEVANCE&size=${limit}`;

  const res = await fetch(url, {
    headers: {
      'x-application': 'AHWEBSHOP',
      'x-clientid': 'appie-android',
    },
  });

  if (!res.ok) {
    console.warn(`AH search failed for "${query}": ${res.status}`);
    return [];
  }

  const data = await res.json() as { products?: any[] };
  const products: any[] = data.products || [];

  return products.map(p => ({
    id: p.webshopId,
    title: p.title,
    price: p.price?.now ?? null,
    unitSize: p.unitSize ?? null,
    imageUrl: p.images?.[0]?.url ?? null,
    productUrl: `https://www.ah.be/producten/product/wi${p.webshopId}/${slugify(p.title)}`,
  }));
}
