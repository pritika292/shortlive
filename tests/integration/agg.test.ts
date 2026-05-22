import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { resetDb } from "../helpers/db.js";
import { closePool } from "../../src/server/db/pool.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("agg endpoints", () => {
  let client: pg.Client;
  const app = createApp();

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    await client.query(
      `INSERT INTO urls(short, target, owner_id) VALUES('demo', 'https://x', NULL)`,
    );
    // Seed 5 clicks/min over the past 10 minutes (50 rows). Vary country + device.
    await client.query(
      `INSERT INTO clicks(url_id, ts, country, device, referrer)
         SELECT (SELECT id FROM urls WHERE short='demo'),
                NOW() - (m || ' minutes')::interval - (s || ' seconds')::interval,
                CASE WHEN s % 2 = 0 THEN 'US' ELSE 'DE' END,
                CASE WHEN s % 3 = 0 THEN 'mobile' ELSE 'desktop' END,
                'https://hn.example.com/'
           FROM generate_series(0, 9) AS m
                CROSS JOIN LATERAL generate_series(0, 4) AS s`,
    );
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("returns minute-bucketed series for the last hour", async () => {
    const res = await request(app).get("/api/agg/series?short=demo&window=1h&bucket=1m");
    expect(res.status).toBe(200);
    expect(res.body.series.length).toBeGreaterThan(0);
    const total = res.body.series.reduce((sum: number, p: { count: number }) => sum + p.count, 0);
    expect(total).toBe(50);
  });

  it("returns top countries with percentages summing to 100", async () => {
    const res = await request(app).get("/api/agg/breakdown?short=demo&dim=country");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(50);
    const sum = res.body.rows.reduce((acc: number, r: { percent: number }) => acc + r.percent, 0);
    expect(sum).toBeGreaterThan(99.5);
    expect(sum).toBeLessThan(100.5);
    expect(res.body.rows.map((r: { value: string }) => r.value).sort()).toEqual(["DE", "US"]);
  });

  it("excludes NULL values from the breakdown so '(unknown)' never appears", async () => {
    // Inject a batch of null-country clicks alongside the existing US/DE rows.
    await client.query(
      `INSERT INTO clicks(url_id, ts, country, device, referrer)
         SELECT (SELECT id FROM urls WHERE short='demo'),
                NOW(),
                NULL,
                'desktop',
                NULL
           FROM generate_series(1, 20)`,
    );
    const res = await request(app).get("/api/agg/breakdown?short=demo&dim=country");
    expect(res.status).toBe(200);
    const values = res.body.rows.map((r: { value: string }) => r.value);
    expect(values).not.toContain(null);
    expect(values).not.toContain("(unknown)");
    expect(values.sort()).toEqual(["DE", "US"]);
    // total reflects only the non-null rows
    expect(res.body.total).toBe(50);
  });

  it("rejects unknown dimensions", async () => {
    const res = await request(app).get("/api/agg/breakdown?short=demo&dim=bogus");
    expect(res.status).toBe(400);
  });

  it("rejects malformed shortcodes", async () => {
    const res = await request(app).get("/api/agg/series?short=!!");
    expect(res.status).toBe(400);
  });

  describe("snapshot endpoint", () => {
    it("returns series + every requested breakdown in one response", async () => {
      const res = await request(app).get(
        "/api/agg/snapshot?short=demo&dims=country,device,referrer&window=1h",
      );
      expect(res.status).toBe(200);
      expect(res.body.series.length).toBeGreaterThan(0);
      expect(
        res.body.breakdowns.country.rows.map((r: { value: string }) => r.value).sort(),
      ).toEqual(["DE", "US"]);
      expect(res.body.breakdowns.device.rows.map((r: { value: string }) => r.value).sort()).toEqual(
        ["desktop", "mobile"],
      );
      expect(res.body.breakdowns.referrer.rows[0].value).toBe("https://hn.example.com/");
    });

    it("respects country filter across series and breakdowns", async () => {
      const res = await request(app).get(
        "/api/agg/snapshot?short=demo&dims=country,device&country=US",
      );
      expect(res.status).toBe(200);
      expect(res.body.breakdowns.country.rows.map((r: { value: string }) => r.value)).toEqual([
        "US",
      ]);
      // Series total reflects only US clicks. The fixture uses s % 2 = 0 on
      // s ∈ {0..4} so 3 out of 5 rows per minute land in US, totaling 30.
      const total = res.body.series.reduce((sum: number, p: { count: number }) => sum + p.count, 0);
      expect(total).toBe(30);
    });

    it("rejects unknown dims", async () => {
      const res = await request(app).get("/api/agg/snapshot?short=demo&dims=country,bogus");
      expect(res.status).toBe(400);
    });
  });
});
