import https from 'https';

const BEEM_API_HOST = 'apisms.beem.africa';
const BEEM_PUBLIC_HOST = 'apisms.beem.africa';

export async function getSenderNames(apiKey: string, secretKey: string): Promise<{ name: string; status: string }[]> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

    const req = https.request(
      {
        hostname: BEEM_PUBLIC_HOST,
        path: '/public/v1/sender-names',
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              const names = (parsed.data || parsed || []).map((n: any) => ({
                name: n.senderid || n.name || n.sender_name || '',
                status: n.status || 'approved',
              }));
              resolve(names);
            } catch {
              resolve([]);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

export async function sendBulkSms(apiKey: string, secretKey: string, senderName: string, recipients: string[], message: string): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  if (recipients.length === 0) return { success: true, sent: 0, failed: 0, errors: [] };

  try {
    await sendBatch(apiKey, secretKey, senderName, recipients, message);
    sent = recipients.length;
  } catch (e: any) {
    errors.push(e.message);
  }

  return { success: errors.length === 0, sent, failed: errors.length, errors };
}

function sendBatch(apiKey: string, secretKey: string, senderName: string, to: string[], message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
    const recipients = to.map((dest, i) => ({ recipient_id: String(i + 1), dest_addr: dest }));
    const body = JSON.stringify({
      source_addr: senderName.slice(0, 11),
      encoding: 0,
      schedule_time: '',
      message,
      recipients,
    });

    const req = https.request(
      {
        hostname: BEEM_API_HOST,
        path: '/v1/send',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 30000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}
