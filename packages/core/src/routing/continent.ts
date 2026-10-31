export type Continent = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

// ISO 3166-1 alpha-2 codes per continent, as space-separated strings to keep the bundle small.
const TABLE: Record<Continent, string> = {
	AF: 'DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
	AN: 'AQ BV GS HM TF',
	AS: 'AF AM AZ BH BD BT IO BN KH CN CX CC CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE',
	EU: 'AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB',
	NA: 'AI AG AW BS BB BZ BM BQ CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VG VI UM',
	OC: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
	SA: 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE'
};

const BY_COUNTRY = new Map<string, Continent>();
for (const [continent, codes] of Object.entries(TABLE)) {
	for (const code of codes.split(' ')) BY_COUNTRY.set(code, continent as Continent);
}

export const COUNTRY_COUNT = BY_COUNTRY.size;

export function continentOf(country: string | null): Continent | null {
	return country ? (BY_COUNTRY.get(country.toUpperCase()) ?? null) : null;
}
