import type { FastifyBaseLogger } from "fastify";

interface CoingeckoPriceResponse {
  mitosis: {
    usd: number;
  };
}

export class PriceService {
  private cachedPrice: number | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private readonly COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";
  private readonly MITOSIS_ID = "mitosis";

  constructor(private readonly logger: FastifyBaseLogger) {}

  async getMitosisPrice(): Promise<number> {
    const now = Date.now();

    // Return cached price if still valid
    if (this.cachedPrice !== null && now - this.lastFetchTime < this.CACHE_DURATION_MS) {
      this.logger.debug({ price: this.cachedPrice }, "Returning cached Mitosis price");
      return this.cachedPrice;
    }

    try {
      this.logger.info("Fetching Mitosis price from Coingecko API");

      const url = `${this.COINGECKO_API_URL}?ids=${this.MITOSIS_ID}&vs_currencies=usd`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Coingecko API returned status ${response.status}`);
      }

      const data = (await response.json()) as CoingeckoPriceResponse;

      if (!data.mitosis?.usd) {
        throw new Error("Invalid response format from Coingecko API");
      }

      this.cachedPrice = data.mitosis.usd;
      this.lastFetchTime = now;

      this.logger.info({ price: this.cachedPrice }, "Successfully fetched Mitosis price");

      return this.cachedPrice;
    } catch (error) {
      this.logger.error({ err: error }, "Failed to fetch Mitosis price from Coingecko");

      // Return cached price if available, even if expired
      if (this.cachedPrice !== null) {
        this.logger.warn({ price: this.cachedPrice }, "Returning stale cached price due to fetch error");
        return this.cachedPrice;
      }

      // Fallback to hardcoded price
      const fallbackPrice = 0.14;
      this.logger.warn({ price: fallbackPrice }, "Using fallback Mitosis price");
      return fallbackPrice;
    }
  }
}
