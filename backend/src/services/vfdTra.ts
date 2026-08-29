import crypto from 'crypto';

export type TRAEnvironment = 'test' | 'production';

export interface VFDConfig {
  tin: string;
  vrn?: string;
  uin?: string;
  business_name?: string;
  business_address?: string;
  tax_office?: string;
  tax_region?: string;
  efd_serial?: string;
  certkey?: string;
  regid?: string;
  receipt_code?: string;
  gc?: string;
  tax_code?: string;
  cert_serial?: string;
  cert_private_key?: string;
  environment: TRAEnvironment;
  api_username?: string;
  api_password?: string;
  token?: string;
  token_expires_at?: string;
  routing_key?: string;
  default_tax_rate?: number;
}

export interface VFDReceiptData {
  receipt_number?: string;
  date: string;
  time: string;
  tin: string;
  regid: string;
  efdSerial: string;
  rctNum: string;
  dc: number;
  gc: number;
  zNum: string;
  rctvNum: string;
  customerName: string;
  customerIdType: number;
  customerId?: string;
  customerMobile?: string;
  items: {
    id: string;
    description: string;
    quantity: number;
    taxCode: number;
    amount: number;
    discount?: number;
  }[];
  totals: {
    totalTaxExcl: number;
    totalTaxIncl: number;
    discount: number;
  };
  payments: { type: string; amount: number }[];
  vatTotals: { rate: string; netAmount: number; taxAmount: number }[];
}

export interface TRAEndpoints {
  register: string;
  token: string;
  receipt: string;
  zreport: string;
  verify: string;
}

export const TRA_ENDPOINTS: Record<TRAEnvironment, TRAEndpoints> = {
  test: {
    register: 'https://virtual.tra.go.tz/efdmsRctApi/api/vfdRegReq',
    token: 'https://virtual.tra.go.tz/efdmsRctApi/vfdtoken',
    receipt: 'https://virtual.tra.go.tz/efdmsRctApi/api/efdmsRctInfo',
    zreport: 'https://virtual.tra.go.tz/efdmsRctApi/api/efdmszreport',
    verify: 'https://virtual.tra.go.tz/efdmsRctVerify/',
  },
  production: {
    register: 'https://vfd.tra.go.tz/api/vfdRegReq',
    token: 'https://vfd.tra.go.tz/vfdtoken',
    receipt: 'https://vfd.tra.go.tz/api/efdmsRctInfo',
    zreport: 'https://vfd.tra.go.tz/api/efdmszreport',
    verify: 'https://verify.tra.go.tz/',
  },
};

export const TRA_PAYMENT_TYPES: Record<string, string> = {
  cash: 'CASH',
  bank_transfer: 'INVOICE',
  mobile_money: 'EMONEY',
  emoney: 'EMONEY',
  cheque: 'CHEQUE',
  card: 'CCARD',
  invoice: 'INVOICE',
};

export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function resolvePrivateKey(raw: string): string {
  let pem = String(raw || '').trim();
  if (pem && !pem.includes('BEGIN') && !pem.includes('-----')) {
    try {
      pem = Buffer.from(pem, 'base64').toString('utf8');
    } catch {
      pem = raw;
    }
  }
  return pem;
}

export function signContent(content: string, privateKeyPem: string, algorithm: 'sha1' | 'sha256' = 'sha1'): string {
  const key = resolvePrivateKey(privateKeyPem);
  const signer = crypto.createSign('RSA-' + algorithm.toUpperCase());
  signer.update(content);
  signer.end();
  const signature = signer.sign({ key, padding: crypto.constants.RSA_PKCS1_PADDING });
  return signature.toString('base64');
}

export function buildReceiptXml(
  privateKeyPem: string,
  receipt: VFDReceiptData,
  signatureAlgorithm: 'sha1' | 'sha256' = 'sha1'
): string {
  const itemsXml = receipt.items
    .map(
      (it, i) =>
        `<ITEM><ID>${escapeXml(it.id || String(i + 1))}</ID><DESC>${escapeXml(it.description)}</DESC><QTY>${it.quantity}</QTY><TAXCODE>${it.taxCode}</TAXCODE><AMT>${toMoney(it.amount)}</AMT></ITEM>`
    )
    .join('');

  const paymentsXml = receipt.payments
    .map((p) => `<PMTTYPE>${escapeXml(p.type)}</PMTTYPE><PMTAMOUNT>${toMoney(p.amount)}</PMTAMOUNT>`)
    .join('');

  const vatXml = receipt.vatTotals
    .map(
      (v) =>
        `<VATRATE>${escapeXml(v.rate)}</VATRATE><NETTAMOUNT>${toMoney(v.netAmount)}</NETTAMOUNT><TAXAMOUNT>${toMoney(v.taxAmount)}</TAXAMOUNT>`
    )
    .join('');

  const rct = [
    `<RCT>`,
    `<DATE>${escapeXml(receipt.date)}</DATE>`,
    `<TIME>${escapeXml(receipt.time)}</TIME>`,
    `<TIN>${escapeXml(receipt.tin)}</TIN>`,
    `<REGID>${escapeXml(receipt.regid)}</REGID>`,
    `<EFDSERIAL>${escapeXml(receipt.efdSerial)}</EFDSERIAL>`,
    `<CUSTIDTYPE>${receipt.customerIdType}</CUSTIDTYPE>`,
    `<CUSTID>${escapeXml(receipt.customerId || '')}</CUSTID>`,
    `<CUSTNAME>${escapeXml(receipt.customerName)}</CUSTNAME>`,
    `<MOBILENUM>${escapeXml(receipt.customerMobile || '')}</MOBILENUM>`,
    `<RCTNUM>${escapeXml(receipt.rctNum)}</RCTNUM>`,
    `<DC>${receipt.dc}</DC>`,
    `<GC>${receipt.gc}</GC>`,
    `<ZNUM>${escapeXml(receipt.zNum)}</ZNUM>`,
    `<RCTVNUM>${escapeXml(receipt.rctvNum)}</RCTVNUM>`,
    `<ITEMS><ITEM>${itemsXml}</ITEM></ITEMS>`,
    `<TOTALS><TOTALTAXEXCL>${toMoney(receipt.totals.totalTaxExcl)}</TOTALTAXEXCL><TOTALTAXINCL>${toMoney(receipt.totals.totalTaxIncl)}</TOTALTAXINCL><DISCOUNT>${toMoney(receipt.totals.discount)}</DISCOUNT></TOTALS>`,
    `<PAYMENTS>${paymentsXml}</PAYMENTS>`,
    `<VATTOTALS>${vatXml}</VATTOTALS>`,
    `</RCT>`,
  ].join('');

  const signature = signContent(rct, privateKeyPem, signatureAlgorithm);
  return `<?xml version="1.0" encoding="UTF-8"?><EFDMS>${rct}<EFDMSSIGNATURE>${signature}</EFDMSSIGNATURE></EFDMS>`;
}

export function buildRegistrationXml(
  privateKeyPem: string,
  tin: string,
  certKey: string,
  signatureAlgorithm: 'sha1' | 'sha256' = 'sha1'
): string {
  const regData = `<REGDATA><TIN>${escapeXml(tin)}</TIN><CERTKEY>${escapeXml(certKey)}</CERTKEY></REGDATA>`;
  const signature = signContent(regData, privateKeyPem, signatureAlgorithm);
  return `<?xml version="1.0" encoding="UTF-8"?><EFDMS>${regData}<EFDMSSIGNATURE>${signature}</EFDMSSIGNATURE></EFDMS>`;
}

export interface TRAReceiptAck {
  rctNum?: string;
  date?: string;
  time?: string;
  ackCode: number;
  ackMsg: string;
  rawXml: string;
}

export function parseReceiptAck(xml: string): TRAReceiptAck {
  const clean = (tag: string): string => {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : '';
  };
  return {
    rctNum: clean('RCTNUM') || undefined,
    date: clean('DATE') || undefined,
    time: clean('TIME') || undefined,
    ackCode: parseInt(clean('ACKCODE'), 10) || 0,
    ackMsg: clean('ACKMSG') || '',
    rawXml: xml,
  };
}

function base64Encode(str: string): string {
  return Buffer.from(String(str || ''), 'utf8').toString('base64');
}

export async function fetchTraToken(
  config: VFDConfig,
  endpoints: TRAEndpoints
): Promise<{ access_token: string; expires_in: number; token_type: string }> {
  const username = config.api_username || '';
  const password = config.api_password || '';
  if (!username || !password) {
    throw new Error('VFD API username/password not configured');
  }
  const form = new URLSearchParams();
  form.append('username', username);
  form.append('password', password);
  form.append('grant_type', 'password');

  const res = await fetch(endpoints.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    if (/<html/i.test(text)) {
      const hint =
        config.environment === 'test'
          ? 'TRA test server (virtual.tra.go.tz) is currently returning HTTP 500 for ALL requests and appears to be down. Switch to Production (vfd.tra.go.tz) if you have a live certificate, or retry later.'
          : 'This usually means the API username/password are not valid registered VFD credentials. Complete the "Register VFD" step first, then copy the USERNAME/PASSWORD from TRA\'s registration response into Configuration.';
      throw new Error(`TRA token request failed (${res.status}) - TRA returned an HTML error page. ${hint}`);
    }
    if (/invalid_grant/i.test(text)) {
      throw new Error(
        `TRA token request failed (400): the API username/password are not valid registered VFD credentials. ` +
        `On Production, these are issued by TRA during registration (USERNAME/PASSWORD in the EFDMSRESP response) - ` +
        `they are NOT your TRA login or TIN. Click "Register VFD" and ensure it returns ACKCODE 0, then check that the saved ` +
        `USERNAME/PASSWORD were copied correctly.`
      );
    }
    throw new Error(`TRA token request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`TRA token response was not valid JSON: ${text.slice(0, 500)}`);
  }
  if (!json.access_token) {
    throw new Error(`TRA token response missing access_token: ${text.slice(0, 500)}`);
  }
  return json;
}

export interface RegistrationFields {
  regid?: string;
  serial?: string;
  tin?: string;
  uin?: string;
  vrn?: string;
  mobile?: string;
  street?: string;
  city?: string;
  address?: string;
  country?: string;
  name?: string;
  receiptcode?: string;
  region?: string;
  gc?: string;
  taxoffice?: string;
  username?: string;
  password?: string;
  tokenpath?: string;
  taxcode?: string;
}

function parseRegFields(xml: string): RegistrationFields {
  const clean = (tag: string): string | undefined => {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    const v = m ? m[1].trim() : '';
    return v ? v : undefined;
  };
  return {
    regid: clean('REGID'),
    serial: clean('SERIAL'),
    tin: clean('TIN'),
    uin: clean('UIN'),
    vrn: clean('VRN'),
    mobile: clean('MOBILE'),
    street: clean('STREET'),
    city: clean('CITY'),
    address: clean('ADDRESS'),
    country: clean('COUNTRY'),
    name: clean('NAME'),
    receiptcode: clean('RECEIPTCODE'),
    region: clean('REGION'),
    gc: clean('GC'),
    taxoffice: clean('TAXOFFICE'),
    username: clean('USERNAME'),
    password: clean('PASSWORD'),
    tokenpath: clean('TOKENPATH'),
    taxcode: clean('TAXCODE'),
  };
}

export interface RegisterVfdResult {
  ackCode: number;
  ackMsg: string;
  rawXml: string;
  fields: RegistrationFields;
  savedConfig?: any;
}

export async function registerVfd(
  config: VFDConfig,
  endpoints: TRAEndpoints
): Promise<RegisterVfdResult> {
  const key = config.cert_private_key || '';
  const certSerial = config.cert_serial || '';
  if (!key || !config.tin || !config.certkey) {
    throw new Error('VFD registration requires TIN, certkey and private key');
  }
  const xml = buildRegistrationXml(key, config.tin, config.certkey);

  const res = await fetch(endpoints.register, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Cert-Serial': base64Encode(certSerial),
      'Client': 'webapi',
    },
    body: xml,
  });
  const text = await res.text();
  const ackCode = parseInt(text.match(/<ACKCODE>([\s\S]*?)<\/ACKCODE>/)?.[1]?.trim() || '0', 10) || 0;
  const ackMsg = text.match(/<ACKMSG>([\s\S]*?)<\/ACKMSG>/)?.[1]?.trim() || '';
  const fields = parseRegFields(text);
  return { ackCode, ackMsg, rawXml: text, fields };
}

export interface TraSubmitResult {
  ok: boolean;
  ack: TRAReceiptAck;
}

export async function submitTraReceipt(
  config: VFDConfig,
  endpoints: TRAEndpoints,
  receipt: VFDReceiptData,
  token: string,
  signatureAlgorithm: 'sha1' | 'sha256' = 'sha1'
): Promise<TraSubmitResult> {
  const key = config.cert_private_key || '';
  if (!key) {
    throw new Error('VFD private key not configured');
  }
  const xml = buildReceiptXml(key, receipt, signatureAlgorithm);

  const res = await fetch(endpoints.receipt, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Routing-Key': config.routing_key || 'vfdrct',
      'Cert-Serial': base64Encode(config.cert_serial || ''),
      'Authorization': `bearer ${token}`,
    },
    body: xml,
  });
  const text = await res.text();
  const ack = parseReceiptAck(text);
  return { ok: ack.ackCode === 0, ack };
}
