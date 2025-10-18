import type { Adapter } from "../types";
import { linkedinAdapter } from "./linkedin";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { workdayAdapter } from "./workday";
import { oracleAdapter } from "./oracle";
import { genericAdapter } from "./generic";

const HOST_MAP: Record<string, Adapter> = {
  "www.linkedin.com": linkedinAdapter,
  "linkedin.com": linkedinAdapter,
  "job-boards.greenhouse.io": greenhouseAdapter,
  "boards.greenhouse.io": greenhouseAdapter,
  "jobs.lever.co": leverAdapter,
  "jobs.eu.lever.co": leverAdapter,
  "myworkdayjobs.com": workdayAdapter
};

export function getAdapterForHost(host: string): Adapter {
  if (HOST_MAP[host]) {
    return HOST_MAP[host];
  }
  if (host.endsWith(".linkedin.com")) return linkedinAdapter;
  if (host.endsWith(".greenhouse.io")) return greenhouseAdapter;
  if (host.endsWith(".lever.co")) return leverAdapter;
  if (host.includes("workday")) return workdayAdapter;
  if (host.includes("oraclecloud.com")) return oracleAdapter;
  return genericAdapter;
}
