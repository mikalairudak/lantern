import { foldToLatin } from "@/lib/places/names";

/**
 * The short forms a visitor types for a country after a city, "London, UK", read against the
 * ISO 3166-1 alpha-2 code Geoapify gives a result in `country_code`. A small table rather
 * than fuzzy matching, so a wrong country is still refused: "London, Canada" is never London,
 * England.
 */

/**
 * Short and common names, keyed as `compact` reads them, each with its alpha-2 code. England,
 * Scotland, Wales and Northern Ireland are not here: Geoapify gives each as the city's
 * `state`, where the resolver matches them, so "Edinburgh, England" is refused.
 */
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  uk: "gb",
  greatbritain: "gb",
  us: "us",
  usa: "us",
  america: "us",
  uae: "ae",
};

/** ISO 3166-1, alpha-2 to alpha-3, every assigned code, in lower case. */
export const ALPHA_3_CODES: ReadonlyMap<string, string> = new Map(
  `AD:AND AE:ARE AF:AFG AG:ATG AI:AIA AL:ALB AM:ARM AO:AGO AQ:ATA AR:ARG AS:ASM AT:AUT AU:AUS
  AW:ABW AX:ALA AZ:AZE BA:BIH BB:BRB BD:BGD BE:BEL BF:BFA BG:BGR BH:BHR BI:BDI BJ:BEN BL:BLM
  BM:BMU BN:BRN BO:BOL BQ:BES BR:BRA BS:BHS BT:BTN BV:BVT BW:BWA BY:BLR BZ:BLZ CA:CAN CC:CCK
  CD:COD CF:CAF CG:COG CH:CHE CI:CIV CK:COK CL:CHL CM:CMR CN:CHN CO:COL CR:CRI CU:CUB CV:CPV
  CW:CUW CX:CXR CY:CYP CZ:CZE DE:DEU DJ:DJI DK:DNK DM:DMA DO:DOM DZ:DZA EC:ECU EE:EST EG:EGY
  EH:ESH ER:ERI ES:ESP ET:ETH FI:FIN FJ:FJI FK:FLK FM:FSM FO:FRO FR:FRA GA:GAB GB:GBR GD:GRD
  GE:GEO GF:GUF GG:GGY GH:GHA GI:GIB GL:GRL GM:GMB GN:GIN GP:GLP GQ:GNQ GR:GRC GS:SGS GT:GTM
  GU:GUM GW:GNB GY:GUY HK:HKG HM:HMD HN:HND HR:HRV HT:HTI HU:HUN ID:IDN IE:IRL IL:ISR IM:IMN
  IN:IND IO:IOT IQ:IRQ IR:IRN IS:ISL IT:ITA JE:JEY JM:JAM JO:JOR JP:JPN KE:KEN KG:KGZ KH:KHM
  KI:KIR KM:COM KN:KNA KP:PRK KR:KOR KW:KWT KY:CYM KZ:KAZ LA:LAO LB:LBN LC:LCA LI:LIE LK:LKA
  LR:LBR LS:LSO LT:LTU LU:LUX LV:LVA LY:LBY MA:MAR MC:MCO MD:MDA ME:MNE MF:MAF MG:MDG MH:MHL
  MK:MKD ML:MLI MM:MMR MN:MNG MO:MAC MP:MNP MQ:MTQ MR:MRT MS:MSR MT:MLT MU:MUS MV:MDV MW:MWI
  MX:MEX MY:MYS MZ:MOZ NA:NAM NC:NCL NE:NER NF:NFK NG:NGA NI:NIC NL:NLD NO:NOR NP:NPL NR:NRU
  NU:NIU NZ:NZL OM:OMN PA:PAN PE:PER PF:PYF PG:PNG PH:PHL PK:PAK PL:POL PM:SPM PN:PCN PR:PRI
  PS:PSE PT:PRT PW:PLW PY:PRY QA:QAT RE:REU RO:ROU RS:SRB RU:RUS RW:RWA SA:SAU SB:SLB SC:SYC
  SD:SDN SE:SWE SG:SGP SH:SHN SI:SVN SJ:SJM SK:SVK SL:SLE SM:SMR SN:SEN SO:SOM SR:SUR SS:SSD
  ST:STP SV:SLV SX:SXM SY:SYR SZ:SWZ TC:TCA TD:TCD TF:ATF TG:TGO TH:THA TJ:TJK TK:TKL TL:TLS
  TM:TKM TN:TUN TO:TON TR:TUR TT:TTO TV:TUV TW:TWN TZ:TZA UA:UKR UG:UGA UM:UMI US:USA UY:URY
  UZ:UZB VA:VAT VC:VCT VE:VEN VG:VGB VI:VIR VN:VNM VU:VUT WF:WLF WS:WSM YE:YEM YT:MYT ZA:ZAF
  ZM:ZMB ZW:ZWE`
    .split(/\s+/)
    .map((pair) => {
      const [alpha2 = "", alpha3 = ""] = pair.split(":");
      return [alpha2.toLowerCase(), alpha3.toLowerCase()];
    }),
);

/** Letters and digits only, lower case, without diacritics: "U.K." reads "uk". */
function compact(text: string): string {
  return foldToLatin(text).replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Whether a visitor's word names the country of this alpha-2 code: the code itself, its
 * alpha-3 code, or one of the short names above. A country's full name is read from the
 * result's own `country`, not from here.
 */
export function isCountryCalled(word: string, countryCode: string): boolean {
  const key = compact(word);
  const code = countryCode.toLowerCase();
  return key === code || key === ALPHA_3_CODES.get(code) || COUNTRY_ALIASES[key] === code;
}
