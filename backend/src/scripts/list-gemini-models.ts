import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  process.exit(1);
}

const endpoints = [
  'https://generativelanguage.googleapis.com/v1beta/models',
  'https://generativelanguage.googleapis.com/v1/models',
];

async function listModels(url: string) {
  try {
    const res = await fetch(`${url}?key=${apiKey}`);
    const json = await res.json();
    console.log('Endpoint:', url);
    console.log(JSON.stringify(json, null, 2));
  } catch (e: any) {
    console.error('Error calling', url, e.message || e);
  }
}

(async () => {
  for (const url of endpoints) await listModels(url);
})();
